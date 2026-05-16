import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { LockKeyhole, MessageSquareMore, Network } from 'lucide-react'
import { AgentPresence } from './AgentPresence'
import { StatusPanel } from './StatusPanel'
import { TopBar } from './TopBar'
import { ConnectionStatus } from './ConnectionStatus'
import { AxisMark } from './AxisMark'
import { useGatewayHealth } from '../hooks/useGatewayHealth'
import { useEcosystem } from '../hooks/useEcosystem'
import { useAuth } from '../hooks/useAuth'
import { t } from '../lib/i18n'

type AgentState = 'idle' | 'thinking' | 'responding' | 'offline'

export function Mesh() {
  const [now, setNow] = useState(() => new Date())
  const health = useGatewayHealth()
  const eco = useEcosystem()
  const { authenticated } = useAuth()
  const [axis] = useState({
    name: 'Axis',
    model: 'openai-codex/gpt-5.4',
  })

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Activity drives the "is Axis doing something right now?" signal.
  // 0..1 from the bridge, decayed over a 5-min window.
  const axisActivity = eco.data?.nodes.find((n) => n.id === 'axis')?.activity ?? 0
  const state: AgentState = !health.connected
    ? 'offline'
    : axisActivity > 0.5
      ? 'responding'
      : axisActivity > 0.1
        ? 'thinking'
        : 'idle'
  const ecosystemActivity = (eco.data?.nodes ?? []).reduce(
    (acc, n) => Math.max(acc, n.activity ?? 0),
    0,
  )

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
          <AgentPresence name={axis.name} Mark={AxisMark} state={state} activity={axisActivity} />
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
            label="Actividad ecosistema"
            value={activityLabel(ecosystemActivity)}
            tone={ecosystemActivity > 0.05 ? 'accent' : 'neutral'}
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

function activityLabel(score: number): string {
  // 0..1 score → human label. Decays over a 5-min window in the bridge.
  if (score <= 0.05) return 'En silencio'
  if (score < 0.2) return 'Latido bajo'
  if (score < 0.5) return 'Actividad moderada'
  return 'Actividad alta'
}
