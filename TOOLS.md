# TOOLS

## Qué es este archivo

`TOOLS.md` guarda notas locales y operativas del entorno.

No define la filosofía del asistente.
No sustituye a las skills.
No es memoria curada del usuario.

Su función es muy concreta: reunir valores específicos del entorno que hacen falta para operar bien.

## Configuración y secretos

Solo ubicaciones. Los valores secretos viven fuera del workspace, en el vault local del usuario (`~/Projects/OpenClaw/.secrets/credentials.md` en el Mac de Òscar).

### Rutas de configuración

- `.env` canónico (host): `/root/openclaw/.env`
- Config de plataforma: `/root/.openclaw/openclaw.json` (host), montado como `/home/node/.openclaw/openclaw.json` dentro del contenedor.
- Symlinks o rutas de compatibilidad: ninguno.

### Regla de seguridad

- Documenta ubicación y propósito.
- Nunca pegues secretos enteros en este archivo.
- Si un valor es especialmente sensible, referencia su ubicación, no el contenido.

## Mensajería

### Plataforma principal

- Telegram bot ↔ Òscar (`@orovirat`, Telegram user ID `48321870`), DM directo 1 a 1.
- Política: `channels.telegram.dmPolicy = "pairing"`. Los usuarios desconocidos reciben un código; se aprueban con `openclaw pairing approve telegram <código>`.

### Plataforma secundaria

> Sin configurar.

## Proyectos activos

El usuario lleva varios proyectos en paralelo. Axis debe poder referenciarlos por nombre sin pedir contexto:

- **Auratech** — equipo y marca del usuario.
- **trading-autopilot** — bot de trading en otro servidor Hetzner (no este).
- **nexa** — sistemas internos en LAN (`nexa-pre` / `nexa-pro` / `nexa-obs`).
- **kairos**
- **Divina Combustion**
- **Latentum**
- **Perfums**

Gestión de proyectos (Linear / Jira / Notion / Asana): sin configurar.

### CLIs y utilidades

- CLI de agente: `/usr/local/bin/openclaw` dentro del contenedor del gateway. Desde el host se invoca con `docker exec openclaw-openclaw-gateway-1 openclaw <subcomando>`.
- Logs del gateway: `/tmp/openclaw/openclaw-YYYY-MM-DD.log` dentro del contenedor; desde el host, `docker compose -f /root/openclaw/docker-compose.yml logs openclaw-gateway`.
- CLI de email: sin configurar.
- Base de datos o mirror local: no aplica.

## Infraestructura local

### Hosts y aliases

- `openclaw` → `178.104.132.101` — Axis gateway. Hetzner Cloud CX33, Ubuntu 24.04, Docker 29, región `nbg1` (Nuremberg). SSH con clave `~/.ssh/id_ed25519_openclaw` desde el Mac de Òscar; autenticación por password deshabilitada.

### Endpoints útiles

- `https://axis.aura-digital.org/healthz` — liveness público del gateway (Caddy + Let's Encrypt).
- `https://axis.aura-digital.org/readyz` — readiness.
- `wss://axis.aura-digital.org` — WebSocket del Control UI. Requiere Gateway Token **y** device pairing (aprobación con `openclaw devices approve <request-id>`).
- Loopback en el servidor (solo accesibles por SSH tunnel desde el Mac):
  - `127.0.0.1:18789` — gateway HTTP / WS
  - `127.0.0.1:18790` — bridge
  - `127.0.0.1:1455` — callback OAuth (solo durante un login activo)

## Reglas operativas del entorno

- **Notas de voz**: Telegram entrega OGG/Opus → wrapper `/usr/local/bin/transcribe` dentro del contenedor. El wrapper normaliza con `ffmpeg` a WAV 16-bit mono 16 kHz, invoca `whisper-cli` con el modelo `ggml-base` y devuelve texto plano por stdout. Configurado en `tools.media.audio` de `openclaw.json`.
- **Navegador recomendado**: Chrome o Safari indistintamente para OAuth y apertura de enlaces.
- **Regla de validación antes de enviar**:
  - Confirma por DM antes de emails salientes.
  - No enviar cifras financieras sin OK explícito del usuario.
- **Endpoints / conectores activos**:
  - `openai-codex` (OAuth, subscripción ChatGPT Business de Òscar) para inferencia de chat.
  - `whisper-cli` local (ggml-base, 147 MB) para transcripción de audio.

## Stack de prompts o runtime

- **Stack por defecto**: `openai-codex/gpt-5.4` vía OAuth.
- **Stack alternativo o fallback**: sin configurar. Si Codex se cae, Axis falla.
- **Cómo se conmuta**: editar `agents.defaults.model.primary` en `/root/.openclaw/openclaw.json`; los fallbacks se añaden bajo `agents.defaults.model.fallbacks` cuando se configuren.

## Sentinel (watchdog)

Agente de vigilancia periódica. Vive en el host `openclaw`, no en el contenedor.

- **Script**: `/root/openclaw-sentinel/sentinel.py` (stdlib only, sin deps).
- **Cron**: root crontab del host, cada 5 min: `*/5 * * * * /usr/bin/python3 /root/openclaw-sentinel/sentinel.py >> /var/log/sentinel.log 2>&1`.
- **Fuentes** que monitoriza: bloque opcional `monitoring` dentro de cada `workspace/projects/<id>/project.json`. Schema en `~/Projects/OpenClaw/sentinel/SCHEMA.md`.
- **Tipos de check** (fase 1): `http`, `docker`, `disk`, `ssh`.
- **Estado vivo**: `/root/.openclaw/workspace/state/sentinel/current.json` — último estado conocido de cada check (clave `<project>:<bucket>:<check_id>`).
- **Histórico**: `/root/.openclaw/workspace/state/sentinel/findings-YYYY-MM-DD.jsonl` — una línea por finding por ejecución; legible por otros agentes (Reviewer, Architect) desde dentro del contenedor.
- **Alertas Telegram**: solo en **transiciones** (`ok → alert` o `alert → ok`). Prefix `[SENTINEL ALERT]` / `[SENTINEL OK]`. Bot token leído de `channels.telegram.botToken` en `openclaw.json`; destino `chat_id=48321870` (override con env `SENTINEL_CHAT_ID`).
- **Healthchecks.io dead-man's switch**: ping a la URL en env `SENTINEL_HEALTHCHECKS_URL` al final de cada ejecución. Sin URL, no pinga.
- **Pilot project**: `openclaw-infra` (en `workspace/projects/openclaw-infra/project.json`) — auto-monitoreo del propio stack (axis/mesh endpoints + 3 contenedores + disco raíz).
- **Fuentes locales del código**: `~/Projects/OpenClaw/sentinel/` (script, schema, pilot project.json, install.sh idempotente).

## Stack web personalizado (mesh + chat-bridge)

Construido sobre `aura-digital.org`. Vive al lado del Gateway de OpenClaw, no dentro. Axis lo gobierna indirectamente: los datos que expone salen del mismo workspace y `openclaw.json`.

### Rutas públicas

- `https://mesh.aura-digital.org/` — landing, estado en vivo (polling `/api/healthz` cada 5 s).
- `https://mesh.aura-digital.org/map` — grafo del ecosistema de Axis, reactivo (polling `/api/map` cada 10 s).
- `https://mesh.aura-digital.org/login` — password gate del chat privado.
- `https://mesh.aura-digital.org/app` — chat privado con Axis (requiere cookie JWT).
- `https://axis.aura-digital.org/` — Control UI oficial de OpenClaw (diferente aplicación, misma infra).

### Componentes al servidor

- **Frontend SPA** (fuentes en Mac de Òscar: `~/Projects/OpenClaw/dashboard/src/`). Stack: Vite + React 19 + Tailwind 4 + framer-motion + react-markdown + react-router. Build estático en `/srv/mesh/` servido por Caddy. Deploy: `pnpm build && rsync dist/ openclaw:/srv/mesh/`.
- **chat-bridge** — contenedor `openclaw-chat-bridge-1` basado en `axis-chat-bridge:local`. Fuentes: `/root/chat-bridge/{app.py,Dockerfile,requirements.txt}`. FastAPI + python-docker SDK + pyjwt. Monta `/var/run/docker.sock` y `/root/.openclaw:/data/openclaw:ro`. Secretos en `/root/.axis-secrets/web-auth.env`.
- **Caddy** — `/root/openclaw/Caddyfile`, tres virtual hosts (axis, mesh, y legacy molty).

### Endpoints del bridge (expuestos vía Caddy bajo `/api/*`)

| Método · Path | Auth | Qué hace |
| --- | --- | --- |
| `POST /api/auth` | password | Verifica `WEB_AUTH_PASSWORD`, set cookie `axis_session` (JWT HS256, 7d) |
| `POST /api/logout` | cookie | Clear cookie |
| `GET /api/me` | cookie | Verifica sesión activa |
| `POST /api/chat` | cookie | `{message, sessionId}` → ejecuta `docker exec openclaw-openclaw-gateway-1 openclaw agent --agent main --message ... --json` y devuelve `{reply, sessionId, durationMs, status, usage}` |
| `GET /api/map` | público | Snapshot del ecosistema: `{nodes, edges, generatedAt}` leyendo workspace + openclaw.json |
| `GET /api/healthz` | público | Passthrough al gateway |

### Cómo se genera el grafo del mapa

Bridge lee:

- Skills: lista directorios bajo `/data/openclaw/workspace/skills/<skill>/SKILL.md` (extrae `summary:` del frontmatter YAML como sublabel).
- Channels: `openclaw.json['channels'].*` — nombre, `enabled`, algún detalle (bot API para telegram).
- Providers: `openclaw.json['auth']['profiles']` — uno por perfil OAuth registrado.
- Primary model: `agents.defaults.model.primary`.

Cualquier skill nueva que Axis añada a su `workspace/skills/` aparece automáticamente en el mapa sin código. Lo mismo con canales o perfiles auth.

### Si Òscar pide modificar la web desde Telegram

Axis no puede editar ficheros del Mac de Òscar desde el servidor. Opciones:

1. Describir el cambio y los archivos a tocar; Òscar lo aplica desde Claude Code en su Mac.
2. Si el cambio es puramente servidor (ej. endpoint nuevo en `chat-bridge`, o Caddyfile), sí puedes hacerlo:
   - Editar `/root/chat-bridge/app.py` o `/root/openclaw/Caddyfile`.
   - Rebuild: `docker compose -f /root/openclaw/docker-compose.yml up -d --build chat-bridge`.
   - Reload Caddy: `docker compose -f /root/openclaw/docker-compose.yml exec caddy caddy reload --config /etc/caddy/Caddyfile`.
3. Pedir confirmación antes de tocar nada productivo (regla general).

### Deploy manual del frontend

Requiere acceso al Mac de Òscar. No es una tarea que Axis pueda ejecutar sola. Documentado aquí como referencia para poder guiar a Òscar cuando él lo pida.

## Mantenimiento

Un buen `TOOLS.md` debe ser:

- corto
- preciso
- local al entorno
- fácil de escanear
- fácil de actualizar

Si una nota deja de ser específica del entorno, probablemente debe mudarse a otro archivo.

## Principio final

`TOOLS.md` es la chuleta local del asistente.

No debería explicar el mundo.

Solo debería evitar que el asistente pierda tiempo buscando cosas que ya debería tener a mano.
