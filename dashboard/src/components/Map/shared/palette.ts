// Light-mode palette for the neural map.
//
// Canvas is white. Node cores are charcoal so they read as solid marks on
// paper. Each family gets a pastel halo that only hints at identity — no
// saturated color competes with the structure. Axis and OpenAI Codex keep
// their own pastel so the eye can still find the two anchor nodes.

import type { EcoNode, NodeKind } from '../../../hooks/useEcosystem'

// Node core — grayscale ladder that walks from center outward.
// Axis is almost black; agents, projects, and periphery each get their own
// gray shade so the hierarchy is legible even without the pastel halos.
export const CORE_AXIS = '#1a1a14' // near-black with a warm tint
export const CORE_AGENT = '#333333'
export const CORE_PROJECT = '#5a5a5a'
export const CORE_PERIPHERY = '#8a8a8a'

// Backwards-compat alias — used by a few callers before the grayscale split.
export const CORE_DARK = CORE_AGENT

// Pastel family halos — low chroma, high lightness; picked to register on
// pure white without shouting.
export const HALO_AXIS = '#efc660' // warm gold — Axis is the supreme node
export const HALO_CODEX = '#d8a6e0' // lilac
export const HALO_AGENT = '#9ccfde' // sky
export const HALO_PROJECT = '#e8c89d' // sand
export const HALO_SKILL = '#9cd9b5' // mint
export const HALO_PROVIDER = '#b89ed9' // lavender
export const HALO_CHANNEL = '#eaa8a8' // blush

// Deeper gold reserved for Axis-specific accents (extra outer trace, label
// dot, 3D crown). Used sparingly so "supreme" still reads.
export const GOLD_DEEP = '#c89228'
// Focus gold — lighter, more visible on white; used when the user is
// hovering/selecting a node to mark connections to and from it.
export const GOLD_FOCUS = '#d9a13a'

// Neutral tones for edges, text, chrome
export const INK = '#1f1f1f'
export const INK_MUTED = '#6b6b6b'
export const INK_LINE = '#b8b8b8'
export const BG = '#ffffff'

// Legacy aliases so existing callers keep working.
export const COLOR_AXIS = HALO_AXIS
export const COLOR_CODEX = HALO_CODEX
export const COLOR_AGENT = HALO_AGENT
export const COLOR_PROJECT = HALO_PROJECT
export const COLOR_SKILL = HALO_SKILL
export const COLOR_PROVIDER = HALO_PROVIDER
export const COLOR_CHANNEL = HALO_CHANNEL
export const COLOR_SYNAPSE = INK_LINE

// nodeColor returns the halo / pastel accent. For the solid dark mark, use
// nodeCore.
export function nodeColor(n: Pick<EcoNode, 'id' | 'kind'>): string {
  if (n.id === 'axis') return HALO_AXIS
  if (n.id.startsWith('prov:openai-codex')) return HALO_CODEX
  return familyColor(n.kind)
}

export function nodeCore(n: Pick<EcoNode, 'id' | 'kind'>): string {
  if (n.id === 'axis') return CORE_AXIS
  if (n.kind === 'agent') return CORE_AGENT
  if (n.kind === 'project') return CORE_PROJECT
  return CORE_PERIPHERY
}

export function familyColor(kind: NodeKind): string {
  switch (kind) {
    case 'agent':
      return HALO_AGENT
    case 'project':
      return HALO_PROJECT
    case 'skill':
      return HALO_SKILL
    case 'provider':
      return HALO_PROVIDER
    case 'channel':
      return HALO_CHANNEL
  }
}

// Single map used by 3D materials — they need concrete hex values.
export const HEX = {
  axis: HALO_AXIS,
  axisGold: GOLD_DEEP,
  focusGold: GOLD_FOCUS,
  codex: HALO_CODEX,
  agent: HALO_AGENT,
  project: HALO_PROJECT,
  skill: HALO_SKILL,
  provider: HALO_PROVIDER,
  channel: HALO_CHANNEL,
  synapse: INK_LINE,
  coreAxis: CORE_AXIS,
  coreAgent: CORE_AGENT,
  coreProject: CORE_PROJECT,
  corePeriphery: CORE_PERIPHERY,
  coreDark: CORE_DARK,
  ink: INK,
  inkMuted: INK_MUTED,
  bg: BG,
} as const

export function nodeHex(n: { id: string; kind: string }): string {
  if (n.id === 'axis') return HEX.axis
  if (n.id.startsWith('prov:openai-codex')) return HEX.codex
  switch (n.kind) {
    case 'agent':
      return HEX.agent
    case 'project':
      return HEX.project
    case 'skill':
      return HEX.skill
    case 'provider':
      return HEX.provider
    case 'channel':
      return HEX.channel
    default:
      return HEX.agent
  }
}

export function nodeCoreHex(n: { id: string; kind: string }): string {
  if (n.id === 'axis') return HEX.coreAxis
  if (n.kind === 'agent') return HEX.coreAgent
  if (n.kind === 'project') return HEX.coreProject
  return HEX.corePeriphery
}

// Edge color is a function of the two nodes it connects — not of the edge
// type. The precedence rule follows the hierarchy of the map: anything
// touching Axis is gold, anything else touching a project is sand, anything
// between agents is sky; purely peripheral lines fall to neutral gray.
export function edgeColor(aKind: string, aId: string, bKind: string, bId: string): string {
  if (aId === 'axis' || bId === 'axis') return GOLD_DEEP
  if (aKind === 'project' || bKind === 'project') return HALO_PROJECT
  if (aKind === 'agent' || bKind === 'agent') return HALO_AGENT
  return INK_LINE
}

// Deterministic phase in [0, 1) so halos/pulses stagger across nodes without
// being truly random — stable across renders.
export function phaseFor(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h % 1000) / 1000
}
