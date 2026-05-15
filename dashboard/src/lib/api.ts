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

export type ChatStreamHandlers = {
  onThinking?: () => void
  onDelta: (text: string) => void
  onDone: (data: ChatResponse) => void
}

// Stream a chat reply token-by-token from /api/chat/stream. The endpoint
// emits SSE events: `thinking` (immediately), `delta` { text } (per token),
// then `done` (the full response payload) — or `error` if something fails.
export async function streamChat(
  message: string,
  sessionId: string,
  handlers: ChatStreamHandlers,
): Promise<{ ok: true } | { ok: false; error: ChatError }> {
  let r: Response
  try {
    r = await fetch(`${BASE}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      credentials: 'include',
      body: JSON.stringify({ message, sessionId }),
    })
  } catch {
    return { ok: false, error: { kind: 'network' } }
  }

  if (r.status === 401) return { ok: false, error: { kind: 'auth' } }
  if (r.status === 429) return { ok: false, error: { kind: 'rate' } }
  if (r.status === 400) {
    const body = (await r.json().catch(() => ({}))) as { detail?: string }
    return { ok: false, error: { kind: 'bad_request', detail: body.detail ?? '' } }
  }
  if (!r.ok || !r.body) {
    const body = (await r.json().catch(() => ({}))) as { detail?: string }
    return { ok: false, error: { kind: 'server', detail: body.detail ?? `http ${r.status}` } }
  }

  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let streamError: ChatError | null = null

  const handleEvent = (event: string, data: string) => {
    try {
      if (event === 'thinking') {
        handlers.onThinking?.()
        return
      }
      if (event === 'delta') {
        const parsed = JSON.parse(data) as { text: string }
        if (typeof parsed.text === 'string') handlers.onDelta(parsed.text)
        return
      }
      if (event === 'done') {
        const parsed = JSON.parse(data) as ChatResponse
        handlers.onDone(parsed)
        return
      }
      if (event === 'error') {
        const parsed = JSON.parse(data) as { status?: number; detail?: string }
        if (parsed.status === 401) streamError = { kind: 'auth' }
        else if (parsed.status === 429) streamError = { kind: 'rate' }
        else streamError = { kind: 'server', detail: parsed.detail ?? 'stream error' }
      }
    } catch {
      // ignore malformed event
    }
  }

  // SSE format: events are separated by a blank line. Each event has one
  // or more `field: value` lines. We accumulate until we see a blank line,
  // then dispatch.
  let currentEvent = 'message'
  let currentData = ''

  const flush = () => {
    if (currentData) handleEvent(currentEvent, currentData)
    currentEvent = 'message'
    currentData = ''
  }

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, nl).replace(/\r$/, '')
      buffer = buffer.slice(nl + 1)
      if (line === '') {
        flush()
      } else if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        currentData += (currentData ? '\n' : '') + line.slice(5).trim()
      }
      // Ignore comments (`:` prefix) and other field names
    }
  }
  flush()

  if (streamError) return { ok: false, error: streamError }
  return { ok: true }
}
