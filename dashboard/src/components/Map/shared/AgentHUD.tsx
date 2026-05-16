// Left-side panel — lists every agent with a short purpose line, hierarchy
// indicator, and click-to-select. Light theme to match the rest of the
// map shell.
import { useEffect, useState } from 'react'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import type { EcoNode } from '../../../hooks/useEcosystem'
import { INK, INK_MUTED, getMapTheme, nodeColor } from './palette'

const STORAGE_KEY = 'mesh.agent-hud.expanded'

function loadExpanded(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === '1'
}

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

  const [expanded, setExpanded] = useState<boolean>(() => loadExpanded())
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, expanded ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [expanded])

  if (agents.length === 0) return null

  const isDark = getMapTheme() === 'dark'
  const cardBg = isDark ? 'bg-slate-900/80' : 'bg-white/90'
  const cardBorder = isDark ? 'border-slate-700' : 'border-neutral-200'
  const cardBorderHover = isDark ? 'hover:border-slate-500' : 'hover:border-neutral-300'
  const cardBorderSel = isDark ? 'border-slate-400' : 'border-neutral-400'
  const inactiveDot = isDark ? '#475569' : '#d4d4d4'
  const tabBg = isDark ? 'bg-slate-900/80' : 'bg-white/90'
  const tabBorder = isDark ? 'border-slate-700 hover:border-slate-500' : 'border-neutral-200 hover:border-neutral-300'
  const activeCount = agents.filter((a) => a.active).length

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={`pointer-events-auto absolute left-4 top-4 z-10 flex items-center gap-2 rounded-md border ${tabBorder} ${tabBg} px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em] shadow-sm backdrop-blur transition`}
        style={{ color: INK_MUTED }}
        title="Show agents"
      >
        <span>agents</span>
        <span style={{ color: INK }}>{activeCount}/{agents.length}</span>
        <ChevronRight size={12} />
      </button>
    )
  }

  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-10 w-60 select-none">
      <button
        onClick={() => setExpanded(false)}
        className="mb-2 flex w-full items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] transition"
        style={{ color: INK_MUTED }}
        title="Collapse"
      >
        <span className="flex items-center gap-1.5">
          <ChevronLeft size={12} />
          <span>agents</span>
        </span>
        <span>
          {activeCount}/{agents.length}
        </span>
      </button>
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
                `rounded-lg border ${cardBg} px-3 py-2 text-left backdrop-blur transition shadow-sm ` +
                (isSel ? cardBorderSel : `${cardBorder} ${cardBorderHover}`)
              }
              style={{ color: INK }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background: a.active ? accent : inactiveDot,
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
