import type { ReactNode } from 'react'

type Props = { now: Date; rightSlot?: ReactNode }

export function TopBar({ now, rightSlot }: Props) {
  const time = now.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/Madrid',
  })
  const date = now.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'Europe/Madrid',
  })

  return (
    <header className="flex items-center justify-between border-b border-hangar-border/40 px-12 py-6">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-hangar-accent">
          Mesh
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-hangar-muted">
          / Auratech
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-hangar-muted">
          {date}
        </span>
        <span className="font-mono text-sm tracking-[0.15em] text-hangar-text">
          {time}
        </span>
        {rightSlot}
      </div>
    </header>
  )
}
