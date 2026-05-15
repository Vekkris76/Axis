// Left-side panel — lists every agent with a short purpose line, hierarchy
// indicator, and click-to-select. Light theme to match the rest of the
// map shell.
import type { EcoNode } from '../../../hooks/useEcosystem'
import { INK, INK_MUTED, nodeColor } from './palette'

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

  if (agents.length === 0) return null

  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-10 w-60 select-none">
      <div
        className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em]"
        style={{ color: INK_MUTED }}
      >
        <span>agents</span>
        <span>
          {agents.filter((a) => a.active).length}/{agents.length}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {agents.map((a) => {
          const isSel = selected === a.id
          const accent = nodeColor(a)
          const purpose = AGENT_PURPOSE[shortId(a.id)] ?? a.sublabel ?? ''
          return (
            <button
              key={a.id}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(a.id)
              }}
              className={
                'rounded-lg border bg-white/90 px-3 py-2 text-left backdrop-blur transition shadow-sm ' +
                (isSel ? 'border-neutral-400' : 'border-neutral-200 hover:border-neutral-300')
              }
              style={{ color: INK }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background: a.active ? accent : '#d4d4d4',
                    boxShadow: a.active ? `0 0 6px ${accent}` : 'none',
                  }}
                />
                <span className="font-mono text-[11px] uppercase tracking-[0.22em]">
                  {a.label}
                </span>
                {!a.active && (
                  <span
                    className="ml-auto font-mono text-[8px] uppercase tracking-[0.18em]"
                    style={{ color: INK_MUTED }}
                  >
                    planned
                  </span>
                )}
              </div>
              {purpose && (
                <div
                  className="mt-1 font-mono text-[9px] leading-snug tracking-[0.04em]"
                  style={{ color: INK_MUTED }}
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
