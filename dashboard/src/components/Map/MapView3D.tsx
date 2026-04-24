// Neural map — 3D exploratory view.
//
// Same semantics as the 2D view, projected into world space: Axis at the
// origin, agents/projects/periphery on concentric orbital shells. No physics
// here — 3D is meant for quiet exploration, so positions are deterministic
// and the only motion is gentle pulsing plus whatever the user does with the
// camera.

import { useMemo, useRef, Suspense } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { EcoEdge, EcoNode, EcoProject, EdgeType } from '../../hooks/useEcosystem'
import { HEX, nodeHex, phaseFor } from './shared/palette'
import {
  normalizedCentrality,
  TIER_RADIUS_3D,
  TIER_Y_3D,
  tierFor,
  type Tier,
} from './shared/layout'

// Base node size per kind in world units. Axis larger; periphery smaller.
const BASE_SIZE: Record<string, number> = {
  agent: 0.32,
  project: 0.38,
  skill: 0.2,
  provider: 0.24,
  channel: 0.2,
}

function baseSize(n: EcoNode): number {
  if (n.id === 'axis') return 0.75
  return BASE_SIZE[n.kind] ?? 0.22
}

type Node3D = EcoNode & { position: THREE.Vector3; size: number; tier: Tier }

// Deterministic angular layout: siblings of the same parent cluster together.
// We first pick an angle for each tier-1 agent, then place that agent's
// children near the agent's angle. This keeps the graph legible: a project
// and its skills end up on the same "spoke" of the constellation.
function buildPositions(
  nodes: EcoNode[],
  edges: EcoEdge[],
  centrality: Map<string, number>,
): Node3D[] {
  // 1) Pick angles for tier 1 agents (equispaced, deterministic order).
  const agents = nodes
    .filter((n) => n.id !== 'axis' && n.kind === 'agent')
    .sort((a, b) => a.id.localeCompare(b.id))
  const agentAngle = new Map<string, number>()
  agents.forEach((a, i) => {
    agentAngle.set(a.id, (i / Math.max(agents.length, 1)) * Math.PI * 2)
  })

  // 2) Build a parent lookup: parent id -> angle (may be agent or project).
  //    Projects use their first-found agent member if any.
  const parentAngle = new Map<string, number>(agentAngle)

  // 3) Lay out projects around tier 2. A project's angle is the average of
  //    its agent members' angles; if none, fall back to a deterministic slot.
  const projects = nodes
    .filter((n) => n.kind === 'project')
    .sort((a, b) => a.id.localeCompare(b.id))
  projects.forEach((p, i) => {
    // Look for agent members via edges of type `parent` or membership (we
    // can't see EcoProject.members here — so hash the id for determinism).
    const projectEdges = edges.filter((e) => e.to === p.id || e.from === p.id)
    const memberAngles: number[] = []
    for (const e of projectEdges) {
      const other = e.from === p.id ? e.to : e.from
      const a = agentAngle.get(other)
      if (a !== undefined) memberAngles.push(a)
    }
    if (memberAngles.length > 0) {
      // Average of angles on the unit circle (handle wrap-around via vectors)
      let sx = 0
      let sy = 0
      for (const a of memberAngles) {
        sx += Math.cos(a)
        sy += Math.sin(a)
      }
      parentAngle.set(p.id, Math.atan2(sy, sx))
    } else {
      parentAngle.set(p.id, (i / Math.max(projects.length, 1)) * Math.PI * 2)
    }
  })

  // 4) Periphery: cluster around parent angle. Parent discovered via the
  //    first incoming `parent` edge, else any edge to a known-angle node.
  const peripheryParent = new Map<string, string>()
  for (const e of edges) {
    const et = (e.type ?? 'link') as EdgeType
    if (et === 'parent') {
      // edge.to is the parent, edge.from is the child — per existing convention
      // in useEcosystem types. We accept either direction and pick whichever
      // end already has an angle.
      if (parentAngle.has(e.to) && !peripheryParent.has(e.from)) {
        peripheryParent.set(e.from, e.to)
      } else if (parentAngle.has(e.from) && !peripheryParent.has(e.to)) {
        peripheryParent.set(e.to, e.from)
      }
    }
  }
  // Fallback: any edge connecting a periphery node to something with a known
  // angle.
  for (const e of edges) {
    if (!peripheryParent.has(e.from) && parentAngle.has(e.to)) {
      peripheryParent.set(e.from, e.to)
    }
    if (!peripheryParent.has(e.to) && parentAngle.has(e.from)) {
      peripheryParent.set(e.to, e.from)
    }
  }

  // 5) Compute final positions. Within a tier we add a small centrality-
  //    driven radial nudge inward so well-connected nodes appear slightly
  //    closer to Axis — visually rewarding centrality without breaking tiers.
  const peripheryByParent = new Map<string, string[]>()
  for (const n of nodes) {
    const tier = tierFor(n)
    if (tier !== 3) continue
    const pid = peripheryParent.get(n.id) ?? '__orphan__'
    if (!peripheryByParent.has(pid)) peripheryByParent.set(pid, [])
    peripheryByParent.get(pid)!.push(n.id)
  }
  const peripheryIndex = new Map<string, number>()
  const peripheryTotal = new Map<string, number>()
  for (const [pid, ids] of peripheryByParent) {
    ids.sort() // deterministic order
    peripheryTotal.set(pid, ids.length)
    ids.forEach((id, i) => peripheryIndex.set(id, i))
  }

  const out: Node3D[] = []
  for (const n of nodes) {
    const tier = tierFor(n)
    const cent = centrality.get(n.id) ?? 0

    if (tier === 0) {
      out.push({
        ...n,
        tier,
        size: baseSize(n),
        position: new THREE.Vector3(0, 0, 0),
      })
      continue
    }

    let angle: number
    if (tier === 1) {
      angle = agentAngle.get(n.id) ?? 0
    } else if (tier === 2) {
      angle = parentAngle.get(n.id) ?? 0
    } else {
      const pid = peripheryParent.get(n.id) ?? '__orphan__'
      const parentA = parentAngle.get(pid) ?? 0
      const count = peripheryTotal.get(pid) ?? 1
      const idx = peripheryIndex.get(n.id) ?? 0
      // Spread siblings in a ±0.35 rad arc around the parent angle
      const spread = count === 1 ? 0 : (idx / (count - 1) - 0.5) * 0.7
      angle = parentA + spread
    }

    const r = TIER_RADIUS_3D[tier] * (1 - cent * 0.12) // subtle centrality inward pull
    const y = TIER_Y_3D[tier]
    const size = baseSize(n) * (1 + cent * 0.35)
    out.push({
      ...n,
      tier,
      size,
      position: new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r),
    })
  }

  return out
}

export function MapView3D({
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
  const { positioned, edges } = useMemo(() => {
    if (!ecosystem) {
      return { positioned: [] as Node3D[], edges: [] as EcoEdge[] }
    }
    const cent = normalizedCentrality(ecosystem.nodes, ecosystem.edges)
    return {
      positioned: buildPositions(ecosystem.nodes, ecosystem.edges, cent),
      edges: ecosystem.edges,
    }
  }, [ecosystem])

  const posById = useMemo(() => {
    const m = new Map<string, Node3D>()
    for (const n of positioned) m.set(n.id, n)
    return m
  }, [positioned])

  return (
    <div
      className="absolute inset-0"
      onClick={() => setSelected(null)}
    >
      <Canvas
        camera={{ position: [0, 6, 18], fov: 45, near: 0.1, far: 200 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#0b0f18']} />
        <fog attach="fog" args={['#0b0f18', 22, 55]} />

        <Suspense fallback={null}>
          <ambientLight intensity={0.35} />
          <pointLight position={[0, 0, 0]} intensity={0.6} color="#ffd08a" distance={12} />

          {/* Faint orbital rings in the equatorial plane */}
          <OrbitRings />

          {/* Edges */}
          {edges.map((e) => {
            const a = posById.get(e.from)
            const b = posById.get(e.to)
            if (!a || !b) return null
            const focused =
              hovered === a.id ||
              hovered === b.id ||
              selected === a.id ||
              selected === b.id
            return (
              <Edge3D
                key={`${e.from}-${e.to}-${e.type ?? 'link'}`}
                a={a}
                b={b}
                type={(e.type ?? 'link') as EdgeType}
                active={e.active}
                activity={e.activity ?? 0}
                focused={focused}
                phase={phaseFor(`${e.from}-${e.to}`)}
              />
            )
          })}

          {/* Nodes */}
          {positioned.map((n) => (
            <Node3DMesh
              key={n.id}
              node={n}
              hovered={hovered === n.id}
              selected={selected === n.id}
              onHover={(h) => setHovered(h ? n.id : null)}
              onSelect={() => {
                setSelected((prev) => (prev === n.id ? null : n.id))
              }}
            />
          ))}

          <OrbitControls
            makeDefault
            enablePan={true}
            enableZoom={true}
            enableDamping={true}
            dampingFactor={0.1}
            minDistance={6}
            maxDistance={55}
            minPolarAngle={Math.PI * 0.15}
            maxPolarAngle={Math.PI * 0.75}
            rotateSpeed={0.5}
            panSpeed={0.6}
            zoomSpeed={0.6}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3D node
// ---------------------------------------------------------------------------

function Node3DMesh({
  node,
  hovered,
  selected,
  onHover,
  onSelect,
}: {
  node: Node3D
  hovered: boolean
  selected: boolean
  onHover: (h: boolean) => void
  onSelect: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const haloRef = useRef<THREE.Mesh>(null)
  const color = useMemo(() => nodeHex(node), [node])
  const isAxis = node.id === 'axis'
  const focused = hovered || selected
  const phase = phaseFor(node.id)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (haloRef.current) {
      // Slow breathing halo, staggered per phase
      const period = 5 + phase * 2
      const pulse = 0.6 + 0.4 * Math.sin((t / period + phase) * Math.PI * 2)
      const mat = haloRef.current.material as THREE.MeshBasicMaterial
      mat.opacity =
        (focused ? 0.35 : node.active ? 0.18 : 0.06) * (0.6 + 0.4 * pulse)
    }
    if (meshRef.current && isAxis) {
      // Axis gets a slow spin — the only moving node in the scene at rest
      meshRef.current.rotation.y = t * 0.15
    }
  })

  const halo = (
    <mesh ref={haloRef} position={node.position}>
      <sphereGeometry args={[node.size * 2.2, 16, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.15} depthWrite={false} />
    </mesh>
  )

  const handlers = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      onHover(true)
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      onHover(false)
      document.body.style.cursor = 'auto'
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation()
      onSelect()
    },
  }

  return (
    <group>
      {node.active && halo}

      <mesh ref={meshRef} position={node.position} {...handlers}>
        <sphereGeometry args={[node.size, 20, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={focused ? 1.4 : node.active ? 0.7 : 0.25}
          roughness={0.35}
          metalness={0.1}
        />
      </mesh>

      {/* Thin outline ring for non-axis nodes when focused */}
      {!isAxis && focused && (
        <mesh position={node.position}>
          <ringGeometry args={[node.size * 1.25, node.size * 1.4, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Label */}
      {(isAxis || focused) && (
        <Html
          position={[node.position.x, node.position.y - node.size - 0.4, node.position.z]}
          center
          distanceFactor={12}
          occlude={false}
          style={{ pointerEvents: 'none' }}
        >
          <div className="select-none text-center">
            <div
              className="font-sans text-[13px]"
              style={{
                color: 'var(--color-hangar-text)',
                fontWeight: isAxis ? 500 : 300,
                textShadow: '0 0 8px rgba(0,0,0,0.8)',
              }}
            >
              {node.label}
            </div>
            {node.sublabel && (
              <div
                className="font-mono text-[9px] uppercase tracking-[0.15em]"
                style={{ color: 'var(--color-hangar-muted)' }}
              >
                {node.sublabel.length > 48 ? node.sublabel.slice(0, 46) + '…' : node.sublabel}
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

// ---------------------------------------------------------------------------
// 3D edge
// ---------------------------------------------------------------------------

function Edge3D({
  a,
  b,
  type,
  active,
  activity,
  focused,
  phase,
}: {
  a: Node3D
  b: Node3D
  type: EdgeType
  active: boolean
  activity: number
  focused: boolean
  phase: number
}) {
  const color = useMemo(
    () => (type === 'serves' ? HEX.project : HEX.synapse),
    [type],
  )

  // Curve the edge with a small bow so it reads as a synapse, not a stick.
  // The bow lifts through the midpoint along the normal of (a, b) in 3D;
  // we pick the axis perpendicular to the line that has the largest component
  // so the bow is visible from most camera angles.
  const points = useMemo(() => {
    const mid = new THREE.Vector3().addVectors(a.position, b.position).multiplyScalar(0.5)
    const dir = new THREE.Vector3().subVectors(b.position, a.position)
    const len = dir.length()
    const sag =
      type === 'parent' ? 0 : type === 'depends_on' ? 0.6 : type === 'serves' ? 0.4 : 1.0
    // Offset outward from origin so edges don't pass through Axis
    const outward = mid.clone().normalize()
    if (!Number.isFinite(outward.x)) outward.set(0, 1, 0)
    const ctrl = mid.clone().add(outward.multiplyScalar(sag * Math.min(len * 0.2, 2.5)))
    const curve = new THREE.QuadraticBezierCurve3(a.position, ctrl, b.position)
    return curve.getPoints(24)
  }, [a.position, b.position, type])

  const opacity = focused ? 0.95 : active ? (type === 'parent' ? 0.5 : 0.3) : 0.12
  const lineWidth = type === 'parent' ? (focused ? 2.4 : 1.6) : focused ? 1.6 : 1

  const dashed = type === 'collaborates_with' || type === 'serves'

  return (
    <group>
      <Line
        points={points}
        color={color}
        lineWidth={lineWidth}
        transparent
        opacity={opacity}
        dashed={dashed}
        dashSize={0.15}
        gapSize={0.25}
      />
      {active && (
        <EdgePulse3D
          points={points}
          color={color}
          activity={activity}
          focused={focused}
          type={type}
          phase={phase}
        />
      )}
    </group>
  )
}

function EdgePulse3D({
  points,
  color,
  activity,
  focused,
  type,
  phase,
}: {
  points: THREE.Vector3[]
  color: string
  activity: number
  focused: boolean
  type: EdgeType
  phase: number
}) {
  const ref = useRef<THREE.Mesh>(null)
  const baseline =
    type === 'parent' ? 0.35 : type === 'depends_on' ? 0.25 : type === 'serves' ? 0.15 : 0.1
  const effective = Math.max(baseline, activity)
  const duration = focused ? 1.8 : 6 - effective * 3.5

  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points])

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = (clock.elapsedTime / duration + phase) % 1
    const p = curve.getPoint(t)
    ref.current.position.copy(p)
    const mat = ref.current.material as THREE.MeshBasicMaterial
    // Fade in/out so pulse looks like a traveling signal, not a bead on rail
    const fade = Math.sin(t * Math.PI)
    mat.opacity = (focused ? 1 : 0.55) * fade
  })

  const size = focused ? 0.08 : 0.05 + effective * 0.03

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[size, 10, 10]} />
      <meshBasicMaterial color={color} transparent depthWrite={false} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// Orbital rings — subtle reference geometry
// ---------------------------------------------------------------------------

function OrbitRings() {
  return (
    <group>
      {([1, 2, 3] as Tier[]).map((t) => {
        const r = TIER_RADIUS_3D[t]
        const y = TIER_Y_3D[t]
        return (
          <mesh key={t} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
            <ringGeometry args={[r - 0.02, r + 0.02, 128]} />
            <meshBasicMaterial
              color={HEX.synapse}
              transparent
              opacity={0.07}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}

