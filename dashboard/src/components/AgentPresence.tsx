import { motion } from 'framer-motion'
import type { ComponentType } from 'react'

type Props = {
  name: string
  Mark: ComponentType<{ className?: string }>
  state: 'idle' | 'thinking' | 'responding' | 'offline'
  activity?: number
}

export function AgentPresence({ name, Mark, state, activity = 0 }: Props) {
  const isAlive = state !== 'offline'
  // Bimodal: idle = very slow & faint (alive but calm); active = clear pulse.
  const isHitting = activity > 0.05
  const haloDuration = isHitting ? Math.max(1.5, 3.5 - activity * 2) : 14
  const orbDuration = isHitting ? Math.max(1.5, 3 - activity * 1.5) : 10
  const haloIntensityLow = isHitting ? 0.55 : 0.25
  const haloIntensityHigh = isHitting ? 0.85 + activity * 0.1 : 0.35

  return (
    <div className="relative flex flex-col items-center gap-8">
      {/* outer halo */}
      <motion.div
        className="absolute h-[420px] w-[420px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, oklch(0.85 0.12 200 / 0.12) 0%, transparent 60%)',
        }}
        animate={isAlive ? { scale: [1, isHitting ? 1.06 + activity * 0.05 : 1.015, 1], opacity: [haloIntensityLow, haloIntensityHigh, haloIntensityLow] } : {}}
        transition={{ duration: haloDuration, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* orbital ring */}
      <motion.div
        className="absolute h-[300px] w-[300px] rounded-full border border-hangar-accent/20"
        animate={isAlive ? { rotate: 360 } : {}}
        transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}
        style={{
          borderTopColor: 'oklch(0.85 0.12 200 / 0.6)',
        }}
      />

      {/* inner ring */}
      <motion.div
        className="absolute h-[220px] w-[220px] rounded-full border border-hangar-accent/15"
        animate={isAlive ? { rotate: -360 } : {}}
        transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
      />

      {/* core orb with mark */}
      <motion.div
        className="frosted relative flex h-44 w-44 items-center justify-center rounded-full text-hangar-accent"
        animate={
          isAlive
            ? { boxShadow: isHitting
                ? [
                    `0 0 60px oklch(0.85 0.12 200 / ${0.3 + activity * 0.2}), inset 0 0 40px oklch(0.85 0.12 200 / ${0.15 + activity * 0.1})`,
                    `0 0 110px oklch(0.85 0.12 200 / ${0.55 + activity * 0.3}), inset 0 0 70px oklch(0.85 0.12 200 / ${0.3 + activity * 0.2})`,
                    `0 0 60px oklch(0.85 0.12 200 / ${0.3 + activity * 0.2}), inset 0 0 40px oklch(0.85 0.12 200 / ${0.15 + activity * 0.1})`,
                  ]
                : [
                    '0 0 50px oklch(0.85 0.12 200 / 0.15), inset 0 0 30px oklch(0.85 0.12 200 / 0.06)',
                    '0 0 60px oklch(0.85 0.12 200 / 0.22), inset 0 0 35px oklch(0.85 0.12 200 / 0.1)',
                    '0 0 50px oklch(0.85 0.12 200 / 0.15), inset 0 0 30px oklch(0.85 0.12 200 / 0.06)',
                  ]}
            : {}
        }
        transition={{ duration: orbDuration, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Mark className="h-24 w-24 drop-shadow-[0_0_8px_oklch(0.85_0.12_200_/_0.6)]" />
      </motion.div>

      {/* name + state below the orb */}
      <div className="relative top-24 flex flex-col items-center gap-2">
        <h1 className="font-sans text-3xl font-light tracking-wide text-hangar-text">
          {name}
        </h1>
        <div className="flex items-center gap-2">
          <span
            className={
              'h-1.5 w-1.5 rounded-full ' +
              (isAlive ? 'bg-hangar-accent shadow-[0_0_8px_currentColor]' : 'bg-hangar-muted')
            }
          />
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-hangar-muted">
            {state}
          </span>
        </div>
      </div>
    </div>
  )
}
