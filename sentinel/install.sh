#!/usr/bin/env bash
#
# install.sh — desplega Sentinel al host openclaw.
#
# Idempotent: pots executar-lo diverses vegades sense efectes secundaris.
# Cal executar-lo des d'una màquina amb SSH alias `openclaw` configurat.
#
set -euo pipefail

REMOTE_HOST="openclaw"
REMOTE_DIR="/root/openclaw-sentinel"
CRON_LINE="*/5 * * * * /usr/bin/python3 ${REMOTE_DIR}/sentinel.py >> /var/log/sentinel.log 2>&1"
CRON_MARKER="# openclaw-sentinel (managed by install.sh)"

# 1) Crea el directori remot
ssh "${REMOTE_HOST}" "mkdir -p ${REMOTE_DIR} && touch /var/log/sentinel.log && chmod 644 /var/log/sentinel.log"

# 2) Copia sentinel.py
scp -q sentinel.py "${REMOTE_HOST}:${REMOTE_DIR}/sentinel.py"
ssh "${REMOTE_HOST}" "chmod +x ${REMOTE_DIR}/sentinel.py"

# 3) Copia el pilot project.json al workspace (només si no existeix encara)
PILOT_REMOTE_DIR="/root/.openclaw/workspace/projects/openclaw-infra"
ssh "${REMOTE_HOST}" "mkdir -p ${PILOT_REMOTE_DIR}"
scp -q projects/openclaw-infra.project.json "${REMOTE_HOST}:${PILOT_REMOTE_DIR}/project.json"

# 4) Crea el directori d'estat
ssh "${REMOTE_HOST}" "mkdir -p /root/.openclaw/workspace/state/sentinel && chown 1000:1000 -R /root/.openclaw/workspace/state/sentinel"

# 5) Cron host: afegeix o reemplaça la línia marcada
ssh "${REMOTE_HOST}" "
  current=\$(crontab -l 2>/dev/null || true)
  filtered=\$(printf '%s\n' \"\$current\" | grep -v '${CRON_MARKER}' | grep -v 'openclaw-sentinel/sentinel.py' || true)
  printf '%s\n%s\n%s\n' \"\$filtered\" '${CRON_MARKER}' '${CRON_LINE}' | sed '/^\$/d' | crontab -
"

# 6) Verifica
ssh "${REMOTE_HOST}" "echo '--- crontab ---'; crontab -l | grep -A1 'openclaw-sentinel'; echo '--- files ---'; ls -la ${REMOTE_DIR}/"

echo ""
echo "Sentinel installed. Cron runs every 5 min. Log: /var/log/sentinel.log on ${REMOTE_HOST}"
echo "Healthchecks.io URL: set in cron via SENTINEL_HEALTHCHECKS_URL env var (re-run after providing)."
