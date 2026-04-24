import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { LockKeyhole, MessageSquareMore, Network } from 'lucide-react'
import { AgentPresence } from './AgentPresence'
import { StatusPanel } from './StatusPanel'
import { TopBar } from './TopBar'
import { ConnectionStatus } from './ConnectionStatus'
import { AxisMark } from './AxisMark'
import { useGatewayHealth } from '../hooks/useGatewayHealth'
import { useAuth } from '../hooks/useAuth'
import { t } from '../lib/i18n'

type AgentState = 'idle' | 'thinking' | 'responding' | 'offline'

export function Mesh() {
  const [now, setNow] = useState(() => new Date())
  const health = useGatewayHealth()
  const { authenticated } = useAuth()
  const [axis] = useState({
    name: 'Axis',
    model: 'openai-codex/gpt-5.4',
    lastActivity: new Date(Date.now() - 1000 * 60 * 6),
  })

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const state: AgentState = health.connected ? 'idle' : 'offline'
  const minsSince = Math.round((now.getTime() - axis.lastActivity.getTime()) / 60000)

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col">
      <TopBar
        now={now}
        rightSlot={
          <div className="flex items-center gap-2">
            <Link
              to="/map"
              title="Map"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-hangar-border/60 text-hangar-muted transition hover:border-hangar-accent/60 hover:text-hangar-accent"
            >
              <Network size={16} />
            </Link>
            <Link
              to={authenticated ? '/app' : '/login'}
              title={authenticated ? t('mesh.open_chat') : t('mesh.sign_in')}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-hangar-border/60 text-hangar-muted transition hover:border-hangar-accent/60 hover:text-hangar-accent"
            >
              {authenticated ? <MessageSquareMore size={16} /> : <LockKeyhole size={16} />}
            </Link>
          </div>
        }
      />

      <main className="grid flex-1 grid-cols-1 gap-12 px-12 py-10 lg:grid-cols-[1fr_360px]">
        <section className="relative flex items-center justify-center">
          <AgentPresence name={axis.name} Mark={AxisMark} state={state} />
        </section>

        <aside className="flex flex-col gap-4">
          <StatusPanel
            label="Estado"
            value={stateLabel(state)}
            tone={state === 'offline' ? 'neutral' : 'accent'}
          />
          <StatusPanel label="Modelo" value={axis.model} mono />
          <StatusPanel
            label="Latencia gateway"
            value={health.latencyMs != null ? `${health.latencyMs} ms` : '—'}
            mono
          />
          <StatusPanel
            label="Última actividad"
            value={relativeMinutes(minsSince)}
          />
        </aside>
      </main>

      <ConnectionStatus
        connected={health.connected}
        note={
          health.lastCheck
            ? `última verificación ${health.lastCheck.toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid' })}`
            : 'iniciando…'
        }
      />
    </div>
  )
}

function stateLabel(s: AgentState): string {
  switch (s) {
    case 'idle': return 'En reposo'
    case 'thinking': return 'Pensando'
    case 'responding': return 'Respondiendo'
    case 'offline': return 'Desconectado'
  }
}

function relativeMinutes(mins: number): string {
  if (mins < 1) return 'ahora mismo'
  if (mins < 60) return `hace ${mins} min`
  const h = Math.round(mins / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} d`
}
