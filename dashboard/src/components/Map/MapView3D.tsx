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
import * as THREE from 'three'

// OrbitControls type — imported from drei indirectly via three-stdlib, but
// drei re-exports it. Using the runtime type via a minimal shape keeps us
// independent of the stdlib package.
type OrbitControlsImpl = {
  target: THREE.Vector3
  update: () => void
}
import type { EcoEdge, EcoNode, EcoProject, EdgeType } from '../../hooks/useEcosystem'
import { edgeColor, HEX, nodeHex, nodeCoreHex, phaseFor } from './shared/palette'
import {
  normalizedCentrality,
  TIER_RADIUS_3D,
  tierFor,
  type Tier,
} from './shared/layout'

// Base node size per kind in world units.
const BASE_SIZE: Record<string, number> = {
  agent: 0.32,
  project: 0.4,
  skill: 0.22,
  provider: 0.26,
  channel: 0.22,
}

function baseSize(n: EcoNode): number {
  if (n.id === 'axis') return 0.85
  return BASE_SIZE[n.kind] ?? 0.22
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
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: true }}
        dpr={[1, 2]}
        style={{ background: 'transparent' }}
      >
        {/* No color attach — transparent canvas lets the parent's animated
            mist bleed through. Fog fades distant nodes toward white so the
            depth cue still works. */}
        <fog attach="fog" args={[HEX.bg, 32, 80]} />

        <Suspense fallback={null}>
          <ambientLight intensity={0.95} />
          <directionalLight position={[12, 18, 10]} intensity={0.3} />

          <CubeShells />
          <AxisAureole />

          {/* Edges first so nodes render on top */}
          {edges.map((e) => {
            const a = posById.get(e.from)
            const b = posById.get(e.to)
            if (!a || !b) return null
            const focused =
              hovered === a.id ||
              hovered === b.id ||
              selected === a.id ||
              selected === b.id
            const dimmed = focusedId !== null && !focused
            return (
              <Edge3D
                key={`${e.from}-${e.to}-${e.type ?? 'link'}`}
                a={a}
                b={b}
                type={(e.type ?? 'link') as EdgeType}
                active={e.active}
                activity={e.activity ?? 0}
                focused={focused}
                dimmed={dimmed}
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
  const shellRef = useRef<THREE.LineSegments>(null)
  const haloColor = useMemo(() => nodeHex(node), [node])
  const coreColor = useMemo(() => nodeCoreHex(node), [node])
  const isAxis = node.id === 'axis'
  const isProject = node.kind === 'project'
  const focused = hovered || selected
  const phase = phaseFor(node.id)
  // Entry animation: stagger nodes in from the origin over ~1.5s total
  const entryDelay = (index / Math.max(total, 1)) * 0.9
  const entryDuration = 0.8
  const mountedAt = useRef<number | null>(null)

  // Shell geometry depends on shape kind. Projects are spheres; everything
  // else is a cube. Axis gets the crown.
  const shellGeom = useMemo(() => {
    const s = node.size * 2
    if (isProject) {
      return new THREE.EdgesGeometry(
        new THREE.IcosahedronGeometry(node.size, 1),
        18,
      )
    }
    return new THREE.EdgesGeometry(new THREE.BoxGeometry(s, s, s))
  }, [node.size, isProject])
  const crownGeom = useMemo(() => {
    if (!isAxis) return null
    const s = node.size * 3.2
    return new THREE.EdgesGeometry(new THREE.BoxGeometry(s, s, s))
  }, [isAxis, node.size])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (mountedAt.current === null) mountedAt.current = t

    // Entry animation: scale from 0 → 1 with easeOutBack-ish curve.
    if (groupRef.current) {
      const elapsed = t - (mountedAt.current ?? t) - entryDelay
      const p = Math.max(0, Math.min(1, elapsed / entryDuration))
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3)
      const scale = isAxis ? eased : eased
      groupRef.current.scale.setScalar(scale)
      groupRef.current.visible = p > 0
    }

    if (shellRef.current) {
      const period = 5 + phase * 2
      const pulse = 0.6 + 0.4 * Math.sin((t / period + phase) * Math.PI * 2)
      const mat = shellRef.current.material as THREE.LineBasicMaterial
      const baseOp = focused ? 0.98 : node.active ? 0.85 : 0.45
      // Softer dim — 0.5 instead of 0.22
      const dim = dimmed ? 0.5 : 1
      mat.opacity = baseOp * (0.75 + 0.25 * pulse) * dim
      // Focus mode: tint the envelope gold when this node is the target
      mat.color.set(focused ? HEX.focusGold : haloColor)
    }

    if (coreRef.current) {
      const mat = coreRef.current.material as THREE.MeshStandardMaterial
      mat.opacity = dimmed ? 0.6 : 1
      mat.transparent = dimmed
      if (isAxis) coreRef.current.rotation.y = t * 0.12
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

  // Core is small relative to the wireframe shell: the shell is the visual
  // envelope, the core is the mark inside it.
  const coreSize = isAxis ? node.size * 0.78 : isProject ? node.size * 0.5 : node.size * 0.44

  return (
    <group ref={groupRef} position={node.position}>
      {/* Grayscale solid core — sphere for projects, cube for everyone else */}
      <mesh ref={coreRef} {...handlers}>
        {isProject ? (
          <sphereGeometry args={[coreSize, 24, 24]} />
        ) : (
          <boxGeometry args={[coreSize, coreSize, coreSize]} />
        )}
        <meshStandardMaterial
          color={coreColor}
          roughness={0.55}
          metalness={isAxis ? 0.45 : 0.08}
        />
      </mesh>

      {/* Pastel wireframe shell — the family accent */}
      <lineSegments ref={shellRef} geometry={shellGeom}>
        <lineBasicMaterial
          color={haloColor}
          transparent
          opacity={focused ? 0.95 : 0.7}
        />
      </lineSegments>

      {/* Axis crown — wireframe sphere in deep gold */}
      {isAxis && crownGeom && (
        <lineSegments geometry={crownGeom}>
          <lineBasicMaterial color={HEX.axisGold} transparent opacity={0.5} />
        </lineSegments>
      )}

      {/* Focused-only outline: a second trace of the shell in focus gold */}
      {!isAxis && focused && (
        <lineSegments geometry={shellGeom}>
          <lineBasicMaterial color={HEX.focusGold} transparent opacity={0.75} />
        </lineSegments>
      )}

      {(isAxis || focused) && (
        <Html
          position={[0, -node.size - 0.35, 0]}
          center
          distanceFactor={14}
          occlude={false}
          style={{ pointerEvents: 'none' }}
        >
          <div className="select-none text-center">
            <div
              className="font-sans text-[13px]"
              style={{
                color: HEX.ink,
                fontWeight: isAxis ? 600 : 400,
                textShadow: '0 0 6px rgba(255,255,255,0.9)',
              }}
            >
              {node.label}
            </div>
            {node.sublabel && (
              <div
                className="font-mono text-[9px] uppercase tracking-[0.15em]"
                style={{ color: HEX.inkMuted }}
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

  const base = focused ? 0.95 : active ? (type === 'parent' ? 0.72 : 0.52) : 0.38
  // Softer dim — 0.45 instead of the earlier 0.18
  const opacity = dimmed ? base * 0.45 : base
  const lineWidth = type === 'parent' ? (focused ? 2.4 : 1.6) : focused ? 1.8 : 1.1
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
  activity,
  focused,
  type,
  phase,
}: {
  points: THREE.Vector3[]
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
    const fade = Math.sin(t * Math.PI)
    mat.opacity = (focused ? 1 : 0.7) * fade
  })

  const size = focused ? 0.06 : 0.04 + effective * 0.02

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[size, 10, 10]} />
      <meshBasicMaterial color={HEX.ink} transparent depthWrite={false} />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// Concentric wireframe spheres per tier. Very faint — just enough for the
// eye to read the onion structure.
// ---------------------------------------------------------------------------

function CubeShells() {
  // Concentric wireframe cubes. Two passes per tier:
  //   1) A subdivided grid (4×4×4) with low opacity — the "paper grid"
  //      texture that adds more divisions and reads as structure.
  //   2) The outer 12 edges at higher opacity — the hard silhouette.
  // Outer tiers get progressively bolder silhouettes so the outermost cube
  // is the darkest and anchors the composition; inner tiers recede.
  return (
    <group>
      {([1, 2, 3] as Tier[]).map((t) => {
        const r = TIER_RADIUS_3D[t]
        const size = r * 2
        // Outer silhouette: just the 12 corner edges
        const silhouette = new THREE.EdgesGeometry(
          new THREE.BoxGeometry(size, size, size),
        )
        // Subdivided grid for the "more divisions" look
        const gridOp = 0.08 + (t - 1) * 0.04 // inner tier faintest
        const silhouetteOp = 0.28 + (t - 1) * 0.26 // outer tier strongest
        const silhouetteWidth = 1 + (t - 1) * 1
        return (
          <group key={t}>
            {/* Subdivided grid face lines */}
            <mesh>
              <boxGeometry
                args={[size, size, size, 4, 4, 4]}
              />
              <meshBasicMaterial
                color={HEX.inkMuted}
                transparent
                opacity={gridOp}
                wireframe
                depthWrite={false}
              />
            </mesh>
            {/* Outer silhouette — crisper and darker for outer tiers */}
            <lineSegments geometry={silhouette}>
              <lineBasicMaterial
                color={HEX.ink}
                transparent
                opacity={silhouetteOp}
                linewidth={silhouetteWidth}
              />
            </lineSegments>
          </group>
        )
      })}
    </group>
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

function AxisAureole() {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    // Gentle breathing — ±4% scale, very slow
    const s = 1 + Math.sin(t * 0.25) * 0.04
    ref.current.scale.setScalar(s)
  })
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[1.5, 32, 24]} />
        <meshBasicMaterial
          color={HEX.axis}
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.5, 32, 24]} />
        <meshBasicMaterial
          color={HEX.axis}
          transparent
          opacity={0.06}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[4, 32, 24]} />
        <meshBasicMaterial
          color={HEX.axisGold}
          transparent
          opacity={0.025}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
