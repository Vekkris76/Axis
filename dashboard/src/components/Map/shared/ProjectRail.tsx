import type { EcoProject } from '../../../hooks/useEcosystem'
import { HALO_PROJECT, INK, INK_MUTED } from './palette'

export function ProjectRail({
  projects,
  selected,
  onSelect,
}: {
  projects: EcoProject[]
  selected: string | null
  onSelect: (nodeId: string) => void
}) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-0 right-0 flex justify-center">
      <div className="pointer-events-auto flex max-w-full gap-2 overflow-x-auto px-4 py-2">
        {projects.map((p) => {
          const nodeId = `project:${p.id}`
          const active = selected === nodeId
          return (
            <button
              key={p.id}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(nodeId)
              }}
              className={
                'flex items-center gap-2 rounded-full border bg-white/90 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] backdrop-blur transition '
              }
              style={{
                color: active ? INK : INK_MUTED,
                borderColor: active ? INK_MUTED : '#e5e5e5',
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: p.color ?? HALO_PROJECT }}
              />
              <span>{p.name}</span>
              <span className="opacity-60">· {p.members.length}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
