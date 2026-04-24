import { useEffect, useState } from 'react'

type Health = {
  connected: boolean
  lastCheck: Date | null
  latencyMs: number | null
}

const HEALTH_URL = import.meta.env.DEV
  ? 'https://mesh.aura-digital.org/api/healthz'
  : '/api/healthz'

export function useGatewayHealth(intervalMs = 5000): Health {
  const [state, setState] = useState<Health>({
    connected: false,
    lastCheck: null,
    latencyMs: null,
  })

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      const t0 = performance.now()
      try {
        const r = await fetch(HEALTH_URL, { cache: 'no-store' })
        const latency = Math.round(performance.now() - t0)
        if (cancelled) return
        setState({
          connected: r.ok,
          lastCheck: new Date(),
          latencyMs: latency,
        })
      } catch {
        if (cancelled) return
        setState((s) => ({ ...s, connected: false, lastCheck: new Date() }))
      }
    }

    poll()
    const id = setInterval(poll, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [intervalMs])

  return state
}
