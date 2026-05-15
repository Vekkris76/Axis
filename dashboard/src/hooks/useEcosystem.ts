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

// Adaptive polling: slow baseline so the bridge isn't hammered when idle,
// fast boost when activity > BOOST_THRESHOLD so live demos feel responsive.
const BASELINE_MS = 5_000
const BOOST_MS = 1_000
const BOOST_DURATION_MS = 25_000
const BOOST_THRESHOLD = 0.3

export function useEcosystem(pollMs?: number): {
  data: Ecosystem | null
  loading: boolean
  error: string | null
} {
  const [data, setData] = useState<Ecosystem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let boostUntil = 0

    const schedule = (delay: number) => {
      if (cancelled) return
      timer = setTimeout(poll, delay)
    }

    const poll = async () => {
      try {
        const r = await fetch(`${BASE}/api/map`, { cache: 'no-store' })
        if (!r.ok) throw new Error(`http ${r.status}`)
        const json = (await r.json()) as Ecosystem
        if (cancelled) return
        setData(json)
        setError(null)

        const hot = json.nodes.some((n) => (n.activity ?? 0) > BOOST_THRESHOLD)
        if (hot) boostUntil = Date.now() + BOOST_DURATION_MS
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'unknown')
      } finally {
        if (!cancelled) {
          setLoading(false)
          const fixed = pollMs
          const next =
            fixed != null
              ? fixed
              : Date.now() < boostUntil
                ? BOOST_MS
                : BASELINE_MS
          schedule(next)
        }
      }
    }

    poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [pollMs])

  return { data, loading, error }
}
