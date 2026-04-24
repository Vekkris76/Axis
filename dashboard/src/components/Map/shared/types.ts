// Shared types for the neural map views.
//
// The 2D view uses d3-force, so we add d3 simulation fields to EcoNode.
// The 3D view has its own numeric position state. Keeping this tiny shim in
// one place so both views import the same augmented type.

import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force'
import type { EcoNode, EcoEdge, EdgeType } from '../../../hooks/useEcosystem'

export type SimNode = EcoNode & SimulationNodeDatum & { tier: number }
export type SimLink = EcoEdge &
  SimulationLinkDatum<SimNode> & { typeSafe: EdgeType }

export function edgeType(e: EcoEdge): EdgeType {
  return (e.type as EdgeType) ?? 'link'
}
