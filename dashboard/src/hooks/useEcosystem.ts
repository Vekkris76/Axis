import { useEffect, useState } from 'react'

export type NodeKind = 'agent' | 'skill' | 'channel' | 'provider' | 'project'
export type EdgeType = 'parent' | 'depends_on' | 'collaborates_with' | 'serves' | 'link'

export type EcoNode = {
  id: string
  kind: NodeKind
  label: string
  sublabel?: string | null
  active: boolean
  activity?: number
  details?: {
    role?: string
    category?: string
    status?: string
    priority?: string
    owner?: string
    path?: string
    parent?: string
    usedFor?: string[]
    tools?: string[]
    dmPolicy?: string
    pairedCount?: number
    mode?: string
    model?: string
    color?: string
    memberCount?: number
    notes?: string | null
  }
}

export type EcoEdge = {
  from: string
  to: string
  active: boolean
  activity?: number
  type?: EdgeType
}

export type EcoProject = {
  id: string
  name: string
  color?: string | null
  summary?: string | null
  members: string[]
  notes?: string | null
}

export type Ecosystem = {
  nodes: EcoNode[]
  edges: EcoEdge[]
  projects?: EcoProject[]
  generatedAt: number
}

const BASE = import.meta.env.DEV ? 'https://mesh.aura-digital.org' : ''

// Primary transport: SSE — the bridge pushes snapshots whenever the
// graph changes. Polling at 5s is the automatic fallback if SSE never
// connects or drops repeatedly.
const POLL_FALLBACK_MS = 5_000

export function useEcosystem(): {
  data: Ecosystem | null
  loading: boolean
  error: string | null
} {
  const [data, setData] = useState<Ecosystem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let es: EventSource | null = null
    let pollTimer: ReturnType<typeof setTimeout> | null = null
    let usingFallback = false
    let consecutiveErrors = 0

    const startPolling = () => {
      if (cancelled || usingFallback) return
      usingFallback = true
      const poll = async () => {
        try {
          const r = await fetch(`${BASE}/api/map`, { cache: 'no-store' })
          if (!r.ok) throw new Error(`http ${r.status}`)
          const json = (await r.json()) as Ecosystem
          if (cancelled) return
          setData(json)
          setError(null)
        } catch (e) {
          if (cancelled) return
          setError(e instanceof Error ? e.message : 'unknown')
        } finally {
          if (!cancelled) {
            setLoading(false)
            pollTimer = setTimeout(poll, POLL_FALLBACK_MS)
          }
        }
      }
      poll()
    }

    const startSSE = () => {
      try {
        es = new EventSource(`${BASE}/api/map/stream`)
      } catch {
        startPolling()
        return
      }
      es.addEventListener('snapshot', (ev) => {
        consecutiveErrors = 0
        try {
          const json = JSON.parse((ev as MessageEvent).data) as Ecosystem
          if (cancelled) return
          setData(json)
          setError(null)
          setLoading(false)
        } catch {
          // ignore malformed payload — keep last good snapshot
        }
      })
      es.onerror = () => {
        consecutiveErrors += 1
        // EventSource auto-reconnects; only fall back to polling if it
        // never even managed a first message after a few retries.
        if (consecutiveErrors >= 3 && !usingFallback) {
          try {
            es?.close()
          } catch {
            /* noop */
          }
          startPolling()
        }
      }
    }

    startSSE()

    return () => {
      cancelled = true
      if (es) {
        try {
          es.close()
        } catch {
          /* noop */
        }
      }
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [])

  return { data, loading, error }
}
