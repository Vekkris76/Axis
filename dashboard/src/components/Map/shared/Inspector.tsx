import { motion } from 'framer-motion'
import type { EcoNode, EcoProject } from '../../../hooks/useEcosystem'
import { HALO_PROJECT, INK, INK_MUTED, getMapTheme, nodeColor } from './palette'

export function Inspector({
  node,
  projects,
}: {
  node: EcoNode
  projects: EcoProject[]
}) {
  const memberOf = projects.filter((p) => p.members.includes(node.id))
  const accent = nodeColor(node)
  const isDark = getMapTheme() === 'dark'
  const cardBg = isDark ? 'bg-slate-900/85' : 'bg-white/90'
  const cardBorder = isDark ? 'border-slate-700' : 'border-neutral-200'
  const chipBorder = isDark ? 'border-slate-700' : 'border-neutral-200'
  const inactiveDot = isDark ? '#475569' : '#d4d4d4'
  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`pointer-events-none absolute bottom-4 left-1/2 max-w-md -translate-x-1/2 rounded-xl border ${cardBorder} ${cardBg} px-5 py-4 shadow-sm backdrop-blur`}
      style={{ color: INK }}
    >
      <div className="mb-1 flex items-center gap-2">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.25em]"
          style={{ color: INK_MUTED }}
        >
          {node.kind}
        </span>
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: node.active ? accent : inactiveDot }}
        />
      </div>
      <div className="font-sans text-lg" style={{ color: INK }}>
        {node.label}
      </div>
      {node.sublabel && (
        <div className="font-mono text-xs" style={{ color: INK_MUTED }}>
          {node.sublabel}
        </div>
      )}
      {node.details?.status && (
        <div
          className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: INK_MUTED }}
        >
          {node.details.status}
        </div>
      )}
      {memberOf.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {memberOf.map((p) => (
            <span
              key={p.id}
              className={`flex items-center gap-1 rounded-full border ${chipBorder} px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em]`}
              style={{ color: INK_MUTED }}
            >
              <span
                className="h-1 w-1 rounded-full"
                style={{ background: HALO_PROJECT }}
              />
              {p.name}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )
}
