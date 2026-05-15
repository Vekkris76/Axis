// Mesh neural map — 3D view. Written from scratch, InfraNodus-inspired.
// No legacy code from earlier iterations is reused.
//
// Visual rules:
//   - Each node is a single emissive sphere. Size encodes structural
//     centrality. Colour encodes which project cluster it belongs to.
//   - Axis sits at the origin and is the largest, in amber.
//   - All edges are drawn at rest as faint filaments; the focused node's
//     edges brighten and the rest dim.
//   - Labels are always shown for the structural backbone (Axis, every
//     project, every active agent). Everything else reveals on hover.
//   - Canvas is a dark navy field with a subtle bloom pass — enough glow
//     to read as a "neural network" but not enough to wash out colour.

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { EcoEdge, EcoNode, EcoProject } from '../../hooks/useEcosystem'
import {
  clusterColorFor,
  HUD_AMBER,
  HUD_BG,
  HUD_CYAN,
  HUD_TEXT,
  HUD_TEXT_DIM,
} from './shared/palette'

// ---------------------------------------------------------------------------
// Positioning — three concentric rings on a near-flat plane. Axis at the
// origin; projects at the inner ring; agents at the middle ring; pure
// infrastructure (skill/provider/channel) at the outer ring. A tiny Z
// jitter keeps the layout from feeling like a flat poster without making
// the user fight the camera.
// ---------------------------------------------------------------------------

type Placed = {
  node: EcoNode
  position: THREE.Vector3
  radius: number  // visual radius of the sphere
}

const RING_RADIUS: Record<'project' | 'agent' | 'periphery', number> = {
  agent: 7,
  project: 12,
  periphery: 17,
}

function ringForKind(kind: EcoNode['kind']): 'project' | 'agent' | 'periphery' {
  if (kind === 'project') return 'project'
  if (kind === 'agent') return 'agent'
  return 'periphery'
}

function placeNodes(nodes: EcoNode[]): Placed[] {
  // Bucket nodes by ring
  const buckets: Record<'project' | 'agent' | 'periphery', EcoNode[]> = {
    agent: [],
    project: [],
    periphery: [],
  }
  for (const n of nodes) {
    if (n.id === 'axis') continue
    buckets[ringForKind(n.kind)].push(n)
  }
  // Stable order so the layout is reproducible
  for (const ring of Object.keys(buckets) as Array<keyof typeof buckets>) {
    buckets[ring].sort((a, b) => a.label.localeCompare(b.label))
  }

  const placed: Placed[] = []

  // Axis at the centre — its size scales with the total nodes so it
  // never gets dwarfed in dense ecosystems.
  const axis = nodes.find((n) => n.id === 'axis')
  if (axis) {
    placed.push({
      node: axis,
      position: new THREE.Vector3(0, 0, 0),
      radius: 0.95,
    })
  }

  // Place each bucket evenly around its ring
  for (const ring of ['agent', 'project', 'periphery'] as const) {
    const items = buckets[ring]
    const radius = RING_RADIUS[ring]
    const n = items.length
    items.forEach((node, i) => {
      const angle = (i / Math.max(n, 1)) * Math.PI * 2 + (ring === 'agent' ? 0.3 : 0)
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      // Tiny z jitter — alternate inward/outward by index for depth cues
      const z = ((i % 2) - 0.5) * 0.6
      const r = ring === 'project' ? 0.55 : ring === 'agent' ? 0.42 : 0.28
      placed.push({
        node,
        position: new THREE.Vector3(x, y, z),
        radius: r,
      })
    })
  }
  return placed
}

// Deduplicate edges by unordered pair. Multiple semantic relations
// between the same two nodes collapse into a single visible line.
function dedupEdges(edges: EcoEdge[]): EcoEdge[] {
  const rank = (t?: string): number =>
    t === 'parent'
      ? 4
      : t === 'depends_on'
        ? 3
        : t === 'serves'
          ? 2
          : t === 'collaborates_with'
            ? 1
            : 0
  const byPair = new Map<string, EcoEdge>()
  for (const e of edges) {
    const key = [e.from, e.to].sort().join('|')
    const existing = byPair.get(key)
    if (!existing || rank(e.type) > rank(existing.type)) {
      byPair.set(key, e)
    }
  }
  return Array.from(byPair.values())
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function NodeDot({
  placed,
  color,
  hovered,
  selected,
  dimmed,
  showLabel,
  onHover,
  onSelect,
}: {
  placed: Placed
  color: string
  hovered: boolean
  selected: boolean
  dimmed: boolean
  showLabel: boolean
  onHover: (v: boolean) => void
  onSelect: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const focused = hovered || selected
  const isAxis = placed.node.id === 'axis'

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const mat = meshRef.current.material as THREE.MeshStandardMaterial
    const breath = 0.85 + 0.15 * Math.sin(clock.elapsedTime * 1.2)
    const activity = placed.node.activity ?? 0
    const base = isAxis ? 2.6 : focused ? 2.2 : 1.1
    mat.emissiveIntensity =
      (base + activity * 1.5) * (dimmed ? 0.35 : 1) * (focused ? 1 : breath)
    mat.color.set(focused ? HUD_AMBER : color)
    mat.emissive.set(focused ? HUD_AMBER : color)
  })

  return (
    <group position={placed.position}>
      <mesh
        ref={meshRef}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation()
          onHover(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          onHover(false)
          document.body.style.cursor = 'auto'
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation()
          onSelect()
        }}
      >
        <sphereGeometry args={[placed.radius, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.1}
          roughness={0.4}
          metalness={0}
          toneMapped={false}
        />
      </mesh>

      {/* Axis-only halo for the hub */}
      {isAxis && (
        <mesh>
          <sphereGeometry args={[placed.radius * 2.4, 18, 18]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.1}
            side={THREE.BackSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}

      {showLabel && (
        <Html
          position={[0, -placed.radius - 0.45, 0]}
          center
          distanceFactor={14}
          occlude={false}
          style={{ pointerEvents: 'none' }}
        >
          <div
            className="select-none font-mono uppercase"
            style={{
              color: focused ? HUD_AMBER : color,
              fontSize: isAxis ? 13 : 10,
              letterSpacing: isAxis ? '0.3em' : '0.22em',
              fontWeight: isAxis ? 600 : 500,
              textShadow: `0 0 6px ${focused ? HUD_AMBER : color}aa`,
              opacity: dimmed ? 0.35 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {placed.node.label}
          </div>
        </Html>
      )}
    </group>
  )
}

function EdgeLine({
  a,
  b,
  color,
  focused,
  dimmed,
}: {
  a: THREE.Vector3
  b: THREE.Vector3
  color: string
  focused: boolean
  dimmed: boolean
}) {
  const opacity = dimmed ? 0.05 : focused ? 0.85 : 0.16
  const lineWidth = focused ? 1.6 : 0.55
  return (
    <Line
      points={[a, b]}
      color={color}
      lineWidth={lineWidth}
      transparent
      opacity={opacity}
      toneMapped={false}
    />
  )
}

// ---------------------------------------------------------------------------
// Camera focus — animate only on selection change so user zoom is preserved.
// ---------------------------------------------------------------------------

type OrbitCtrl = { target: THREE.Vector3; update: () => void }

function CameraFocus({ target }: { target: THREE.Vector3 | null }) {
  const ref = useRef<{ target: THREE.Vector3 } | null>(null)
  useEffect(() => {
    ref.current = { target: target ? target.clone() : new THREE.Vector3(0, 0, 0) }
  }, [target])
  useFrame((state) => {
    const ctrl = state.controls as unknown as OrbitCtrl | null
    if (!ctrl || !ref.current) return
    const t = ref.current.target
    ctrl.target.lerp(t, 0.08)
    ctrl.update()
  })
  return null
}

// ---------------------------------------------------------------------------
// Root component — the only exported member, matches MapView's interface.
// ---------------------------------------------------------------------------

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
  const nodes = ecosystem?.nodes ?? []
  const edges = ecosystem?.edges ?? []
  const projects = ecosystem?.projects ?? []

  const placed = useMemo(() => placeNodes(nodes), [nodes])
  const positionById = useMemo(() => {
    const m = new Map<string, THREE.Vector3>()
    for (const p of placed) m.set(p.node.id, p.position)
    return m
  }, [placed])

  const clusterColor = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of placed) {
      m.set(p.node.id, clusterColorFor(p.node.id, p.node.kind, projects))
    }
    return m
  }, [placed, projects])

  const visibleEdges = useMemo(() => dedupEdges(edges), [edges])
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

  // Persistent labels: Axis + every project + every active agent
  const persistentLabel = (n: EcoNode): boolean => {
    if (n.id === 'axis') return true
    if (n.kind === 'project') return true
    if (n.kind === 'agent' && n.active) return true
    return false
  }

  const focusTarget = useMemo(() => {
    if (!selected) return null
    return positionById.get(selected) ?? null
  }, [selected, positionById])

  const [boostKey, setBoostKey] = useState(0)
  useEffect(() => {
    if (focusedId) setBoostKey((k) => k + 1)
  }, [focusedId])

  return (
    <div className="absolute inset-0" onClick={() => setSelected(null)}>
      <Canvas
        camera={{ position: [0, -2, 28], fov: 45, near: 0.1, far: 200 }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        dpr={[1, 2]}
        style={{ background: HUD_BG }}
      >
        <color attach="background" args={[HUD_BG]} />
        <fog attach="fog" args={[HUD_BG, 35, 90]} />

        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 12, 18]} intensity={0.3} />

          {/* Edges — InfraNodus filaments */}
          {visibleEdges.map((e) => {
            const a = positionById.get(e.from)
            const b = positionById.get(e.to)
            if (!a || !b) return null
            const isFocused =
              focusedId !== null && (e.from === focusedId || e.to === focusedId)
            const isDimmed = focusedId !== null && !isFocused
            const color = clusterColor.get(e.from) ?? HUD_TEXT_DIM
            return (
              <EdgeLine
                key={`${e.from}|${e.to}`}
                a={a}
                b={b}
                color={color}
                focused={isFocused}
                dimmed={isDimmed}
              />
            )
          })}

          {/* Nodes */}
          {placed.map((p) => {
            const isSel = selected === p.node.id
            const isHov = hovered === p.node.id
            const isDimmed = related !== null && !related.has(p.node.id)
            const showLabel = persistentLabel(p.node) || isHov || isSel
            return (
              <NodeDot
                key={p.node.id}
                placed={p}
                color={clusterColor.get(p.node.id) ?? HUD_CYAN}
                hovered={isHov}
                selected={isSel}
                dimmed={isDimmed}
                showLabel={showLabel}
                onHover={(v) => setHovered(v ? p.node.id : null)}
                onSelect={() =>
                  setSelected((prev) => (prev === p.node.id ? null : p.node.id))
                }
              />
            )
          })}

          <OrbitControls
            makeDefault
            enablePan
            enableZoom
            enableDamping
            dampingFactor={0.12}
            minDistance={8}
            maxDistance={60}
            rotateSpeed={0.4}
            panSpeed={0.6}
            zoomSpeed={0.6}
          />
          <CameraFocus target={focusTarget} key={boostKey} />

          <EffectComposer>
            <Bloom
              intensity={0.85}
              luminanceThreshold={0.35}
              luminanceSmoothing={0.75}
              mipmapBlur
              radius={0.55}
            />
          </EffectComposer>
        </Suspense>
      </Canvas>

      {/* Top-left subtle text reminding the user how to interact */}
      <div
        className="pointer-events-none absolute left-4 bottom-4 font-mono text-[9px] uppercase tracking-[0.3em]"
        style={{ color: HUD_TEXT, opacity: 0.4 }}
      >
        click · drag · scroll
      </div>
    </div>
  )
}
