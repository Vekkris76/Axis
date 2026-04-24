import { createBrowserRouter, Navigate } from 'react-router'
import { Mesh } from './components/Mesh'
import { Login } from './components/Login'
import { Chat } from './components/Chat/Chat'
import { MapView } from './components/Map/MapView'
import { useAuth } from './hooks/useAuth'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { authenticated, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <span className="font-mono text-xs uppercase tracking-[0.25em] text-hangar-muted">
          loading…
        </span>
      </div>
    )
  }
  if (!authenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function LoginOrRedirect() {
  const { authenticated, loading } = useAuth()
  if (loading) return null
  if (authenticated) return <Navigate to="/app" replace />
  return <Login />
}

export const router = createBrowserRouter([
  { path: '/', element: <Mesh /> },
  { path: '/login', element: <LoginOrRedirect /> },
  { path: '/map', element: <MapView /> },
  {
    path: '/app',
    element: (
      <RequireAuth>
        <Chat />
      </RequireAuth>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
