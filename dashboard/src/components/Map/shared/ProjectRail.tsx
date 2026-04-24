import type { EcoProject } from '../../../hooks/useEcosystem'

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
                'frosted flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] transition ' +
                (active
                  ? 'text-hangar-text shadow-[0_0_10px_oklch(0.85_0.12_200_/_0.25)]'
                  : 'text-hangar-muted hover:text-hangar-text')
              }
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: p.color ?? 'oklch(0.85 0.12 200)' }}
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
