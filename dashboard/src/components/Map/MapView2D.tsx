// Neural map — 2D view.
//
// Layout: semantic orbits. Axis sits at the origin, agents on the first ring,
// projects on the second, and skills/providers/channels live on the outer
// band. d3-force still drives angular position so the graph breathes, but the
// radius is pinned per tier via forceRadial — geometry follows role.

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  type Simulation,
} from 'd3-force'
import type { EcoEdge, EcoNode, EcoProject, EdgeType } from '../../hooks/useEcosystem'
import {
  COLOR_PROJECT,
  COLOR_SYNAPSE,
  nodeColor,
  phaseFor,
} from './shared/palette'
import {
  normalizedCentrality,
  TIER_RADIUS_2D,
  tierFor,
} from './shared/layout'
import { edgeType, type SimLink, type SimNode } from './shared/types'
import { Inspector } from './shared/Inspector'
import { ProjectRail } from './shared/ProjectRail'

const WIDTH = 1200
const HEIGHT = 800
const CENTER_X = WIDTH / 2
const CENTER_Y = HEIGHT / 2

const EDGE_STRENGTHS: Record<EdgeType, number> = {
  parent: 0.9,
  depends_on: 0.35,
  collaborates_with: 0.2,
  serves: 0.1,
  link: 0.25,
}
const EDGE_DISTANCES: Record<EdgeType, number> = {
  parent: 100,
  depends_on: 160,
  collaborates_with: 200,
  serves: 200,
  link: 180,
}

// Base node radius per kind. Axis gets special treatment. Actual radius is
// this base multiplied by (1 + centrality * 0.5) so well-connected nodes
// grow subtly.
const BASE_RADIUS: Record<string, number> = {
  agent: 22,
  skill: 12,
  channel: 12,
  provider: 15,
  project: 26,
}

function baseRadius(n: SimNode): number {
  if (n.id === 'axis') return 46
  return BASE_RADIUS[n.kind] ?? 12
}

function nodeRadius(n: SimNode, centrality: number): number {
  const base = baseRadius(n)
  if (n.id === 'axis') return base
  return base * (1 + centrality * 0.45)
}

export function MapView2D({
  ecosystem,
  hovered,
  setHovered,
  selected,
  setSelected,
}: {
  ecosystem: { nodes: EcoNode[]; edges: EcoEdge[]; projects: EcoProject[] } | null
  hovered: string | null
  setHovered: (id: string | null) => void
  selected: string | null
  setSelected: (id: string | null | ((prev: string | null) => string | null)) => void
}) {
  // Camera
  const [userPan, setUserPan] = useState({ x: 0, y: 0 })
  const [userZoom, setUserZoom] = useState(1)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragState = useRef<{ startX: number; startY: number; panX0: number; panY0: number } | null>(null)
  const posCache = useRef<Map<string, { x: number; y: number; vx?: number; vy?: number }>>(new Map())

  const clientToSvgDelta = (dx: number, dy: number): { x: number; y: number } => {
    const svg = svgRef.current
    if (!svg) return { x: dx, y: dy }
    const rect = svg.getBoundingClientRect()
    return { x: (dx * WIDTH) / rect.width, y: (dy * HEIGHT) / rect.height }
  }

  const onBackgroundMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX0: userPan.x,
      panY0: userPan.y,
    }
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState.current) return
      const dx = e.clientX - dragState.current.startX
      const dy = e.clientY - dragState.current.startY
      const d = clientToSvgDelta(dx, dy)
      setUserPan({
        x: dragState.current.panX0 + d.x,
        y: dragState.current.panY0 + d.y,
      })
    }
    const onUp = () => {
      dragState.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = Math.exp(-e.deltaY * 0.0015)
      setUserZoom((z) => Math.max(0.3, Math.min(4, z * factor)))
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  const resetView = () => {
    setUserPan({ x: 0, y: 0 })
    setUserZoom(1)
    setSelected(null)
  }

  // Build simulation nodes + links
  const { simNodes, simLinks, centrality } = useMemo(() => {
    if (!ecosystem) {
      return {
        simNodes: [] as SimNode[],
        simLinks: [] as SimLink[],
        centrality: new Map<string, number>(),
      }
    }
    const raw = ecosystem.nodes
    const cent = normalizedCentrality(raw, ecosystem.edges)
    const sn: SimNode[] = raw.map((n, i) => {
      const tier = tierFor(n)
      if (n.id === 'axis') {
        return {
          ...n,
          tier,
          x: CENTER_X,
          y: CENTER_Y,
          fx: CENTER_X,
          fy: CENTER_Y,
          vx: 0,
          vy: 0,
        }
      }
      const cached = posCache.current.get(n.id)
      if (cached && Number.isFinite(cached.x) && Number.isFinite(cached.y)) {
        return {
          ...n,
          tier,
          x: cached.x,
          y: cached.y,
          vx: cached.vx ?? 0,
          vy: cached.vy ?? 0,
        }
      }
      // Deterministic seed on tier ring
      const r = TIER_RADIUS_2D[tier as 0 | 1 | 2 | 3]
      const a = (i / Math.max(raw.length, 1)) * Math.PI * 2
      return {
        ...n,
        tier,
        x: CENTER_X + Math.cos(a) * r,
        y: CENTER_Y + Math.sin(a) * r,
        vx: 0,
        vy: 0,
      }
    })
    const byId = new Map(sn.map((n) => [n.id, n]))
    const sl: SimLink[] = []
    for (const e of ecosystem.edges) {
      const source = byId.get(e.from)
      const target = byId.get(e.to)
      if (!source || !target) continue
      sl.push({ ...e, source, target, typeSafe: edgeType(e) })
    }
    return { simNodes: sn, simLinks: sl, centrality: cent }
  }, [ecosystem])

  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (simNodes.length === 0) return

    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((l) => EDGE_DISTANCES[l.typeSafe] ?? 160)
          .strength((l) => EDGE_STRENGTHS[l.typeSafe] ?? 0.25),
      )
      .force('charge', forceManyBody<SimNode>().strength(-260))
      .force(
        'collision',
        forceCollide<SimNode>().radius((n) => nodeRadius(n, centrality.get(n.id) ?? 0) + 10),
      )
      // Radial pin: each node is pulled toward its tier's ring. This is what
      // makes the layout orbital while still allowing d3 to pick angles.
      .force(
        'radial',
        forceRadial<SimNode>(
          (n) => TIER_RADIUS_2D[n.tier as 0 | 1 | 2 | 3],
          CENTER_X,
          CENTER_Y,
        ).strength(0.45),
      )

    sim.alpha(1).alphaDecay(0.035)
    sim.on('tick', () => {
      for (const n of simNodes) {
        if (n.x !== undefined && n.y !== undefined) {
          posCache.current.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy })
        }
      }
      setTick((t) => (t + 1) % 10_000)
    })
    simRef.current = sim

    return () => {
      sim.stop()
      simRef.current = null
    }
  }, [simNodes, simLinks, centrality])

  const camera = useMemo(
    () => ({ scale: userZoom, tx: userPan.x, ty: userPan.y }),
    [userPan, userZoom],
  )

  return (
    <>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-full w-full"
        style={{ touchAction: 'none' }}
      >
        <defs>
          <radialGradient id="orbit-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.95 0.15 200)" stopOpacity="0.03" />
            <stop offset="100%" stopColor="oklch(0.85 0.12 200)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect
          x={0}
          y={0}
          width={WIDTH}
          height={HEIGHT}
          fill="transparent"
          style={{ cursor: 'grab' }}
          onMouseDown={onBackgroundMouseDown}
          onClick={() => setSelected(null)}
        />

        <motion.g
          initial={false}
          animate={{ x: camera.tx, y: camera.ty, scale: camera.scale }}
          transition={{ type: 'spring', stiffness: 75, damping: 22 }}
          style={{ transformOrigin: '0 0' }}
        >
          {/* Orbit rings — quiet, almost subliminal */}
          {[1, 2, 3].map((t) => (
            <circle
              key={t}
              cx={CENTER_X}
              cy={CENTER_Y}
              r={TIER_RADIUS_2D[t as 1 | 2 | 3]}
              fill="none"
              stroke="oklch(0.85 0.12 200)"
              strokeOpacity={0.09}
              strokeWidth={0.8}
              strokeDasharray="2 10"
            />
          ))}

          {/* Edges */}
          {simLinks.map((l) => {
            const src = l.source as SimNode
            const tgt = l.target as SimNode
            if (src.x === undefined || tgt.x === undefined) return null
            const focused =
              hovered === src.id ||
              hovered === tgt.id ||
              selected === src.id ||
              selected === tgt.id
            const edgeKey = `${l.from}-${l.to}-${l.typeSafe}`
            return (
              <MeshEdge
                key={edgeKey}
                x1={src.x!}
                y1={src.y!}
                x2={tgt.x!}
                y2={tgt.y!}
                type={l.typeSafe}
                active={l.active}
                activity={l.activity ?? 0}
                focused={focused}
                phase={phaseFor(edgeKey)}
              />
            )
          })}

          {/* Nodes */}
          {simNodes.map((n) => {
            if (n.x === undefined || n.y === undefined) return null
            return (
              <Neuron
                key={n.id}
                node={n}
                x={n.x}
                y={n.y}
                r={nodeRadius(n, centrality.get(n.id) ?? 0)}
                hovered={hovered === n.id}
                selected={selected === n.id}
                onEnter={() => setHovered(n.id)}
                onLeave={() => setHovered(null)}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelected((prev) => (prev === n.id ? null : n.id))
                }}
              />
            )
          })}
        </motion.g>
      </svg>

      {/* Recenter + zoom indicator */}
      <div className="absolute bottom-20 right-4 flex flex-col items-end gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation()
            resetView()
          }}
          className="frosted rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-hangar-muted transition hover:text-hangar-text"
        >
          recenter
        </button>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-hangar-muted/60">
          zoom {userZoom.toFixed(2)}×
        </span>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Node
// ---------------------------------------------------------------------------

type NeuronProps = {
  node: SimNode
  x: number
  y: number
  r: number
  hovered: boolean
  selected: boolean
  onEnter: () => void
  onLeave: () => void
  onClick: (e: React.MouseEvent) => void
}

function Neuron({ node, x, y, r, hovered, selected, onEnter, onLeave, onClick }: NeuronProps) {
  const isAxis = node.id === 'axis'
  const isProject = node.kind === 'project'
  const focused = hovered || selected
  const coreR = focused ? r * 0.45 : r * 0.35
  const color = nodeColor(node)
  const strokeColor = node.active ? color : 'oklch(0.55 0.03 250)'
  const phase = phaseFor(node.id)
  const haloDelay = phase * 4

  return (
    <motion.g
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {node.active && (
        <motion.circle
          initial={false}
          cx={x}
          cy={y}
          r={r * (isProject ? 1.8 : 2.4)}
          fill={color}
          fillOpacity={0.22}
          animate={{
            opacity: focused ? [0.7, 1, 0.7] : [0.16, 0.3, 0.16],
            scale: focused ? 1.15 : 1,
          }}
          transition={{
            opacity: {
              duration: focused ? 2 : 5 + phase * 2,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: haloDelay,
            },
            scale: { duration: 0.3 },
          }}
          style={{ transformOrigin: `${x}px ${y}px`, mixBlendMode: 'screen' }}
        />
      )}

      {isProject ? (
        <>
          <motion.polygon
            points={octagonPoints(x, y, r)}
            fill={color}
            fillOpacity={focused ? 0.22 : 0.12}
            stroke={color}
            strokeWidth={focused ? 2 : 1.2}
            transition={{ duration: 0.25 }}
          />
          <polygon
            points={octagonPoints(x, y, r * 0.55)}
            fill="none"
            stroke={color}
            strokeWidth={0.8}
            opacity={0.7}
          />
          <circle cx={x} cy={y} r={3.5} fill={color} />
        </>
      ) : (
        <>
          <motion.circle
            initial={false}
            cx={x}
            cy={y}
            r={focused ? r * 1.15 : r}
            fill="none"
            stroke={strokeColor}
            strokeWidth={focused ? 1.6 : 1}
            animate={{ opacity: focused ? 1 : node.active ? 0.7 : 0.32 }}
            transition={{ duration: 0.25 }}
          />
          <motion.circle
            initial={false}
            cx={x}
            cy={y}
            r={focused ? coreR * 1.2 : coreR}
            fill={color}
            animate={{ opacity: node.active ? 1 : 0.4 }}
            transition={{ duration: 0.25 }}
          />
        </>
      )}

      <motion.text
        x={x}
        y={y + r + 16}
        textAnchor="middle"
        className="select-none fill-hangar-text font-sans"
        animate={{ fontSize: focused ? 13 : isAxis ? 14 : isProject ? 12 : 11 }}
        style={{ fontWeight: isProject ? 400 : 300, pointerEvents: 'none' }}
      >
        {node.label}
      </motion.text>
      {node.sublabel && (
        <motion.text
          x={x}
          y={y + r + 30}
          textAnchor="middle"
          className="select-none fill-hangar-muted font-mono"
          animate={{ opacity: focused ? 1 : 0.65 }}
          style={{ fontSize: 9, letterSpacing: '0.1em', pointerEvents: 'none' }}
        >
          {isProject && node.details?.memberCount != null
            ? `${node.details.memberCount} members`
            : node.sublabel.length > 60
              ? node.sublabel.slice(0, 58) + '…'
              : node.sublabel}
        </motion.text>
      )}
    </motion.g>
  )
}

function octagonPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i - Math.PI / 8
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`)
  }
  return pts.join(' ')
}

// ---------------------------------------------------------------------------
// Edge
// ---------------------------------------------------------------------------

function MeshEdge({
  x1,
  y1,
  x2,
  y2,
  type,
  active,
  activity,
  focused,
  phase,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  type: EdgeType
  active: boolean
  activity: number
  focused: boolean
  phase: number
}) {
  const dx = x2 - x1
  const dy = y2 - y1
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const sag =
    type === 'parent' ? 0 : type === 'depends_on' ? 20 : type === 'serves' ? 12 : 40
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const cx = mx + nx * sag
  const cy = my + ny * sag
  const d = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`

  const strokeBase = type === 'serves' ? COLOR_PROJECT : COLOR_SYNAPSE
  const strokeDash =
    type === 'parent'
      ? undefined
      : type === 'collaborates_with'
        ? '2 6'
        : type === 'serves'
          ? '1 6'
          : active
            ? undefined
            : '4 4'
  const strokeWidth =
    type === 'parent'
      ? focused ? 2 : 1.3
      : type === 'depends_on'
        ? focused ? 1.4 : 0.9
        : type === 'serves'
          ? focused ? 1 : 0.55
          : focused ? 0.9 : 0.6
  const baseOpacity = type === 'serves' ? (focused ? 0.9 : 0.3) : focused ? 0.95 : active ? 0.45 : 0.2

  return (
    <g>
      <path
        d={d}
        stroke={strokeBase}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDash}
        fill="none"
        opacity={baseOpacity}
      />
      {active && (
        <EdgePulse path={d} activity={activity} focused={focused} type={type} phase={phase} />
      )}
    </g>
  )
}

function EdgePulse({
  path,
  activity,
  focused,
  type,
  phase,
}: {
  path: string
  activity: number
  focused: boolean
  type: EdgeType
  phase: number
}) {
  const baseline =
    type === 'parent' ? 0.35 : type === 'depends_on' ? 0.25 : type === 'serves' ? 0.15 : 0.1
  const effective = Math.max(baseline, activity)
  const count = focused ? 3 : effective > 0.5 ? 2 : 1
  const duration = focused ? 1.5 : 6 - effective * 3.5
  const pulseColor = type === 'serves' ? COLOR_PROJECT : COLOR_SYNAPSE
  const pulseR = focused ? 2.8 : type === 'serves' ? 1.4 : 1.8 + effective
  const peakOpacity = type === 'serves' ? 0.45 : focused ? 1 : 0.5 + effective * 0.5

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <motion.circle
          key={i}
          cx={0}
          cy={0}
          r={pulseR}
          fill={pulseColor}
          initial={{ opacity: 0, offsetDistance: '0%' }}
          animate={{
            offsetDistance: ['0%', '100%'],
            opacity: [0, peakOpacity, 0],
          }}
          transition={{
            duration,
            delay: (i * duration) / count + phase * duration,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{ offsetPath: `path('${path}')`, offsetRotate: '0deg' }}
        />
      ))}
    </>
  )
}

// Re-export so MapView can render these under its own layout
export { Inspector, ProjectRail }
