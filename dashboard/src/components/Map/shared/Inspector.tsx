import { motion } from 'framer-motion'
import type { EcoNode, EcoProject } from '../../../hooks/useEcosystem'

export function Inspector({
  node,
  projects,
}: {
  node: EcoNode
  projects: EcoProject[]
}) {
  const memberOf = projects.filter((p) => p.members.includes(node.id))
  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="frosted pointer-events-none absolute top-4 left-4 max-w-xs rounded-xl px-5 py-4"
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-hangar-muted">
          {node.kind}
        </span>
        <span
          className={
            'h-1.5 w-1.5 rounded-full ' +
            (node.active
              ? 'bg-hangar-accent shadow-[0_0_6px_currentColor]'
              : 'bg-hangar-muted/60')
          }
        />
      </div>
      <div className="font-sans text-lg text-hangar-text">{node.label}</div>
      {node.sublabel && (
        <div className="font-mono text-xs text-hangar-muted">
          {node.sublabel}
        </div>
      )}
      {node.details?.status && (
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-hangar-muted">
          {node.details.status}
        </div>
      )}
      {memberOf.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {memberOf.map((p) => (
            <span
              key={p.id}
              className="flex items-center gap-1 rounded-full border border-hangar-border/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-hangar-muted"
            >
              <span
                className="h-1 w-1 rounded-full"
                style={{ background: p.color ?? 'oklch(0.85 0.12 200)' }}
              />
              {p.name}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  )
}
