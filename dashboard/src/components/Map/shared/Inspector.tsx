// Inspector — compact HUD card at the bottom of the canvas. Shows the
// selected/hovered node with richer info than before: header glyph,
// kind, status, summary, linked projects (for agents) or member chips
// (for projects).
import { motion } from 'framer-motion'
import type { EcoNode, EcoProject } from '../../../hooks/useEcosystem'
import {
  HUD_AMBER,
  HUD_BG_PANEL,
  HUD_BORDER,
  HUD_BORDER_BRIGHT,
  HUD_CYAN,
  HUD_TEXT,
  HUD_TEXT_DIM,
  HUD_TEXT_MUTED,
  nodeColor,
} from './palette'

function memberLabel(id: string, nodes: EcoNode[]): string {
  const n = nodes.find((x) => x.id === id)
  return n?.label ?? id
}

export function Inspector({
  node,
  projects,
  nodes,
}: {
  node: EcoNode
  projects: EcoProject[]
  nodes: EcoNode[]
}) {
  const accent = nodeColor(node)
  const memberOf = projects.filter((p) => p.members.includes(node.id))
  const isProject = node.kind === 'project'
  const ownProject = isProject
    ? projects.find((p) => `project:${p.id}` === node.id) ?? null
    : null

  const usedFor =
    node.details?.usedFor && node.details.usedFor.length > 0
      ? node.details.usedFor.slice(0, 4).join(' · ')
      : null

  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="pointer-events-none absolute bottom-4 left-1/2 z-10 w-[min(640px,calc(100%-2rem))] -translate-x-1/2 select-none"
      style={{ color: HUD_TEXT }}
    >
      <div
        className="relative px-5 py-4"
        style={{
          background: `${HUD_BG_PANEL}f0`,
          border: `1px solid ${HUD_BORDER_BRIGHT}`,
          clipPath:
            'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
          boxShadow: `0 0 24px rgba(0, 230, 255, 0.08)`,
        }}
      >
        {/* Header row */}
        <div className="flex items-baseline gap-3">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.3em]"
            style={{ color: HUD_CYAN }}
          >
            {node.kind}
          </span>
          <span
            className="h-1.5 w-1.5"
            style={{
              background: node.active ? HUD_AMBER : HUD_TEXT_MUTED,
              boxShadow: node.active ? `0 0 6px ${HUD_AMBER}` : 'none',
            }}
          />
          {node.details?.status && (
            <span
              className="font-mono text-[9px] uppercase tracking-[0.22em]"
              style={{ color: HUD_TEXT_MUTED }}
            >
              {node.details.status}
            </span>
          )}
          <span className="ml-auto font-mono text-[9px] tracking-[0.15em]" style={{ color: HUD_TEXT_MUTED }}>
            id: {node.id}
          </span>
        </div>

        {/* Title */}
        <div
          className="mt-2 font-mono text-[20px] uppercase tracking-[0.18em]"
          style={{ color: accent, textShadow: `0 0 10px ${accent}66` }}
        >
          {node.label}
        </div>

        {/* Summary line */}
        {(ownProject?.summary || node.sublabel) && (
          <div
            className="mt-1 font-mono text-[11px] leading-snug tracking-[0.04em]"
            style={{ color: HUD_TEXT_DIM }}
          >
            {ownProject?.summary || node.sublabel}
          </div>
        )}

        {/* Used-for line (mostly agents) */}
        {usedFor && (
          <div
            className="mt-2 font-mono text-[9px] uppercase tracking-[0.18em]"
            style={{ color: HUD_TEXT_MUTED }}
          >
            {usedFor}
          </div>
        )}

        {/* For a project: list its members */}
        {ownProject && ownProject.members.length > 0 && (
          <div className="mt-3">
            <div
              className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em]"
              style={{ color: HUD_TEXT_MUTED }}
            >
              members · {ownProject.members.length}
            </div>
            <div className="flex flex-wrap gap-1">
              {ownProject.members.map((mid) => (
                <span
                  key={mid}
                  className="font-mono text-[9px] uppercase tracking-[0.18em]"
                  style={{
                    color: HUD_TEXT_DIM,
                    border: `1px solid ${HUD_BORDER}`,
                    padding: '2px 6px',
                  }}
                >
                  {memberLabel(mid, nodes)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* For a non-project node: list the projects that contain it */}
        {!isProject && memberOf.length > 0 && (
          <div className="mt-3">
            <div
              className="mb-1 font-mono text-[9px] uppercase tracking-[0.22em]"
              style={{ color: HUD_TEXT_MUTED }}
            >
              in · {memberOf.length}
            </div>
            <div className="flex flex-wrap gap-1">
              {memberOf.map((p) => (
                <span
                  key={p.id}
                  className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.18em]"
                  style={{
                    color: HUD_TEXT_DIM,
                    border: `1px solid ${HUD_BORDER}`,
                    padding: '2px 6px',
                  }}
                >
                  <span
                    className="h-1 w-1"
                    style={{ background: p.color ?? accent }}
                  />
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes (long-form) */}
        {ownProject?.notes && (
          <div
            className="mt-3 border-l-2 pl-3 font-mono text-[10px] leading-relaxed tracking-[0.03em]"
            style={{ color: HUD_TEXT_DIM, borderColor: HUD_BORDER }}
          >
            {ownProject.notes}
          </div>
        )}
      </div>
    </motion.div>
  )
}
