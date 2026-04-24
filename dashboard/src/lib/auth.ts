const BASE = import.meta.env.DEV ? 'https://mesh.aura-digital.org' : ''

export type AuthError = 'invalid' | 'network' | 'unknown'

export async function login(password: string): Promise<{ ok: true } | { ok: false; error: AuthError }> {
  try {
    const r = await fetch(`${BASE}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ password }),
    })
    if (r.status === 401) return { ok: false, error: 'invalid' }
    if (!r.ok) return { ok: false, error: 'unknown' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'network' }
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${BASE}/api/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // ignore
  }
}

export async function me(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/api/me`, { credentials: 'include' })
    return r.status === 200
  } catch {
    return false
  }
}
