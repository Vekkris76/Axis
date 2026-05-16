// Dual-theme palette for the neural map.
//
// All exported constants are `let` so this module can swap them when the user
// toggles light/dark. ES module bindings are live: importers and functions
// inside this file always see the current value. After `setMapTheme()` swaps
// them, components must re-render to repaint — MapView re-mounts the views
// via key={theme} for that.

import type { EcoNode, NodeKind } from '../../../hooks/useEcosystem'

export type MapTheme = 'light' | 'dark'

const STORAGE_KEY = 'mesh.map-theme'

// ---------------------------------------------------------------------------
// Theme palettes
// ---------------------------------------------------------------------------

type Palette = {
  // Core fills (deep tints, recognisable family identity)
  CORE_AXIS: string
  CORE_AGENT: string
  CORE_PROJECT: string
  CORE_SKILL: string
  CORE_PROVIDER: string
  CORE_CHANNEL: string
  CORE_PERIPHERY: string
  // Halos (saturated family colors)
  HALO_AXIS: string
  HALO_CODEX: string
  HALO_AGENT: string
  HALO_PROJECT: string
  HALO_SKILL: string
  HALO_PROVIDER: string
  HALO_CHANNEL: string
  // Axis accents
  GOLD_DEEP: string
  GOLD_FOCUS: string
  // Chrome
  INK: string
  INK_MUTED: string
  INK_LINE: string
  BG: string
}

const LIGHT: Palette = {
  // Cores tinted with family color, dark enough to read on white
  CORE_AXIS: '#1a1a14',
  CORE_AGENT: '#1e3a5f',
  CORE_PROJECT: '#6b1d1d',
  CORE_SKILL: '#0d4f3a',
  CORE_PROVIDER: '#3b1f6b',
  CORE_CHANNEL: '#6b1d4a',
  CORE_PERIPHERY: '#5a5a5a',
  HALO_AXIS: '#f59e0b',
  HALO_CODEX: '#a855f7',
  HALO_AGENT: '#3b82f6',
  HALO_PROJECT: '#ef4444',
  HALO_SKILL: '#10b981',
  HALO_PROVIDER: '#8b5cf6',
  HALO_CHANNEL: '#ec4899',
  GOLD_DEEP: '#c89228',
  GOLD_FOCUS: '#d9a13a',
  INK: '#1f1f1f',
  INK_MUTED: '#6b6b6b',
  INK_LINE: '#b8b8b8',
  BG: '#ffffff',
}

const DARK: Palette = {
  // Cores at Tailwind 400-level — vibrant solid fills so the node identity
  // pops on slate-950 bg. Agents are the lead. Projects use a deeper,
  // grounded red so they read as containers, not dominant marks.
  CORE_AXIS: '#fbbf24',
  CORE_AGENT: '#60a5fa',
  CORE_PROJECT: '#c0a890',
  CORE_SKILL: '#34d399',
  CORE_PROVIDER: '#a78bfa',
  CORE_CHANNEL: '#f472b6',
  CORE_PERIPHERY: '#9aa3b8',
  // Halos two notches darker than light theme (Tailwind 700-level). They
  // give just enough family identity around each node without competing
  // with the brighter tinted core — the core stays the visual lead.
  HALO_AXIS: '#b45309',
  HALO_CODEX: '#7e22ce',
  HALO_AGENT: '#1d4ed8',
  HALO_PROJECT: '#b91c1c',
  HALO_SKILL: '#047857',
  HALO_PROVIDER: '#6d28d9',
  HALO_CHANNEL: '#be185d',
  GOLD_DEEP: '#8a5820',
  GOLD_FOCUS: '#a86d2e',
  INK: '#e6e8ee',
  INK_MUTED: '#94a0b6',
  INK_LINE: '#3a4458',
  BG: '#0a0e1a',
}

// ---------------------------------------------------------------------------
// Active theme + setter
// ---------------------------------------------------------------------------

function readInitial(): MapTheme {
  if (typeof localStorage === 'undefined') return 'dark'
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' ? 'light' : 'dark'
}

let activeTheme: MapTheme = readInitial()
let active: Palette = activeTheme === 'dark' ? DARK : LIGHT

// All exports below are `let` so setMapTheme() can swap them. Importers see
// live bindings; functions in this module re-read on each call.

export let CORE_AXIS = active.CORE_AXIS
export let CORE_AGENT = active.CORE_AGENT
export let CORE_PROJECT = active.CORE_PROJECT
export let CORE_SKILL = active.CORE_SKILL
export let CORE_PROVIDER = active.CORE_PROVIDER
export let CORE_CHANNEL = active.CORE_CHANNEL
export let CORE_PERIPHERY = active.CORE_PERIPHERY
export let CORE_DARK = active.CORE_AGENT // legacy alias

export let HALO_AXIS = active.HALO_AXIS
export let HALO_CODEX = active.HALO_CODEX
export let HALO_AGENT = active.HALO_AGENT
export let HALO_PROJECT = active.HALO_PROJECT
export let HALO_SKILL = active.HALO_SKILL
export let HALO_PROVIDER = active.HALO_PROVIDER
export let HALO_CHANNEL = active.HALO_CHANNEL

export let GOLD_DEEP = active.GOLD_DEEP
export let GOLD_FOCUS = active.GOLD_FOCUS

export let INK = active.INK
export let INK_MUTED = active.INK_MUTED
export let INK_LINE = active.INK_LINE
export let BG = active.BG

// Legacy aliases — kept for callers that pre-date the HALO_* split.
export let COLOR_AXIS = active.HALO_AXIS
export let COLOR_CODEX = active.HALO_CODEX
export let COLOR_AGENT = active.HALO_AGENT
export let COLOR_PROJECT = active.HALO_PROJECT
export let COLOR_SKILL = active.HALO_SKILL
export let COLOR_PROVIDER = active.HALO_PROVIDER
export let COLOR_CHANNEL = active.HALO_CHANNEL
export let COLOR_SYNAPSE = active.INK_LINE

// HEX is reassigned to a fresh object on theme change so 3D materials reading
// `HEX.axis` etc. always see the current values.
export let HEX = buildHex(active)

function buildHex(p: Palette) {
  return {
    axis: p.HALO_AXIS,
    axisGold: p.GOLD_DEEP,
    focusGold: p.GOLD_FOCUS,
    codex: p.HALO_CODEX,
    agent: p.HALO_AGENT,
    project: p.HALO_PROJECT,
    skill: p.HALO_SKILL,
    provider: p.HALO_PROVIDER,
    channel: p.HALO_CHANNEL,
    synapse: p.INK_LINE,
    coreAxis: p.CORE_AXIS,
    coreAgent: p.CORE_AGENT,
    coreProject: p.CORE_PROJECT,
    coreSkill: p.CORE_SKILL,
    coreProvider: p.CORE_PROVIDER,
    coreChannel: p.CORE_CHANNEL,
    corePeriphery: p.CORE_PERIPHERY,
    coreDark: p.CORE_AGENT,
    ink: p.INK,
    inkMuted: p.INK_MUTED,
    bg: p.BG,
  }
}

export function getMapTheme(): MapTheme {
  return activeTheme
}

export function setMapTheme(t: MapTheme): void {
  if (t === activeTheme) return
  activeTheme = t
  active = t === 'dark' ? DARK : LIGHT
  // Reassign every let export so live bindings update everywhere.
  CORE_AXIS = active.CORE_AXIS
  CORE_AGENT = active.CORE_AGENT
  CORE_PROJECT = active.CORE_PROJECT
  CORE_SKILL = active.CORE_SKILL
  CORE_PROVIDER = active.CORE_PROVIDER
  CORE_CHANNEL = active.CORE_CHANNEL
  CORE_PERIPHERY = active.CORE_PERIPHERY
  CORE_DARK = active.CORE_AGENT
  HALO_AXIS = active.HALO_AXIS
  HALO_CODEX = active.HALO_CODEX
  HALO_AGENT = active.HALO_AGENT
  HALO_PROJECT = active.HALO_PROJECT
  HALO_SKILL = active.HALO_SKILL
  HALO_PROVIDER = active.HALO_PROVIDER
  HALO_CHANNEL = active.HALO_CHANNEL
  GOLD_DEEP = active.GOLD_DEEP
  GOLD_FOCUS = active.GOLD_FOCUS
  INK = active.INK
  INK_MUTED = active.INK_MUTED
  INK_LINE = active.INK_LINE
  BG = active.BG
  COLOR_AXIS = active.HALO_AXIS
  COLOR_CODEX = active.HALO_CODEX
  COLOR_AGENT = active.HALO_AGENT
  COLOR_PROJECT = active.HALO_PROJECT
  COLOR_SKILL = active.HALO_SKILL
  COLOR_PROVIDER = active.HALO_PROVIDER
  COLOR_CHANNEL = active.HALO_CHANNEL
  COLOR_SYNAPSE = active.INK_LINE
  HEX = buildHex(active)
  try {
    localStorage.setItem(STORAGE_KEY, t)
  } catch {
    /* noop */
  }
}

// ---------------------------------------------------------------------------
// Helpers (functions re-read the let bindings on each call)
// ---------------------------------------------------------------------------

export function nodeColor(n: Pick<EcoNode, 'id' | 'kind'>): string {
  if (n.id === 'axis') return HALO_AXIS
  if (n.id.startsWith('prov:openai-codex')) return HALO_CODEX
  return familyColor(n.kind)
}

export function nodeCore(n: Pick<EcoNode, 'id' | 'kind'>): string {
  if (n.id === 'axis') return CORE_AXIS
  switch (n.kind) {
    case 'agent': return CORE_AGENT
    case 'project': return CORE_PROJECT
    case 'skill': return CORE_SKILL
    case 'provider': return CORE_PROVIDER
    case 'channel': return CORE_CHANNEL
    default: return CORE_PERIPHERY
  }
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
  switch (n.kind) {
    case 'agent': return HEX.coreAgent
    case 'project': return HEX.coreProject
    case 'skill': return HEX.coreSkill
    case 'provider': return HEX.coreProvider
    case 'channel': return HEX.coreChannel
    default: return HEX.corePeriphery
  }
}

export function edgeColor(aKind: string, aId: string, bKind: string, bId: string): string {
  if (aId === 'axis' || bId === 'axis') return GOLD_DEEP
  if (aKind === 'project' || bKind === 'project') return HALO_PROJECT
  if (aKind === 'agent' || bKind === 'agent') return HALO_AGENT
  return INK_LINE
}

export function phaseFor(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h % 1000) / 1000
}
