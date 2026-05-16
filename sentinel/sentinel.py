#!/usr/bin/env python3
"""
Sentinel — periodic watchdog for Axis ecosystem.

Reads workspace/projects/*/project.json, runs declared monitoring checks,
emits Telegram alerts only on state transitions, appends every finding to
a JSONL log so other agents can analyse history, and optionally pings
Healthchecks.io.

Stdlib only. Designed to never crash — every check is isolated and any
failure is logged as a finding rather than aborting the run.
"""

import json
import os
import socket
import ssl
import subprocess
import sys
import traceback
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

WORKSPACE = Path('/root/.openclaw/workspace')
PROJECTS_DIR = WORKSPACE / 'projects'
STATE_DIR = WORKSPACE / 'state' / 'sentinel'
CURRENT_FILE = STATE_DIR / 'current.json'
OPENCLAW_CONFIG = Path('/root/.openclaw/openclaw.json')

TELEGRAM_CHAT_ID = os.environ.get('SENTINEL_CHAT_ID', '48321870')
HEALTHCHECKS_URL = os.environ.get('SENTINEL_HEALTHCHECKS_URL', '').strip()

MAX_REPEAT_ALERTS = 50

VALID_STATES = {'ok', 'notice', 'alert'}


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def today_log_path() -> Path:
    return STATE_DIR / f'findings-{datetime.now(timezone.utc).strftime("%Y-%m-%d")}.jsonl'


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding='utf-8'))


def append_finding(record: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    with today_log_path().open('a', encoding='utf-8') as f:
        f.write(json.dumps(record, ensure_ascii=False) + '\n')


def load_current() -> dict:
    if not CURRENT_FILE.exists():
        return {}
    try:
        return load_json(CURRENT_FILE)
    except Exception:
        return {}


def save_current(state: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    CURRENT_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding='utf-8')


def get_bot_token() -> str | None:
    try:
        cfg = load_json(OPENCLAW_CONFIG)
        return cfg.get('channels', {}).get('telegram', {}).get('botToken')
    except Exception:
        return None


def telegram_send(text: str) -> tuple[bool, str]:
    token = get_bot_token()
    if not token:
        return False, 'no bot token in openclaw.json'
    url = f'https://api.telegram.org/bot{token}/sendMessage'
    data = json.dumps({
        'chat_id': TELEGRAM_CHAT_ID,
        'text': text,
        'disable_web_page_preview': True,
    }).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode('utf-8', errors='replace')
            ok = (resp.status == 200) and ('"ok":true' in body)
            return ok, body[:200]
    except Exception as e:
        return False, str(e)


def healthcheck_ping() -> None:
    if not HEALTHCHECKS_URL:
        return
    try:
        urllib.request.urlopen(HEALTHCHECKS_URL, timeout=5).read()
    except Exception:
        pass


# ---------- check handlers ----------

def check_http(spec: dict) -> tuple[str, str]:
    url = spec['url']
    expect = spec.get('expect_status', 200)
    timeout = spec.get('timeout_s', 10)
    try:
        ctx = ssl.create_default_context()
        req = urllib.request.Request(url, headers={'User-Agent': 'sentinel/1.0'})
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            if resp.status == expect:
                return 'ok', f'status={resp.status}'
            return 'alert', f'status={resp.status} expected={expect}'
    except urllib.error.HTTPError as e:
        return 'alert', f'http_error status={e.code}'
    except (urllib.error.URLError, socket.timeout, ssl.SSLError) as e:
        return 'alert', f'unreachable: {e.__class__.__name__}: {e}'
    except Exception as e:
        return 'alert', f'unexpected: {e.__class__.__name__}: {e}'


def check_docker(spec: dict) -> tuple[str, str]:
    container = spec['container']
    host = spec.get('host', 'local')
    fmt = '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}'
    if host == 'local':
        cmd = ['docker', 'inspect', '--format', fmt, container]
    else:
        cmd = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', host, 'docker', 'inspect', '--format', f'"{fmt}"', container]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    except subprocess.TimeoutExpired:
        return 'alert', 'docker inspect timed out'
    if p.returncode != 0:
        return 'alert', f'docker inspect failed: {p.stderr.strip() or p.stdout.strip()}'
    out = p.stdout.strip().strip('"')
    if '|' not in out:
        return 'alert', f'unexpected docker output: {out}'
    status, health = out.split('|', 1)
    if status != 'running':
        return 'alert', f'container status={status}'
    if health not in ('healthy', 'no-healthcheck'):
        return 'alert', f'health={health}'
    return 'ok', f'status={status} health={health}'


def check_disk(spec: dict) -> tuple[str, str]:
    host = spec.get('host', 'local')
    path = spec.get('path', '/')
    warn_pct = spec.get('warn_pct', 80)
    alert_pct = spec.get('alert_pct', 90)
    if host == 'local':
        cmd = ['df', '-P', path]
    else:
        cmd = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', host, 'df', '-P', path]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    except subprocess.TimeoutExpired:
        return 'alert', 'df timed out'
    if p.returncode != 0:
        return 'alert', f'df failed: {p.stderr.strip() or p.stdout.strip()}'
    lines = [ln for ln in p.stdout.splitlines() if ln.strip()]
    if len(lines) < 2:
        return 'alert', f'unexpected df output: {p.stdout!r}'
    # Filesystem 1024-blocks Used Available Capacity Mounted-on
    parts = lines[-1].split()
    if len(parts) < 5:
        return 'alert', f'unexpected df row: {lines[-1]!r}'
    pct_str = parts[4].rstrip('%')
    try:
        pct = int(pct_str)
    except ValueError:
        return 'alert', f'unparseable usage: {parts[4]!r}'
    if pct >= alert_pct:
        return 'alert', f'usage {pct}% >= {alert_pct}%'
    if pct >= warn_pct:
        return 'notice', f'usage {pct}% >= {warn_pct}%'
    return 'ok', f'usage {pct}%'


def check_ssh(spec: dict) -> tuple[str, str]:
    host = spec['host']
    timeout = spec.get('timeout_s', 8)
    try:
        p = subprocess.run(
            ['ssh', '-o', 'BatchMode=yes', '-o', f'ConnectTimeout={timeout}', host, 'true'],
            capture_output=True, text=True, timeout=timeout + 2,
        )
    except subprocess.TimeoutExpired:
        return 'alert', 'ssh timed out'
    if p.returncode == 0:
        return 'ok', 'reachable'
    return 'alert', f'ssh failed: {p.stderr.strip() or "exit " + str(p.returncode)}'


HANDLERS = {
    'http': check_http,
    'docker': check_docker,
    'disk': check_disk,
    'ssh': check_ssh,
}


# ---------- main loop ----------

def run_check(project_id: str, bucket: str, spec: dict) -> dict:
    check_id = spec.get('id') or spec.get('type', 'unknown')
    full_key = f'{project_id}:{bucket}:{check_id}'
    ctype = spec.get('type')
    handler = HANDLERS.get(ctype)
    if not handler:
        return {
            'key': full_key, 'project': project_id, 'bucket': bucket, 'check': check_id,
            'type': ctype, 'state': 'alert', 'detail': f'unknown check type: {ctype}',
        }
    try:
        state, detail = handler(spec)
    except Exception as e:
        state, detail = 'alert', f'handler crashed: {e.__class__.__name__}: {e}'
    if state not in VALID_STATES:
        state = 'alert'
        detail = f'invalid state returned: {state!r} ({detail})'
    return {
        'key': full_key, 'project': project_id, 'bucket': bucket, 'check': check_id,
        'type': ctype, 'state': state, 'detail': detail,
    }


def main() -> int:
    started = now_iso()
    findings: list[dict] = []

    if not PROJECTS_DIR.exists():
        finding = {'ts': started, 'severity': 'alert', 'event': 'projects_dir_missing', 'path': str(PROJECTS_DIR)}
        append_finding(finding)
        telegram_send(f'[SENTINEL ALERT] internal: projects dir missing at {PROJECTS_DIR}')
        return 1

    for project_json in sorted(PROJECTS_DIR.glob('*/project.json')):
        try:
            project = load_json(project_json)
        except Exception as e:
            findings.append({
                'key': f'_meta:{project_json.parent.name}', 'project': project_json.parent.name,
                'bucket': '_meta', 'check': 'load_project_json', 'type': '_meta',
                'state': 'alert', 'detail': f'{e.__class__.__name__}: {e}',
            })
            continue
        if project.get('status') == 'paused':
            continue
        monitoring = project.get('monitoring') or {}
        for bucket in ('liveness', 'drift', 'updates'):
            for spec in monitoring.get(bucket, []) or []:
                findings.append(run_check(project['id'], bucket, spec))

    previous = load_current()
    new_current = dict(previous)

    transitions: list[dict] = []
    for f in findings:
        key = f['key']
        prev = previous.get(key, {})
        prev_state = prev.get('state', 'ok')
        repeat = prev.get('repeat', 0) if prev_state == f['state'] else 0
        repeat_next = repeat + 1 if prev_state == f['state'] else 1

        record = {
            'ts': started, 'severity': f['state'], 'project': f['project'],
            'bucket': f['bucket'], 'check': f['check'], 'type': f['type'],
            'detail': f['detail'], 'prev_state': prev_state, 'repeat': repeat_next,
        }
        append_finding(record)

        new_current[key] = {'state': f['state'], 'detail': f['detail'], 'ts': started, 'repeat': repeat_next}

        # transition: ok -> alert (down) or alert -> ok (recovery)
        if prev_state != f['state']:
            if f['state'] == 'alert' or (prev_state == 'alert' and f['state'] == 'ok'):
                transitions.append({**f, 'prev_state': prev_state})

    save_current(new_current)

    # Telegram for transitions
    for t in transitions:
        if t['state'] == 'alert':
            msg = f"[SENTINEL ALERT] {t['project']}: {t['check']} ({t['type']}) — {t['detail']}"
        else:
            msg = f"[SENTINEL OK] {t['project']}: {t['check']} recovered"
        ok, info = telegram_send(msg)
        append_finding({
            'ts': now_iso(), 'severity': 'info', 'event': 'telegram_dispatch',
            'message': msg, 'sent_ok': ok, 'info': info[:200],
        })

    healthcheck_ping()

    # Summary line to stdout (cron log)
    counts = {'ok': 0, 'notice': 0, 'alert': 0, 'other': 0}
    for f in findings:
        counts[f['state'] if f['state'] in counts else 'other'] += 1
    print(f"sentinel {started} checks={len(findings)} ok={counts['ok']} notice={counts['notice']} alert={counts['alert']} transitions={len(transitions)}")
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        # absolute last resort: log & try to alert
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        crash = {
            'ts': now_iso(), 'severity': 'alert', 'event': 'sentinel_crash',
            'traceback': traceback.format_exc(),
        }
        try:
            append_finding(crash)
        except Exception:
            pass
        try:
            telegram_send('[SENTINEL ALERT] internal: sentinel.py crashed — check logs')
        except Exception:
            pass
        sys.exit(2)
