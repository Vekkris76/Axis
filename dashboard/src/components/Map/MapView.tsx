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
import { AgentHUD } from './shared/AgentHUD'
import { ProjectsHUD } from './shared/ProjectsHUD'
import {
  HUD_AMBER,
  HUD_BG,
  HUD_BORDER,
  HUD_CYAN,
  HUD_TEXT,
  HUD_TEXT_DIM,
  HUD_TEXT_MUTED,
} from './shared/palette'

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
    <div
      className="relative flex h-full min-h-screen w-full flex-col"
      style={{ background: HUD_BG, color: HUD_TEXT }}
    >
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: `1px solid ${HUD_BORDER}` }}
      >
        <div className="flex items-center gap-3">
          <Link
            to="/"
            title={t('header.back')}
            className="flex h-8 w-8 items-center justify-center transition"
            style={{ color: HUD_TEXT_DIM }}
          >
            <ArrowLeft size={18} />
          </Link>
          <span
            className="font-mono text-xs uppercase tracking-[0.3em]"
            style={{ color: HUD_CYAN, textShadow: `0 0 6px ${HUD_CYAN}55` }}
          >
            Mesh
          </span>
          <span
            className="font-mono text-xs uppercase tracking-[0.2em]"
            style={{ color: HUD_TEXT_MUTED }}
          >
            / neural map
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ViewToggle mode={mode} onChange={setMode} />
          <span
            className="h-1.5 w-1.5"
            style={{
              background: health.connected ? HUD_AMBER : HUD_TEXT_MUTED,
              boxShadow: health.connected ? `0 0 6px ${HUD_AMBER}` : 'none',
            }}
          />
          <span
            className="font-mono text-[10px] uppercase tracking-[0.25em]"
            style={{ color: HUD_TEXT_DIM }}
          >
            {health.connected ? 'live' : 'desconectado'}
          </span>
          <Link
            to="/app"
            title={t('mesh.open_chat')}
            className="ml-2 flex h-8 w-8 items-center justify-center transition"
            style={{
              border: `1px solid ${HUD_BORDER}`,
              color: HUD_TEXT_DIM,
            }}
          >
            <MessageSquareMore size={16} />
          </Link>
        </div>
      </header>

      <main className="relative flex-1 overflow-hidden">
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
          <>
            <AgentHUD
              nodes={data.nodes}
              selected={selected}
              onSelect={(id) => setSelected((prev) => (prev === id ? null : id))}
            />
            <ProjectsHUD
              projects={data.projects}
              selected={selected}
              onSelect={(nodeId) =>
                setSelected((prev) => (prev === nodeId ? null : nodeId))
              }
            />
          </>
        )}

        {displayedNode && data && (
          <Inspector
            node={displayedNode}
            projects={data.projects}
            nodes={data.nodes}
          />
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
  const btnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? HUD_CYAN : 'transparent',
    color: active ? HUD_BG : HUD_TEXT_DIM,
    boxShadow: active ? `0 0 8px ${HUD_CYAN}` : 'none',
  })
  return (
    <div
      className="flex items-center p-0.5"
      style={{ border: `1px solid ${HUD_BORDER}` }}
    >
      <button
        onClick={() => onChange('2d')}
        title="2D view"
        className="flex h-7 w-9 items-center justify-center text-xs transition"
        style={btnStyle(mode === '2d')}
      >
        <Network size={14} />
      </button>
      <button
        onClick={() => onChange('3d')}
        title="3D view"
        className="flex h-7 w-9 items-center justify-center text-xs transition"
        style={btnStyle(mode === '3d')}
      >
        <Box size={14} />
      </button>
    </div>
  )
}

function ViewLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <span
        className="font-mono text-[10px] uppercase tracking-[0.25em]"
        style={{ color: HUD_TEXT_DIM }}
      >
        loading 3d view…
      </span>
    </div>
  )
}
