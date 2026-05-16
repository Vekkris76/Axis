#!/usr/bin/env python3
"""
log-tailer: watches the gateway log file (bind-mounted at /var/log/openclaw/)
and emits activity hits to the chat-bridge for events that map to ecosystem
nodes. Companion service to sentinel.py — together they keep the neural map
pulsing whenever something real happens (Sentinel cron, Telegram inbound,
voice transcriptions, etc).

Design rules:
- Stdlib only. No third-party deps.
- Safe restart: always tails from EOF on startup. Old events never re-emit.
- Robust to daily log rotation (filename changes at UTC midnight).
- Best-effort emission: if the bridge is down, hits are dropped silently.
- Conservative subsystem mapping: only events with clear ecosystem meaning.
"""

import json
import os
import re
import sys
import time
import traceback
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

LOG_DIR = Path(os.environ.get('TAILER_LOG_DIR', '/var/log/openclaw'))
LOG_GLOB = 'openclaw-*.log'
BRIDGE_URL = os.environ.get('TAILER_BRIDGE_URL', 'http://127.0.0.1:18791/internal/activity')
ACTIVITY_TOKEN_FILE = Path('/root/.axis-secrets/web-auth.env')
POLL_SEC = 0.5

# Map: gateway log subsystem -> list of ecosystem node IDs to ping.
# Keep this conservative — only subsystems that represent real, user-visible
# ecosystem work. Internal/heartbeat/diagnostic subsystems are excluded.
SUBSYSTEM_MAP: dict[str, list[str]] = {
    'gateway/channels/telegram/inbound': ['ch:telegram', 'axis'],
    'channels/telegram': ['ch:telegram'],
    'gmail-watcher': ['skill:email'],
}

# Voice detection: if the message text of a telegram inbound contains any of
# these markers, also fire agent:voice. Best-effort regex — sharpens as we
# learn the actual voice-note log format.
VOICE_REGEX = re.compile(r'\b(voice|audio|ogg|opus|transcrib|whisper)\b', re.IGNORECASE)

SUBSYSTEM_RE = re.compile(r'"subsystem"\s*:\s*"([^"]+)"')


def log(msg: str) -> None:
    """Stderr log so systemd captures it."""
    ts = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    print(f'{ts} tailer {msg}', file=sys.stderr, flush=True)


def load_token() -> str:
    try:
        for line in ACTIVITY_TOKEN_FILE.read_text(encoding='utf-8').splitlines():
            if line.startswith('INTERNAL_ACTIVITY_TOKEN='):
                return line.split('=', 1)[1].strip()
    except Exception:
        pass
    return ''


def emit(token: str, node_id: str) -> bool:
    if not token:
        return False
    try:
        req = urllib.request.Request(
            BRIDGE_URL,
            data=json.dumps({'node_id': node_id}).encode('utf-8'),
            headers={'Content-Type': 'application/json', 'X-Internal-Token': token},
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 200
    except Exception:
        return False


def extract_subsystem(d: dict) -> str | None:
    s0 = d.get('0', '')
    if not isinstance(s0, str):
        return None
    m = SUBSYSTEM_RE.search(s0)
    return m.group(1) if m else None


def message_text(d: dict) -> str:
    """Combine likely text-bearing fields into a single string for keyword
    matching."""
    parts: list[str] = []
    for key in ('1', '2', 'message'):
        v = d.get(key)
        if isinstance(v, str):
            parts.append(v)
        elif isinstance(v, dict):
            parts.append(json.dumps(v, ensure_ascii=False))
    return ' '.join(parts)


def process_line(line: str, token: str) -> int:
    """Return number of hits emitted for this line."""
    try:
        d = json.loads(line)
    except Exception:
        return 0
    sub = extract_subsystem(d)
    if not sub:
        return 0
    base_hits = SUBSYSTEM_MAP.get(sub)
    if not base_hits:
        return 0
    extra_hits: list[str] = []
    text = message_text(d)
    if 'telegram/inbound' in sub and VOICE_REGEX.search(text):
        extra_hits.append('agent:voice')
    all_hits = base_hits + extra_hits
    sent = 0
    for h in all_hits:
        if emit(token, h):
            sent += 1
    log(f'{sub} -> {all_hits} (sent={sent}/{len(all_hits)})')
    return sent


def current_log_path() -> Path | None:
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    p = LOG_DIR / f'openclaw-{today}.log'
    if p.exists():
        return p
    candidates = sorted(LOG_DIR.glob(LOG_GLOB))
    return candidates[-1] if candidates else None


def follow() -> None:
    log(f'starting tailer; log_dir={LOG_DIR} bridge={BRIDGE_URL}')
    token = load_token()
    if not token:
        log('WARN no INTERNAL_ACTIVITY_TOKEN found — hits will be dropped')
    path: Path | None = None
    inode: int | None = None
    f = None
    token_check_at = time.time()
    while True:
        new_path = current_log_path()
        if new_path is None:
            time.sleep(2)
            continue
        try:
            st = new_path.stat()
        except FileNotFoundError:
            time.sleep(2)
            continue
        # Detect rotation: path changed or inode changed.
        if path != new_path or inode != st.st_ino:
            if f:
                try:
                    f.close()
                except Exception:
                    pass
            f = new_path.open('r', encoding='utf-8', errors='replace')
            f.seek(0, 2)  # tail from EOF — safe restart, no replay of old events
            path = new_path
            inode = st.st_ino
            log(f'tailing {new_path.name} (inode={inode})')
        assert f is not None
        line = f.readline()
        if not line:
            time.sleep(POLL_SEC)
            # Periodically re-read token in case it was rotated.
            now = time.time()
            if now - token_check_at > 60:
                fresh = load_token()
                if fresh and fresh != token:
                    token = fresh
                    log('token reloaded')
                token_check_at = now
            continue
        try:
            process_line(line, token)
        except Exception:
            log(f'line processing crashed:\n{traceback.format_exc()}')


if __name__ == '__main__':
    try:
        follow()
    except KeyboardInterrupt:
        log('shutdown requested')
    except Exception:
        log(f'fatal: {traceback.format_exc()}')
        sys.exit(2)
