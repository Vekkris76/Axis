// Neural map shell.
//
// Hosts the header, inspector, project rail, and the 2D/3D toggle. The map
// route is a light-theme island: white background, charcoal ink, pastel
// accents. The rest of the dashboard keeps its dark chrome for now.

import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Box, MessageSquareMore, Network } from 'lucide-react'
import { t } from '../../lib/i18n'
import { useGatewayHealth } from '../../hooks/useGatewayHealth'
import { useEcosystem } from '../../hooks/useEcosystem'
import { MapView2D } from './MapView2D'
import { Inspector } from './shared/Inspector'
import { ProjectRail } from './shared/ProjectRail'
import { INK_LINE, INK_MUTED } from './shared/palette'

// 3D view (and its three.js/drei/r3f deps) is code-split so the 2D path
// doesn't pay its bundle cost.
const MapView3D = lazy(() =>
  import('./MapView3D').then((m) => ({ default: m.MapView3D })),
)

type ViewMode = '2d' | '3d'
const STORAGE_KEY = 'mesh.view-mode'

function loadViewMode(): ViewMode {
  if (typeof localStorage === 'undefined') return '2d'
  const v = localStorage.getItem(STORAGE_KEY)
  return v === '3d' ? '3d' : '2d'
}

export function MapView() {
  const ecosystem = useEcosystem()
  const health = useGatewayHealth()
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [mode, setMode] = useState<ViewMode>(() => loadViewMode())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // ignore
    }
  }, [mode])

  const data = ecosystem.data
    ? {
        nodes: ecosystem.data.nodes,
        edges: ecosystem.data.edges,
        projects: ecosystem.data.projects ?? [],
      }
    : null

  const displayedNode = useMemo(() => {
    if (!data) return null
    const id = hovered ?? selected
    if (!id) return null
    return data.nodes.find((n) => n.id === id) ?? null
  }, [data, hovered, selected])

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col bg-white text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            title={t('header.back')}
            className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition hover:text-neutral-900"
          >
            <ArrowLeft size={18} />
          </Link>
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-neutral-900">
            Mesh
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-400">
            / neural map
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle mode={mode} onChange={setMode} />
          <span
            className={
              'h-1.5 w-1.5 rounded-full ' +
              (health.connected ? 'bg-neutral-800' : 'bg-neutral-300')
            }
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-500">
            {health.connected ? 'live' : 'desconectado'}
          </span>
          <Link
            to="/app"
            title={t('mesh.open_chat')}
            className="ml-2 flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 text-neutral-500 transition hover:border-neutral-500 hover:text-neutral-900"
          >
            <MessageSquareMore size={16} />
          </Link>
        </div>
      </header>

      <main className="map-bruma relative flex-1 overflow-hidden">
        {mode === '2d' ? (
          <MapView2D
            ecosystem={data}
            hovered={hovered}
            setHovered={setHovered}
            selected={selected}
            setSelected={setSelected}
          />
        ) : (
          <Suspense fallback={<ViewLoading />}>
            <MapView3D
              ecosystem={data}
              hovered={hovered}
              setHovered={setHovered}
              selected={selected}
              setSelected={setSelected}
            />
          </Suspense>
        )}

        {data && (
          <ProjectRail
            projects={data.projects}
            selected={selected}
            onSelect={(nodeId) =>
              setSelected((prev) => (prev === nodeId ? null : nodeId))
            }
          />
        )}

        {displayedNode && data && (
          <Inspector node={displayedNode} projects={data.projects} />
        )}

        {mode === '2d' && (
          <div
            className="pointer-events-none absolute top-4 right-4 flex flex-col items-end gap-1 font-mono text-[10px] uppercase tracking-[0.2em]"
            style={{ color: INK_MUTED }}
          >
            <EdgeLegend label="parent" kind="solid" weight={1.6} />
            <EdgeLegend label="depends on" kind="solid" weight={1} />
            <EdgeLegend label="collaborates" kind="dashed" weight={0.8} />
          </div>
        )}
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// View toggle
// ---------------------------------------------------------------------------

function ViewToggle({
  mode,
  onChange,
}: {
  mode: '2d' | '3d'
  onChange: (m: '2d' | '3d') => void
}) {
  return (
    <div className="flex items-center rounded-md border border-neutral-300 p-0.5">
      <button
        onClick={() => onChange('2d')}
        title="2D view"
        className={
          'flex h-7 w-9 items-center justify-center rounded text-xs transition ' +
          (mode === '2d'
            ? 'bg-neutral-900 text-white'
            : 'text-neutral-500 hover:text-neutral-900')
        }
      >
        <Network size={14} />
      </button>
      <button
        onClick={() => onChange('3d')}
        title="3D view"
        className={
          'flex h-7 w-9 items-center justify-center rounded text-xs transition ' +
          (mode === '3d'
            ? 'bg-neutral-900 text-white'
            : 'text-neutral-500 hover:text-neutral-900')
        }
      >
        <Box size={14} />
      </button>
    </div>
  )
}

function ViewLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-neutral-500">
        loading 3d view…
      </span>
    </div>
  )
}

function EdgeLegend({
  label,
  kind,
  weight,
}: {
  label: string
  kind: 'solid' | 'dashed'
  weight: number
}) {
  return (
    <div className="flex items-center gap-2">
      <svg width="26" height="8">
        <line
          x1="1"
          y1="4"
          x2="25"
          y2="4"
          stroke={INK_LINE}
          strokeWidth={weight}
          strokeDasharray={kind === 'dashed' ? '2 6' : undefined}
        />
      </svg>
      <span>{label}</span>
    </div>
  )
}
