const BASE = import.meta.env.DEV ? 'https://mesh.aura-digital.org' : ''

export type ChatResponse = {
  reply: string
  sessionId: string
  durationMs: number
  status: string
}

export type ChatError =
  | { kind: 'auth' }
  | { kind: 'rate' }
  | { kind: 'bad_request'; detail: string }
  | { kind: 'server'; detail: string }
  | { kind: 'network' }

export async function sendChat(
  message: string,
  sessionId: string,
): Promise<{ ok: true; data: ChatResponse } | { ok: false; error: ChatError }> {
  try {
    const r = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ message, sessionId }),
    })

    if (r.status === 401) return { ok: false, error: { kind: 'auth' } }
    if (r.status === 429) return { ok: false, error: { kind: 'rate' } }
    if (r.status === 400) {
      const body = (await r.json().catch(() => ({}))) as { detail?: string }
      return { ok: false, error: { kind: 'bad_request', detail: body.detail ?? '' } }
    }
    if (!r.ok) {
      const body = (await r.json().catch(() => ({}))) as { detail?: string }
      return { ok: false, error: { kind: 'server', detail: body.detail ?? `http ${r.status}` } }
    }

    const data = (await r.json()) as ChatResponse
    return { ok: true, data }
  } catch {
    return { ok: false, error: { kind: 'network' } }
  }
}
