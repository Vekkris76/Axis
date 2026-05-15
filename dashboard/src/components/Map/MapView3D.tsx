// Neural map — 3D exploratory view, light theme.
//
// Axis at origin. Each tier sits on a larger concentric *cube* shell — the
// scaffolding is architectural. Node cores follow the grayscale ladder:
// near-black for Axis, medium-dark for agents, medium for projects, light
// for periphery. Shape encodes kind: most nodes are cubes (match the
// scaffolding), but **projects are spheres** — the one round mark in an
// otherwise rectilinear world, because projects are the containers where
// the agents' work gathers. Axis gets a golden wireframe crown and a soft
// radiant aureole. Canvas is transparent so the parent's mist drifts
// through.

import { useEffect, useMemo, useRef, Suspense } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

// OrbitControls type — imported from drei indirectly via three-stdlib, but
// drei re-exports it. Using the runtime type via a minimal shape keeps us
// independent of the stdlib package.
type OrbitControlsImpl = {
  target: THREE.Vector3
  update: () => void
}
import type { EcoEdge, EcoNode, EcoProject, EdgeType } from '../../hooks/useEcosystem'
import {
  edgeColor,
  HEX,
  nodeHex,
  phaseFor,
  HUD_BG,
  HUD_CYAN,
  HUD_AMBER,
} from './shared/palette'
import {
  normalizedCentrality,
  TIER_RADIUS_3D,
  tierFor,
  type Tier,
} from './shared/layout'

// Base node size per kind. Constellation look: nodes are small marks, the
// network of connections does the heavy visual work. Axis stays noticeably
// larger so the eye still finds the center.
const BASE_SIZE: Record<string, number> = {
  agent: 0.18,
  project: 0.26,
  skill: 0.12,
  provider: 0.14,
  channel: 0.12,
}

function baseSize(n: EcoNode): number {
  if (n.id === 'axis') return 0.55
  return BASE_SIZE[n.kind] ?? 0.12
}

type Node3D = EcoNode & { position: THREE.Vector3; size: number; tier: Tier }

// Project a unit direction onto the surface of an axis-aligned cube of
// half-side `r`. This is what lets us place Fibonacci-distributed directions
// on cube shells instead of spheres — the structure becomes architectural.
function projectOntoCube(dir: THREE.Vector3, r: number): THREE.Vector3 {
  const d = dir.clone().normalize()
  const ax = Math.abs(d.x)
  const ay = Math.abs(d.y)
  const az = Math.abs(d.z)
  const m = Math.max(ax, ay, az)
  if (m <= 1e-6) return new THREE.Vector3(r, 0, 0)
  return d.multiplyScalar(r / m)
}

function buildPositions(
  nodes: EcoNode[],
  edges: EcoEdge[],
  centrality: Map<string, number>,
): Node3D[] {
  // 1) Directions for tier-1 agents via Fibonacci spiral on the sphere
  //    (spherical coordinates are still the cleanest way to spread points
  //    evenly in 3D; we just project them onto the cube afterward).
  const agents = nodes
    .filter((n) => n.id !== 'axis' && n.kind === 'agent')
    .sort((a, b) => a.id.localeCompare(b.id))
  const agentDir = new Map<string, THREE.Vector3>()
  agents.forEach((a, i) => {
    agentDir.set(a.id, fibonacciDirection(i, agents.length))
  })

  const parentDir = new Map<string, THREE.Vector3>(agentDir)

  // 2) Projects get their own independent Fibonacci slot. Putting them at
  //    the "average direction of their member agents" felt clever but made
  //    projects that share an agent collapse onto each other — confusing
  //    for the viewer, especially when the projects are in fact unrelated.
  //    The connection to agents is still visible via the edges.
  const projects = nodes
    .filter((n) => n.kind === 'project')
    .sort((a, b) => a.id.localeCompare(b.id))
  projects.forEach((p, i) => {
    parentDir.set(p.id, fibonacciDirection(i, projects.length))
  })

  // 3) Periphery → parent anchor
  const peripheryParent = new Map<string, string>()
  for (const e of edges) {
    const et = (e.type ?? 'link') as EdgeType
    if (et === 'parent') {
      if (parentDir.has(e.to) && !peripheryParent.has(e.from)) {
        peripheryParent.set(e.from, e.to)
      } else if (parentDir.has(e.from) && !peripheryParent.has(e.to)) {
        peripheryParent.set(e.to, e.from)
      }
    }
  }
  for (const e of edges) {
    if (!peripheryParent.has(e.from) && parentDir.has(e.to)) {
      peripheryParent.set(e.from, e.to)
    }
    if (!peripheryParent.has(e.to) && parentDir.has(e.from)) {
      peripheryParent.set(e.to, e.from)
    }
  }

  // 4) Group siblings per parent for cap distribution
  const peripheryByParent = new Map<string, string[]>()
  for (const n of nodes) {
    if (tierFor(n) !== 3) continue
    const pid = peripheryParent.get(n.id) ?? '__orphan__'
    if (!peripheryByParent.has(pid)) peripheryByParent.set(pid, [])
    peripheryByParent.get(pid)!.push(n.id)
  }
  const peripheryIndex = new Map<string, number>()
  const peripheryTotal = new Map<string, number>()
  for (const [pid, ids] of peripheryByParent) {
    ids.sort()
    peripheryTotal.set(pid, ids.length)
    ids.forEach((id, i) => peripheryIndex.set(id, i))
  }

  // 5) Emit positions, projecting each direction onto its tier's cube.
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

    let dir: THREE.Vector3
    if (tier === 1) {
      dir = agentDir.get(n.id)?.clone() ?? new THREE.Vector3(1, 0, 0)
    } else if (tier === 2) {
      dir = parentDir.get(n.id)?.clone() ?? new THREE.Vector3(1, 0, 0)
    } else {
      const pid = peripheryParent.get(n.id) ?? '__orphan__'
      const base = parentDir.get(pid)?.clone() ?? fibonacciDirection(hash(n.id), 97)
      const total = peripheryTotal.get(pid) ?? 1
      const idx = peripheryIndex.get(n.id) ?? 0
      dir = offsetOnSphericalCap(base, idx, total, 0.55)
    }

    const halfSide = TIER_RADIUS_3D[tier] * (1 - cent * 0.1)
    const size = baseSize(n) * (1 + cent * 0.35)
    out.push({
      ...n,
      tier,
      size,
      position: projectOntoCube(dir, halfSide),
    })
  }

  return out
}

function fibonacciDirection(i: number, n: number): THREE.Vector3 {
  const safe = Math.max(n, 1)
  const offset = 0.5
  const y = 1 - (2 * (i + offset)) / safe
  const radius = Math.sqrt(Math.max(0, 1 - y * y))
  const theta = Math.PI * (1 + Math.sqrt(5)) * i
  return new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius)
}

function offsetOnSphericalCap(
  base: THREE.Vector3,
  index: number,
  total: number,
  halfAngle: number,
): THREE.Vector3 {
  if (total <= 1) return base.clone()
  const b = base.clone().normalize()
  const ref =
    Math.abs(b.y) < 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0)
  const u = new THREE.Vector3().crossVectors(b, ref).normalize()
  const v = new THREE.Vector3().crossVectors(b, u).normalize()

  const t = (index + 0.5) / total
  const phi = halfAngle * Math.sqrt(t)
  const theta = Math.PI * (1 + Math.sqrt(5)) * index
  const sinPhi = Math.sin(phi)
  const cosPhi = Math.cos(phi)
  return b
    .multiplyScalar(cosPhi)
    .add(u.clone().multiplyScalar(sinPhi * Math.cos(theta)))
    .add(v.clone().multiplyScalar(sinPhi * Math.sin(theta)))
    .normalize()
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
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

  // Precompute the set of ids adjacent to the focused node, so we can dim
  // everything else when something is hovered/selected.
  const focusedId = hovered ?? selected
  const related = useMemo(() => {
    if (!focusedId) return null
    const s = new Set<string>([focusedId])
    for (const e of edges) {
      if (e.from === focusedId) s.add(e.to)
      if (e.to === focusedId) s.add(e.from)
    }
    return s
  }, [focusedId, edges])

  // Edges drawn = ONLY those touching the focused node, deduplicated by
  // unordered pair (parent+depends_on between the same two nodes collapse
  // into a single line — they were stacking and creating odd geometry).
  // Edge type used for styling is the strongest relation: parent >
  // depends_on > serves > collaborates_with > link.
  const focusedEdges = useMemo<EcoEdge[]>(() => {
    if (!focusedId) return []
    const rank = (t?: string): number =>
      t === 'parent' ? 4 : t === 'depends_on' ? 3 : t === 'serves' ? 2 : t === 'collaborates_with' ? 1 : 0
    const byPair = new Map<string, EcoEdge>()
    for (const e of edges) {
      if (e.from !== focusedId && e.to !== focusedId) continue
      const key = [e.from, e.to].sort().join('|')
      const existing = byPair.get(key)
      if (!existing || rank(e.type) > rank(existing.type)) {
        byPair.set(key, e)
      }
    }
    return Array.from(byPair.values())
  }, [focusedId, edges])

  // Camera target: if a node is selected, center on it and pull in. The
  // CameraController inside the Canvas does the actual lerping.
  const selectedPos = useMemo(() => {
    if (!selected) return null
    const n = posById.get(selected)
    return n ? n.position.clone() : null
  }, [selected, posById])

  return (
    <div className="absolute inset-0" onClick={() => setSelected(null)}>
      <Canvas
        camera={{ position: [14, 8, 22], fov: 45, near: 0.1, far: 200 }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        dpr={[1, 2]}
        style={{ background: HUD_BG }}
      >
        <color attach="background" args={[HUD_BG]} />
        <fog attach="fog" args={[HUD_BG, 28, 70]} />

        <Suspense fallback={null}>
          <ambientLight intensity={0.35} />
          <directionalLight position={[12, 18, 10]} intensity={0.4} />

          <Starfield />
          <DriftParticles />

          {/* Edges are only drawn for the focused node's neighbourhood —
              the map at rest is just points. Multiple semantic relations
              between the same pair collapse into one line so geometry
              stays clean. */}
          {focusedEdges.map((e) => {
            const a = posById.get(e.from)
            const b = posById.get(e.to)
            if (!a || !b) return null
            return (
              <Edge3D
                key={`${e.from}-${e.to}`}
                a={a}
                b={b}
                type={(e.type ?? 'link') as EdgeType}
                active={e.active}
                activity={e.activity ?? 0}
                focused={true}
                dimmed={false}
                phase={phaseFor(`${e.from}-${e.to}`)}
                restingColor={edgeColor(a.kind, a.id, b.kind, b.id)}
              />
            )
          })}

          {positioned.map((n, i) => (
            <Node3DShape
              key={n.id}
              node={n}
              index={i}
              total={positioned.length}
              hovered={hovered === n.id}
              selected={selected === n.id}
              dimmed={related !== null && !related.has(n.id)}
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
            minDistance={4}
            maxDistance={80}
            rotateSpeed={0.45}
            panSpeed={0.6}
            zoomSpeed={0.6}
            autoRotate={selected === null}
            autoRotateSpeed={0.35}
          />
          <CameraFocus selectedPos={selectedPos} />

          <EffectComposer>
            <Bloom
              intensity={0.8}
              luminanceThreshold={0.45}
              luminanceSmoothing={0.7}
              mipmapBlur
              radius={0.55}
            />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 3D node — grayscale solid core + pastel wireframe envelope. Projects render
// as spheres; everything else as cubes. Axis gets a golden crown.
// ---------------------------------------------------------------------------

function Node3DShape({
  node,
  index,
  total,
  hovered,
  selected,
  dimmed,
  onHover,
  onSelect,
}: {
  node: Node3D
  index: number
  total: number
  hovered: boolean
  selected: boolean
  dimmed: boolean
  onHover: (h: boolean) => void
  onSelect: () => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const haloRef = useRef<THREE.Mesh>(null)
  const haloColor = useMemo(() => nodeHex(node), [node])
  const isAxis = node.id === 'axis'
  const isProject = node.kind === 'project'
  const focused = hovered || selected
  const phase = phaseFor(node.id)
  const entryDelay = (index / Math.max(total, 1)) * 0.9
  const entryDuration = 0.8
  const mountedAt = useRef<number | null>(null)

  // Emissive intensity ladder — kept modest so points stay crisp; the
  // density of connections, not the brightness, carries the composition.
  const baseEmissive = isAxis ? 2.4 : isProject ? 1.1 : node.kind === 'agent' ? 1.0 : 0.7
  // Halo (outer soft glow) sized relative to the core sphere
  const haloSize = node.size * (isAxis ? 2.6 : 1.8)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (mountedAt.current === null) mountedAt.current = t

    if (groupRef.current) {
      const elapsed = t - (mountedAt.current ?? t) - entryDelay
      const p = Math.max(0, Math.min(1, elapsed / entryDuration))
      const eased = 1 - Math.pow(1 - p, 3)
      groupRef.current.scale.setScalar(eased)
      groupRef.current.visible = p > 0
    }

    // Breathing pulse on the core emissive — stronger when the node is
    // active (driven by the bridge's cascade) or focused.
    const period = 4 + phase * 2
    const breath = 0.7 + 0.3 * Math.sin((t / period + phase) * Math.PI * 2)
    const activityBoost = (node.activity ?? 0) * 1.5
    const focusBoost = focused ? 1.0 : 0
    const dimMul = dimmed ? 0.35 : 1
    const intensity =
      (baseEmissive + activityBoost + focusBoost) * breath * dimMul

    if (coreRef.current) {
      const mat = coreRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = intensity
      mat.color.set(focused ? HEX.focusGold : haloColor)
      mat.emissive.set(focused ? HEX.focusGold : haloColor)
      if (isAxis) coreRef.current.rotation.y = t * 0.15
    }
    if (haloRef.current) {
      const mat = haloRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = (focused ? 0.28 : 0.16) * dimMul * (0.7 + 0.3 * breath)
      mat.color.set(focused ? HEX.focusGold : haloColor)
    }
  })

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

  // Per-kind facets: every node renders as a faceted wireframe primitive
  // built once and reused. No spheres → no "planet" reading.
  //   Axis      : octahedron with double wireframe overlay (signature glyph)
  //   project   : prism (BoxGeometry stretched) — reads as 'data block'
  //   agent     : octahedron — sharp, mid-size diamond
  //   provider  : tetrahedron — three-faced wedge
  //   skill     : icosahedron at low detail — small geode
  //   channel   : torus square — small ring
  const facetGeom = useMemo(() => {
    const s = node.size
    if (isAxis) return new THREE.OctahedronGeometry(s * 1.05, 0)
    if (isProject) return new THREE.BoxGeometry(s * 1.55, s * 1.55, s * 1.55)
    if (node.kind === 'provider') return new THREE.TetrahedronGeometry(s * 1.15, 0)
    if (node.kind === 'skill') return new THREE.IcosahedronGeometry(s * 0.9, 0)
    if (node.kind === 'channel')
      return new THREE.TorusGeometry(s * 0.85, s * 0.18, 6, 16)
    return new THREE.OctahedronGeometry(s, 0)
  }, [node.size, isAxis, isProject, node.kind])

  const wireGeom = useMemo(
    () => new THREE.EdgesGeometry(facetGeom),
    [facetGeom],
  )

  // Spin Axis slowly so the central glyph reads as alive.
  useFrame(({ clock }) => {
    if (!isAxis || !groupRef.current) return
    groupRef.current.rotation.y = clock.elapsedTime * 0.12
  })

  return (
    <group ref={groupRef} position={node.position}>
      {/* Solid faceted body — emissive, dim by default; bloom picks up
          the edges of the wireframe rather than the body itself. */}
      <mesh ref={coreRef} {...handlers} geometry={facetGeom}>
        <meshStandardMaterial
          color={HUD_BG}
          emissive={haloColor}
          emissiveIntensity={baseEmissive * 0.18}
          roughness={0.4}
          metalness={0.4}
          transparent
          opacity={0.92}
          toneMapped={false}
        />
      </mesh>

      {/* Wireframe overlay — the actual neon outline. This is what reads
          as the node from any distance. */}
      <lineSegments geometry={wireGeom}>
        <lineBasicMaterial
          color={focused ? HUD_AMBER : haloColor}
          transparent
          opacity={focused ? 0.95 : 0.72}
          toneMapped={false}
        />
      </lineSegments>

      {/* Soft outer halo — Axis only. The other nodes read cleanly as
          wireframe glyphs without an extra sphere around them. */}
      {isAxis && (
        <mesh ref={haloRef}>
          <sphereGeometry args={[haloSize, 18, 18]} />
          <meshBasicMaterial
            color={haloColor}
            transparent
            opacity={0.12}
            side={THREE.BackSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}

      {(isAxis || focused) && (
        <Html
          position={[0, -node.size - 0.45, 0]}
          center
          distanceFactor={14}
          occlude={false}
          style={{ pointerEvents: 'none' }}
        >
          <div className="select-none text-center">
            <div
              className="font-mono text-[11px] uppercase tracking-[0.28em]"
              style={{
                color: focused ? HUD_AMBER : HUD_CYAN,
                fontWeight: 500,
                textShadow: `0 0 8px ${focused ? HUD_AMBER : HUD_CYAN}`,
              }}
            >
              {node.label}
            </div>
            {node.sublabel && (
              <div
                className="font-mono text-[8px] uppercase tracking-[0.22em]"
                style={{ color: '#6a7a98', marginTop: 2 }}
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
// 3D edge — thin gray line with a traveling pulse dot when active.
// ---------------------------------------------------------------------------

function Edge3D({
  a,
  b,
  type,
  active,
  activity,
  focused,
  dimmed,
  phase,
  restingColor,
}: {
  a: Node3D
  b: Node3D
  type: EdgeType
  active: boolean
  activity: number
  focused: boolean
  dimmed: boolean
  phase: number
  restingColor: string
}) {
  // At rest, each edge wears the color of the hierarchy it connects; on
  // focus it switches to the soft focus gold so the subnet pops.
  const color = focused ? HEX.focusGold : restingColor

  const points = useMemo(() => {
    const mid = new THREE.Vector3().addVectors(a.position, b.position).multiplyScalar(0.5)
    const dir = new THREE.Vector3().subVectors(b.position, a.position)
    const len = dir.length()
    const sag =
      type === 'parent' ? 0 : type === 'depends_on' ? 0.5 : type === 'serves' ? 0.35 : 0.9
    const outward = mid.clone().normalize()
    if (!Number.isFinite(outward.x)) outward.set(0, 1, 0)
    const ctrl = mid.clone().add(outward.multiplyScalar(sag * Math.min(len * 0.2, 2.5)))
    const curve = new THREE.QuadraticBezierCurve3(a.position, ctrl, b.position)
    return curve.getPoints(24)
  }, [a.position, b.position, type])

  // Constellation look: edges are thin filaments; the network density does
  // the heavy lifting. Focused edges still bump up for selection feedback.
  const base = focused ? 0.95 : active ? (type === 'parent' ? 0.6 : 0.42) : 0.28
  const opacity = dimmed ? base * 0.35 : base
  const lineWidth = type === 'parent' ? (focused ? 1.8 : 1.0) : focused ? 1.4 : 0.75
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
        dashSize={0.18}
        gapSize={0.22}
        toneMapped={false}
      />
      {active && (
        <EdgePulse3D
          points={points}
          activity={activity}
          focused={focused}
          type={type}
          phase={phase}
          color={color}
        />
      )}
    </group>
  )
}

// Travelling glow packets along an edge — multiple staggered particles so the
// edge reads as an animated 'energy string', not a single dot. Emissive
// materials are picked up by the bloom pass and become real glow streaks.
function EdgePulse3D({
  points,
  activity,
  focused,
  type,
  phase,
  color,
}: {
  points: THREE.Vector3[]
  activity: number
  focused: boolean
  type: EdgeType
  phase: number
  color: string
}) {
  const baseline =
    type === 'parent' ? 0.35 : type === 'depends_on' ? 0.25 : type === 'serves' ? 0.15 : 0.1
  const effective = Math.max(baseline, activity)
  const duration = focused ? 1.8 : 5.5 - effective * 3
  // Number of packets scales with effective activity — denser stream when busy
  const packetCount = focused
    ? 4
    : effective > 0.5
      ? 3
      : effective > 0.2
        ? 2
        : 1
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points])
  const size = focused ? 0.075 : 0.05 + effective * 0.025

  return (
    <>
      {Array.from({ length: packetCount }, (_, i) => (
        <EdgePulsePacket
          key={i}
          curve={curve}
          duration={duration}
          phase={(phase + i / packetCount) % 1}
          color={color}
          size={size}
          focused={focused}
        />
      ))}
    </>
  )
}

function EdgePulsePacket({
  curve,
  duration,
  phase,
  color,
  size,
  focused,
}: {
  curve: THREE.CatmullRomCurve3
  duration: number
  phase: number
  color: string
  size: number
  focused: boolean
}) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = (clock.elapsedTime / duration + phase) % 1
    curve.getPoint(t, ref.current.position)
    const mat = ref.current.material as THREE.MeshStandardMaterial
    const fade = Math.sin(t * Math.PI)
    mat.emissiveIntensity = (focused ? 4.5 : 3) * fade
    mat.opacity = (focused ? 1 : 0.9) * fade
  })
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[size, 10, 10]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={3}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// Concentric wireframe spheres per tier. Very faint — just enough for the
// eye to read the onion structure.
// ---------------------------------------------------------------------------

// Star field — a few thousand small points scattered in a large box around
// the origin. They sit beyond the fog plane so they read as a still
// backdrop. Tiny circular sprites with additive blending; bloom picks up
// the brightest ones.
function Starfield({
  count = 1400,
  radius = 90,
}: {
  count?: number
  radius?: number
}) {
  const points = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Distribute in a thick spherical shell so density doesn't crowd centre
      const r = radius * (0.55 + Math.random() * 0.45)
      const u = Math.random() * 2 - 1
      const theta = Math.random() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      arr[i * 3] = r * s * Math.cos(theta)
      arr[i * 3 + 1] = r * u * 0.6 // squash vertically — feels like a galaxy disc
      arr[i * 3 + 2] = r * s * Math.sin(theta)
    }
    return arr
  }, [count, radius])

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(points, 3))
    return g
  }, [points])

  return (
    <points geometry={geom}>
      <pointsMaterial
        color="#e8eef8"
        size={0.18}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

// Ambient drift — sparse glowing motes that slowly orbit the map's
// interior volume. They sit between the nodes (not the far starfield)
// to give the sense that the ecosystem is suspended in a thinking medium.
function DriftParticles({
  count = 240,
  radius = 16,
}: {
  count?: number
  radius?: number
}) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = radius * Math.cbrt(Math.random())
      const u = Math.random() * 2 - 1
      const theta = Math.random() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      arr[i * 3] = r * s * Math.cos(theta)
      arr[i * 3 + 1] = r * u
      arr[i * 3 + 2] = r * s * Math.sin(theta)
    }
    return arr
  }, [count, radius])

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [positions])

  const ref = useRef<THREE.Points>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    // Slow group drift — opposite spin from the camera autorotate so motes
    // feel independent of the scene, like dust in space
    ref.current.rotation.y = clock.elapsedTime * 0.012
    ref.current.rotation.x = Math.sin(clock.elapsedTime * 0.04) * 0.06
  })

  return (
    <points geometry={geom} ref={ref}>
      <pointsMaterial
        color={HEX.axis}
        size={0.09}
        sizeAttenuation
        transparent
        opacity={0.65}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

// ---------------------------------------------------------------------------
// Axis aureole — soft golden glow radiating outward. Three nested back-faced
// spheres with decreasing opacity fake a volumetric halo without a shader.
// ---------------------------------------------------------------------------

// Animate the OrbitControls target + camera distance only on selection
// changes. Once the animation converges we stop touching the camera so the
// user's zoom/pan/orbit gestures are respected. Previously this ran every
// frame and snapped the camera back to the default distance, which felt
// like an unwanted spring.
function CameraFocus({ selectedPos }: { selectedPos: THREE.Vector3 | null }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null
  const animRef = useRef<{ target: THREE.Vector3; dist: number } | null>(null)

  useEffect(() => {
    if (selectedPos) {
      animRef.current = { target: selectedPos.clone(), dist: 7 }
    } else {
      animRef.current = { target: new THREE.Vector3(0, 0, 0), dist: 24 }
    }
  }, [selectedPos])

  useFrame(() => {
    if (!controls || !animRef.current) return
    const anim = animRef.current
    controls.target.lerp(anim.target, 0.08)

    const dir = new THREE.Vector3().subVectors(camera.position, controls.target)
    const curDist = dir.length() || 0.001
    const nextDist = THREE.MathUtils.lerp(curDist, anim.dist, 0.06)
    dir.normalize().multiplyScalar(nextDist)
    camera.position.copy(controls.target).add(dir)
    controls.update()

    if (
      controls.target.distanceTo(anim.target) < 0.05 &&
      Math.abs(curDist - anim.dist) < 0.1
    ) {
      animRef.current = null
    }
  })
  return null
}

