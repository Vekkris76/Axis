import clsx from 'clsx'

type Props = {
  label: string
  value: string
  mono?: boolean
  tone?: 'neutral' | 'accent'
}

export function StatusPanel({ label, value, mono = false, tone = 'neutral' }: Props) {
  return (
    <div className="frosted flex flex-col gap-2 rounded-xl px-5 py-4">
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-hangar-muted">
        {label}
      </span>
      <span
        className={clsx(
          'text-base font-light',
          mono ? 'font-mono text-sm' : 'font-sans',
          tone === 'accent' ? 'text-hangar-accent' : 'text-hangar-text',
        )}
      >
        {value}
      </span>
    </div>
  )
}
