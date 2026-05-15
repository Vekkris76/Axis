// Left-side HUD panel listing every agent (active + planned), with a short
// purpose line so the audience reads the system as a team, not a single
// orb. Buttons mirror the map selection.
import type { EcoNode } from '../../../hooks/useEcosystem'
import {
  HUD_AMBER,
  HUD_BG_PANEL,
  HUD_BORDER,
  HUD_CYAN,
  HUD_TEXT,
  HUD_TEXT_DIM,
  HUD_TEXT_MUTED,
} from './palette'

// Curated explanations — we'd rather hand-write a single readable line per
// agent than expose the raw `used_for` array. Keys match the agent id
// (without the `agent:` prefix).
const AGENT_PURPOSE: Record<string, string> = {
  axis: 'Orquestrador. Coordina la resta del sistema.',
  voice: 'Especialista en àudio i pipeline de veu.',
  architect: 'Disseny de sistemes i decisions tècniques.',
  builder: 'Implementació, integració i refactor.',
  reviewer: 'Revisió i control de qualitat.',
  sentinel: 'Monitorització i detecció d’estats.',
}

function shortId(nodeId: string): string {
  return nodeId.startsWith('agent:') ? nodeId.slice('agent:'.length) : nodeId
}

export function AgentHUD({
  nodes,
  selected,
  onSelect,
}: {
  nodes: EcoNode[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  const agents = nodes
    .filter((n) => n.kind === 'agent')
    .sort((a, b) => {
      if (a.id === 'axis') return -1
      if (b.id === 'axis') return 1
      if (a.active !== b.active) return a.active ? -1 : 1
      return a.label.localeCompare(b.label)
    })

  return (
    <div className="pointer-events-auto absolute left-4 top-20 z-10 w-64 select-none">
      <div
        className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em]"
        style={{ color: HUD_CYAN }}
      >
        <span>// agents</span>
        <span style={{ color: HUD_TEXT_MUTED }}>
          {agents.filter((a) => a.active).length}/{agents.length}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {agents.map((a) => {
          const isSel = selected === a.id
          const purpose = AGENT_PURPOSE[shortId(a.id)] ?? a.sublabel ?? ''
          return (
            <button
              key={a.id}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(a.id)
              }}
              className="text-left transition"
              style={{
                background: isSel
                  ? 'rgba(255, 170, 58, 0.07)'
                  : `${HUD_BG_PANEL}cc`,
                border: `1px solid ${isSel ? HUD_AMBER : HUD_BORDER}`,
                padding: '8px 10px',
                color: HUD_TEXT,
                clipPath:
                  'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5"
                  style={{
                    background: a.active ? HUD_AMBER : HUD_TEXT_MUTED,
                    boxShadow: a.active ? `0 0 6px ${HUD_AMBER}` : 'none',
                  }}
                />
                <span className="font-mono text-[11px] uppercase tracking-[0.25em]">
                  {a.label}
                </span>
                {!a.active && (
                  <span
                    className="ml-auto font-mono text-[8px] uppercase tracking-[0.2em]"
                    style={{ color: HUD_TEXT_MUTED }}
                  >
                    planned
                  </span>
                )}
              </div>
              {purpose && (
                <div
                  className="mt-1 font-mono text-[9px] leading-snug tracking-[0.05em]"
                  style={{ color: HUD_TEXT_DIM }}
                >
                  {purpose}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
