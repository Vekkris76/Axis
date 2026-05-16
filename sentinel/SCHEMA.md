# Sentinel monitoring schema

Bloc opcional dins de cada `workspace/projects/<id>/project.json`.

Si un projecte no porta el bloc `monitoring`, Sentinel l'ignora. Retrocompatible al 100%.

## Estructura

```json
{
  "id": "trading-autopilot",
  "name": "Trading Autopilot",
  "status": "active",
  "monitoring": {
    "liveness": [ /* checks ràpids "està viu?" */ ],
    "drift":    [ /* canvis lents "alguna cosa ha canviat?" */ ],
    "updates":  [ /* upstream "hi ha versió nova?" — fase futura */ ]
  }
}
```

## Tipus de check (fase 1)

Cada check porta `id` (estable, usat com a clau d'estat) i `type`.

### `http`

```json
{ "id": "axis-healthz", "type": "http", "url": "https://axis.aura-digital.org/healthz", "expect_status": 200, "timeout_s": 10 }
```

OK si status code coincideix amb `expect_status` (default 200) dins de `timeout_s` (default 10).

### `docker`

```json
{ "id": "gateway-container", "type": "docker", "host": "local", "container": "openclaw-openclaw-gateway-1" }
```

OK si `docker inspect` reporta `State.Status == "running"` i `State.Health.Status == "healthy"` (o cap healthcheck declarat).

`host: "local"` = aquesta màquina. Per a hosts remots: `"host": "trading-autopilot"` (cal entrada SSH config).

### `disk`

```json
{ "id": "root-disk", "type": "disk", "host": "local", "path": "/", "warn_pct": 80, "alert_pct": 90 }
```

NOTICE si % usat ≥ `warn_pct`, ALERT si ≥ `alert_pct`.

### `ssh` (fase 1.5)

```json
{ "id": "trading-host-alive", "type": "ssh", "host": "trading-autopilot", "timeout_s": 8 }
```

OK si `ssh <host> true` retorna 0.

## Tipus pendents (fase 2+)

- `tls` — dies fins a expiració de certificat
- `github_repo` — nous commits a `main` que encara no incorpores
- `image_tag` — tag d'imatge Docker upstream més nou que el local
- `process` — procés concret viu al host

## Estats i severitat

Cada execució d'un check produeix un dels 3 estats: `ok`, `notice`, `alert`.

- **ok** → silenci. Es registra a findings.jsonl però no s'envia Telegram.
- **notice** → resum diari (no Telegram immediat). Per a coses tipus "disk al 82%, vigila".
- **alert** → Telegram immediat amb prefix `[SENTINEL ALERT]`.

## Transicions (anti-soroll)

Sentinel només envia Telegram en **transicions**:

- `ok → alert` → `[SENTINEL ALERT] <project>: <check> down — <detail>`
- `alert → ok` → `[SENTINEL OK] <project>: <check> recovered`

Si un check segueix `alert` durant 50 execucions seguides, no es repeteix l'alerta. Tot queda registrat a findings.jsonl per a anàlisi posterior.
