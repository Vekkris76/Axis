import { v4 as uuid } from 'uuid'

const KEY = 'axis.sessionId'

export function getSessionId(): string {
  try {
    const existing = localStorage.getItem(KEY)
    if (existing) return existing
  } catch {
    // storage disabled; fall back to in-memory
  }
  const fresh = newSessionId()
  return fresh
}

export function newSessionId(): string {
  const id = `web-${uuid()}`
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // ignore
  }
  return id
}

export function clearSessionId(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
