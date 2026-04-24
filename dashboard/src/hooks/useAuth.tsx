import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import * as authApi from '../lib/auth'

type AuthState = {
  authenticated: boolean
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const ok = await authApi.me()
    setAuthenticated(ok)
    setLoading(false)
  }

  const logout = async () => {
    await authApi.logout()
    setAuthenticated(false)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const value: AuthState = { authenticated, loading, refresh, logout }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(AuthContext)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}
