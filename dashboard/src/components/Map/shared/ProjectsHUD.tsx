// Right-side panel — lists every active project with its colour dot, name,
// member count, and summary. Light theme to match the map shell.
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { EcoProject } from '../../../hooks/useEcosystem'
import { HALO_PROJECT, INK, INK_MUTED, getMapTheme } from './palette'

const STORAGE_KEY = 'mesh.projects-hud.expanded'

function loadExpanded(): boolean {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY) === '1'
}

// All projects share HALO_PROJECT so the family is visually unified;
// per-project hex colours are ignored here on purpose (user request).

export function ProjectsHUD({
  projects,
  selected,
  onSelect,
}: {
  projects: EcoProject[]
  selected: string | null
  onSelect: (nodeId: string) => void
}) {
  const [expanded, setExpanded] = useState<boolean>(() => loadExpanded())
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, expanded ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [expanded])

  if (projects.length === 0) return null

  const isDark = getMapTheme() === 'dark'
  const cardBg = isDark ? 'bg-slate-900/80' : 'bg-white/90'
  const cardBorder = isDark ? 'border-slate-700' : 'border-neutral-200'
  const cardBorderHover = isDark ? 'hover:border-slate-500' : 'hover:border-neutral-300'
  const cardBorderSel = isDark ? 'border-slate-400' : 'border-neutral-400'
  const tabBg = isDark ? 'bg-slate-900/80' : 'bg-white/90'
  const tabBorder = isDark ? 'border-slate-700 hover:border-slate-500' : 'border-neutral-200 hover:border-neutral-300'

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={`pointer-events-auto absolute right-4 top-4 z-10 flex items-center gap-2 rounded-md border ${tabBorder} ${tabBg} px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em] shadow-sm backdrop-blur transition`}
        style={{ color: INK_MUTED }}
        title="Show projects"
      >
        <ChevronLeft size={12} />
        <span>projects</span>
        <span style={{ color: INK }}>{projects.length}</span>
      </button>
    )
  }

  return (
    <div className="pointer-events-auto absolute right-4 top-4 z-10 w-64 select-none">
      <button
        onClick={() => setExpanded(false)}
        className="mb-2 flex w-full items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] transition"
        style={{ color: INK_MUTED }}
        title="Collapse"
      >
        <span>projects</span>
        <span className="flex items-center gap-1.5">
          <span>{projects.length}</span>
          <ChevronRight size={12} />
        </span>
      </button>
      <div className="flex max-h-[calc(100vh-120px)] flex-col gap-1.5 overflow-y-auto pr-1">
        {projects.map((p) => {
          const nodeId = `project:${p.id}`
          const isSel = selected === nodeId
          const accent = HALO_PROJECT // unified family colour
          return (
            <button
              key={p.id}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(nodeId)
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
                    background: accent,
                    boxShadow: `0 0 6px ${accent}`,
                  }}
                />
                <span className="font-mono text-[11px] uppercase tracking-[0.22em]">
                  {p.name}
                </span>
                <span
                  className="ml-auto font-mono text-[9px] tracking-[0.12em]"
                  style={{ color: INK_MUTED }}
                >
                  {p.members.length}↗
                </span>
              </div>
              {p.summary && (
                <div
                  className="mt-1 line-clamp-2 font-mono text-[9px] leading-snug tracking-[0.04em]"
                  style={{ color: INK_MUTED }}
                >
                  {p.summary}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
