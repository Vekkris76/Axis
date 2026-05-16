// Neural map shell.
//
// Hosts the header, inspector, project rail, and the 2D/3D toggle. The map
// route supports both light and dark themes; the user toggles via the
// sun/moon button in the header. Default is dark to match the landing.

import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Box, MessageSquareMore, Moon, Network, Sun } from 'lucide-react'
import { t } from '../../lib/i18n'
import { useGatewayHealth } from '../../hooks/useGatewayHealth'
import { useEcosystem } from '../../hooks/useEcosystem'
import { MapView2D } from './MapView2D'
import { Inspector } from './shared/Inspector'
import { AgentHUD } from './shared/AgentHUD'
import { ProjectsHUD } from './shared/ProjectsHUD'
import { INK_LINE, INK_MUTED, type MapTheme, getMapTheme, setMapTheme } from './shared/palette'

// 3D view (and its three.js/drei/r3f deps) is code-split so the 2D path
// doesn't pay its bundle cost.
const MapView3D = lazy(() =>
  import('./MapView3D').then((m) => ({ default: m.MapView3D })),
)

type ViewMode = '2d' | '3d'
const VIEW_KEY = 'mesh.view-mode'

function loadViewMode(): ViewMode {
  if (typeof localStorage === 'undefined') return '2d'
  const v = localStorage.getItem(VIEW_KEY)
  return v === '3d' ? '3d' : '2d'
}

export function MapView() {
  const ecosystem = useEcosystem()
  const health = useGatewayHealth()
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [mode, setMode] = useState<ViewMode>(() => loadViewMode())
  const [theme, setThemeState] = useState<MapTheme>(() => getMapTheme())

  const setTheme = (t: MapTheme) => {
    setMapTheme(t)
    setThemeState(t)
  }

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, mode)
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

  const isDark = theme === 'dark'
  const shellClass = isDark
    ? 'bg-slate-950 text-slate-100'
    : 'bg-white text-neutral-900'
  const headerBorder = isDark ? 'border-slate-800' : 'border-neutral-200'
  const mutedText = isDark ? 'text-slate-400' : 'text-neutral-500'
  const labelText = isDark ? 'text-slate-100' : 'text-neutral-900'
  const dimText = isDark ? 'text-slate-500' : 'text-neutral-400'
  const linkHover = isDark ? 'hover:text-slate-100' : 'hover:text-neutral-900'
  const linkBox = isDark
    ? 'border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-100'
    : 'border-neutral-300 hover:border-neutral-500 text-neutral-500 hover:text-neutral-900'
  const dotOn = isDark ? 'bg-slate-200' : 'bg-neutral-800'
  const dotOff = isDark ? 'bg-slate-700' : 'bg-neutral-300'

  return (
    <div className={`relative flex h-full min-h-screen w-full flex-col ${shellClass}`}>
      <header className={`flex items-center justify-between border-b ${headerBorder} px-6 py-4`}>
        <div className="flex items-center gap-3">
          <Link
            to="/"
            title={t('header.back')}
            className={`flex h-8 w-8 items-center justify-center rounded-md ${mutedText} ${linkHover} transition`}
          >
            <ArrowLeft size={18} />
          </Link>
          <span className={`font-mono text-xs uppercase tracking-[0.3em] ${labelText}`}>
            Mesh
          </span>
          <span className={`font-mono text-xs uppercase tracking-[0.2em] ${dimText}`}>
            / neural map
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle theme={theme} onChange={setTheme} isDark={isDark} />
          <ViewToggle mode={mode} onChange={setMode} isDark={isDark} />
          <span
            className={
              'h-1.5 w-1.5 rounded-full ' + (health.connected ? dotOn : dotOff)
            }
          />
          <span className={`font-mono text-[10px] uppercase tracking-[0.25em] ${mutedText}`}>
            {health.connected ? 'live' : 'desconectado'}
          </span>
          <Link
            to="/app"
            title={t('mesh.open_chat')}
            className={`ml-2 flex h-8 w-8 items-center justify-center rounded-md border ${linkBox} transition`}
          >
            <MessageSquareMore size={16} />
          </Link>
        </div>
      </header>

      <main
        key={theme}
        className={`map-bruma ${isDark ? 'map-bruma--dark' : ''} relative flex-1 overflow-hidden`}
      >
        {mode === '2d' ? (
          <MapView2D
            ecosystem={data}
            hovered={hovered}
            setHovered={setHovered}
            selected={selected}
            setSelected={setSelected}
          />
        ) : (
          <Suspense fallback={<ViewLoading isDark={isDark} />}>
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
              onSelect={(id) =>
                setSelected((prev) => (prev === id ? null : id))
              }
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
          <Inspector node={displayedNode} projects={data.projects} />
        )}

        {mode === '2d' && (
          <div
            className="pointer-events-none absolute bottom-4 right-4 flex flex-col items-end gap-1 font-mono text-[10px] uppercase tracking-[0.2em]"
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
// Toggles
// ---------------------------------------------------------------------------

function ThemeToggle({
  theme,
  onChange,
  isDark,
}: {
  theme: MapTheme
  onChange: (t: MapTheme) => void
  isDark: boolean
}) {
  const box = isDark ? 'border-slate-700' : 'border-neutral-300'
  const activeCls = isDark ? 'bg-slate-200 text-slate-900' : 'bg-neutral-900 text-white'
  const idleCls = isDark ? 'text-slate-400 hover:text-slate-100' : 'text-neutral-500 hover:text-neutral-900'
  return (
    <div className={`flex items-center rounded-md border ${box} p-0.5`}>
      <button
        onClick={() => onChange('light')}
        title="Light theme"
        className={
          'flex h-7 w-9 items-center justify-center rounded text-xs transition ' +
          (theme === 'light' ? activeCls : idleCls)
        }
      >
        <Sun size={14} />
      </button>
      <button
        onClick={() => onChange('dark')}
        title="Dark theme"
        className={
          'flex h-7 w-9 items-center justify-center rounded text-xs transition ' +
          (theme === 'dark' ? activeCls : idleCls)
        }
      >
        <Moon size={14} />
      </button>
    </div>
  )
}

function ViewToggle({
  mode,
  onChange,
  isDark,
}: {
  mode: '2d' | '3d'
  onChange: (m: '2d' | '3d') => void
  isDark: boolean
}) {
  const box = isDark ? 'border-slate-700' : 'border-neutral-300'
  const activeCls = isDark ? 'bg-slate-200 text-slate-900' : 'bg-neutral-900 text-white'
  const idleCls = isDark ? 'text-slate-400 hover:text-slate-100' : 'text-neutral-500 hover:text-neutral-900'
  return (
    <div className={`flex items-center rounded-md border ${box} p-0.5`}>
      <button
        onClick={() => onChange('2d')}
        title="2D view"
        className={
          'flex h-7 w-9 items-center justify-center rounded text-xs transition ' +
          (mode === '2d' ? activeCls : idleCls)
        }
      >
        <Network size={14} />
      </button>
      <button
        onClick={() => onChange('3d')}
        title="3D view"
        className={
          'flex h-7 w-9 items-center justify-center rounded text-xs transition ' +
          (mode === '3d' ? activeCls : idleCls)
        }
      >
        <Box size={14} />
      </button>
    </div>
  )
}

function ViewLoading({ isDark }: { isDark: boolean }) {
  const cls = isDark ? 'text-slate-500' : 'text-neutral-500'
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className={`font-mono text-[10px] uppercase tracking-[0.25em] ${cls}`}>
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
