// Orbital layout — the semantic spine that both 2D and 3D views share.
//
// Rule: distance from the center is a function of the node's role, not its
// activity or its force-simulation whims. Axis is at the origin, agents on
// the first orbit, projects on the second, and skills/providers/channels
// form a functional periphery. Force dynamics still get to wobble the angular
// position a little so the graph feels alive, but the radius is pinned.

import type { EcoEdge, EcoNode } from '../../../hooks/useEcosystem'

export type Tier = 0 | 1 | 2 | 3

export function tierFor(node: Pick<EcoNode, 'id' | 'kind'>): Tier {
  if (node.id === 'axis') return 0
  if (node.kind === 'agent') return 1
  if (node.kind === 'project') return 2
  return 3 // skill / provider / channel
}

// Canonical 2D radii. The map viewport is 1200x800; these radii stay within
// the vertical half-height (400) so the whole constellation fits at zoom=1.
export const TIER_RADIUS_2D: Record<Tier, number> = {
  0: 0,
  1: 180,
  2: 290,
  3: 380,
}

// 3D radii live in world units (roughly 1 unit = ~40 px). Kept proportional
// to 2D so moving between views feels like zooming a camera, not jumping.
export const TIER_RADIUS_3D: Record<Tier, number> = {
  0: 0,
  1: 5.5,
  2: 10,
  3: 12.5,
}

// Slight vertical separation in 3D so tiers read as *layers* when the camera
// tilts — but not so much that it becomes a stacked pancake. Axis sits on the
// equator; everything else floats a hair above or below depending on tier
// parity.
export const TIER_Y_3D: Record<Tier, number> = {
  0: 0,
  1: 0.25,
  2: -0.4,
  3: 0.6,
}

// Count degree per node across *undirected* edges. Used as a cheap centrality
// proxy — nodes with more connections grow slightly larger and glow a bit
// stronger. Axis and projects get a floor so they don't disappear when the
// graph is sparse.
export function degreeMap(
  nodes: Pick<EcoNode, 'id' | 'kind'>[],
  edges: Pick<EcoEdge, 'from' | 'to'>[],
): Map<string, number> {
  const deg = new Map<string, number>()
  for (const n of nodes) deg.set(n.id, 0)
  for (const e of edges) {
    deg.set(e.from, (deg.get(e.from) ?? 0) + 1)
    deg.set(e.to, (deg.get(e.to) ?? 0) + 1)
  }
  return deg
}

// Normalize degree to [0, 1] per-tier so a well-connected skill doesn't
// outshine an under-connected agent. Centrality within your role, not across.
export function normalizedCentrality(
  nodes: Pick<EcoNode, 'id' | 'kind'>[],
  edges: Pick<EcoEdge, 'from' | 'to'>[],
): Map<string, number> {
  const deg = degreeMap(nodes, edges)
  const maxByTier = new Map<Tier, number>()
  for (const n of nodes) {
    const t = tierFor(n)
    const d = deg.get(n.id) ?? 0
    maxByTier.set(t, Math.max(maxByTier.get(t) ?? 1, d))
  }
  const out = new Map<string, number>()
  for (const n of nodes) {
    const t = tierFor(n)
    const d = deg.get(n.id) ?? 0
    const max = maxByTier.get(t) ?? 1
    out.set(n.id, max === 0 ? 0 : d / max)
  }
  return out
}

// Deterministic starting angle for a node. We hash the id so the layout
// survives reloads and polls. Agents spread evenly on tier 1; projects on
// tier 2; periphery gets a bias toward its parent's angle so clusters form.
export function seedAngle(
  nodeId: string,
  tier: Tier,
  parentId: string | undefined,
  angleByParent: Map<string, number>,
): number {
  if (tier === 0) return 0
  // Periphery clusters around parent
  if (tier === 3 && parentId && angleByParent.has(parentId)) {
    const base = angleByParent.get(parentId)!
    const jitter = (hash(nodeId) % 180) / 180 - 0.5 // ±0.5 rad spread
    return base + jitter
  }
  // Spread evenly on the circle but keep it deterministic
  const h = hash(nodeId)
  return (h % 10000) / 10000 * Math.PI * 2
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
