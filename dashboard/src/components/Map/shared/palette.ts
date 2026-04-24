// Semantic color families for the neural map.
//
// The palette follows a single rule: nodes that play the same structural role
// in the system share a hue. Axis and Codex are the two "highlights" — every
// other node sits in a cooler, quieter band so the eye walks from center out.

import type { EcoNode, NodeKind } from '../../../hooks/useEcosystem'

// Core identity accents
export const COLOR_AXIS = 'oklch(0.87 0.16 85)' // amber — Axis only
export const COLOR_CODEX = 'oklch(0.78 0.16 320)' // magenta — OpenAI Codex

// Family tones — kept close in hue so the constellation feels unified
export const COLOR_AGENT = 'oklch(0.85 0.12 200)' // cyan
export const COLOR_PROJECT = 'oklch(0.72 0.07 55)' // warm slate
export const COLOR_SKILL = 'oklch(0.78 0.08 180)' // teal, slightly cooler
export const COLOR_PROVIDER = 'oklch(0.76 0.11 280)' // soft lavender
export const COLOR_CHANNEL = 'oklch(0.78 0.09 15)' // muted blush

// Hex equivalents for contexts that can't parse oklch (WebGL materials,
// some older Chromium builds). Kept in sync with the oklch values above.
export const HEX = {
  axis: '#f0c572',
  codex: '#c97ad0',
  agent: '#8ad9e3',
  project: '#c29a75',
  skill: '#88cfcc',
  provider: '#b59dd9',
  channel: '#d99a95',
  synapse: '#8ad9e3',
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

// Edge/connective accent used for generic synapse strokes when no family
// dominates.
export const COLOR_SYNAPSE = COLOR_AGENT

export function nodeColor(n: Pick<EcoNode, 'id' | 'kind'>): string {
  if (n.id === 'axis') return COLOR_AXIS
  if (n.id.startsWith('prov:openai-codex')) return COLOR_CODEX
  return familyColor(n.kind)
}

export function familyColor(kind: NodeKind): string {
  switch (kind) {
    case 'agent':
      return COLOR_AGENT
    case 'project':
      return COLOR_PROJECT
    case 'skill':
      return COLOR_SKILL
    case 'provider':
      return COLOR_PROVIDER
    case 'channel':
      return COLOR_CHANNEL
  }
}

// Deterministic phase in [0, 1) so halos/pulses stagger across nodes without
// being truly random — stable across renders.
export function phaseFor(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h % 1000) / 1000
}
