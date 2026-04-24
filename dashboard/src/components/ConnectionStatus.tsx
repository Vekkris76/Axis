type Props = { connected: boolean; note?: string }

export function ConnectionStatus({ connected, note }: Props) {
  return (
    <footer className="flex items-center justify-between border-t border-hangar-border/40 px-12 py-3">
      <div className="flex items-center gap-2">
        <span
          className={
            'h-1.5 w-1.5 rounded-full ' +
            (connected
              ? 'bg-hangar-accent shadow-[0_0_6px_currentColor]'
              : 'bg-hangar-muted/60')
          }
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-hangar-muted">
          {connected ? 'gateway conectado' : 'gateway desconectado'}
        </span>
        {note && (
          <span className="font-mono text-[10px] tracking-wide text-hangar-muted/60">
            · {note}
          </span>
        )}
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-hangar-muted/60">
        v0.1
      </span>
    </footer>
  )
}
