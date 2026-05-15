// Right-side HUD panel listing all active projects with summary + member
// count. Replaces the old bottom-pill ProjectRail, which felt too cute and
// didn't match the rest of the chrome.
import type { EcoProject } from '../../../hooks/useEcosystem'
import {
  HUD_AMBER,
  HUD_BG_PANEL,
  HUD_BORDER,
  HUD_CYAN,
  HUD_TEXT,
  HUD_TEXT_DIM,
  HUD_TEXT_MUTED,
} from './palette'

export function ProjectsHUD({
  projects,
  selected,
  onSelect,
}: {
  projects: EcoProject[]
  selected: string | null
  onSelect: (nodeId: string) => void
}) {
  return (
    <div className="pointer-events-auto absolute right-4 top-20 z-10 w-72 select-none">
      <div
        className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em]"
        style={{ color: HUD_CYAN }}
      >
        <span>// projects</span>
        <span style={{ color: HUD_TEXT_MUTED }}>{projects.length}</span>
      </div>
      <div className="flex max-h-[calc(100vh-160px)] flex-col gap-1 overflow-y-auto pr-1">
        {projects.map((p) => {
          const nodeId = `project:${p.id}`
          const isSel = selected === nodeId
          const accent = p.color ?? HUD_CYAN
          return (
            <button
              key={p.id}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(nodeId)
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
                  'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2"
                  style={{
                    background: accent,
                    boxShadow: `0 0 8px ${accent}`,
                  }}
                />
                <span className="font-mono text-[11px] uppercase tracking-[0.25em]">
                  {p.name}
                </span>
                <span
                  className="ml-auto font-mono text-[9px] tracking-[0.15em]"
                  style={{ color: HUD_TEXT_MUTED }}
                >
                  {p.members.length}↗
                </span>
              </div>
              {p.summary && (
                <div
                  className="mt-1 line-clamp-2 font-mono text-[9px] leading-snug tracking-[0.04em]"
                  style={{ color: HUD_TEXT_DIM }}
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
