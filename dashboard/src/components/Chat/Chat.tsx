import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { v4 as uuid } from 'uuid'
import { ChatHeader } from './ChatHeader'
import { MessageList } from './MessageList'
import { Composer } from './Composer'
import type { ChatMessage } from './Message'
import { streamChat } from '../../lib/api'
import { getSessionId, newSessionId } from '../../lib/session'
import { useAuth } from '../../hooks/useAuth'
import { t } from '../../lib/i18n'

export function Chat() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [sessionId, setSessionId] = useState<string>(() => getSessionId())
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)

  // Load cached transcript for this session
  useEffect(() => {
    try {
      const cached = localStorage.getItem(`axis.transcript.${sessionId}`)
      if (cached) {
        const parsed = JSON.parse(cached) as ChatMessage[]
        const hydrated = parsed.map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }))
        setMessages(hydrated)
      } else {
        setMessages([])
      }
    } catch {
      setMessages([])
    }
  }, [sessionId])

  // Persist transcript on change
  useEffect(() => {
    try {
      localStorage.setItem(`axis.transcript.${sessionId}`, JSON.stringify(messages))
    } catch {
      // ignore
    }
  }, [messages, sessionId])

  const onNewSession = () => {
    const fresh = newSessionId()
    setSessionId(fresh)
    setMessages([])
    setInput('')
  }

  const onLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const onSend = async () => {
    const text = input.trim()
    if (!text || thinking) return
    const userMsg: ChatMessage = {
      id: uuid(),
      role: 'user',
      text,
      timestamp: new Date(),
      status: 'ok',
    }
    const axisMsgId = uuid()
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setThinking(true)

    // Pre-create an empty Axis message that we'll grow as deltas arrive.
    setMessages((prev) => [
      ...prev,
      {
        id: axisMsgId,
        role: 'axis',
        text: '',
        timestamp: new Date(),
        status: 'ok',
      },
    ])

    const appendDelta = (delta: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === axisMsgId ? { ...m, text: m.text + delta } : m)),
      )
    }

    const result = await streamChat(text, sessionId, {
      onThinking: () => {
        // The user's "thinking" indicator is already on; nothing else to do.
      },
      onDelta: (delta) => {
        appendDelta(delta)
      },
      onDone: () => {
        // The final `done` event also carries the full reply, but by the
        // time it arrives the axis message has already been built from
        // deltas — no extra work needed beyond clearing the thinking flag.
      },
    })

    setThinking(false)

    if (!result.ok) {
      if (result.error.kind === 'auth') {
        navigate('/login', { replace: true })
        return
      }
      const errText =
        result.error.kind === 'rate'
          ? `${t('app.error.send')} (rate limit)`
          : result.error.kind === 'network'
            ? t('app.error.send')
            : result.error.kind === 'bad_request'
              ? `${t('app.error.send')} (${result.error.detail})`
              : `${t('app.error.reply')} (${result.error.detail || 'server error'})`
      // Replace the placeholder axis message with an error system message.
      setMessages((prev) =>
        prev
          .filter((m) => m.id !== axisMsgId)
          .concat({
            id: uuid(),
            role: 'system',
            text: errText,
            timestamp: new Date(),
            status: 'error',
          }),
      )
      return
    }

    // If Axis ended up with an empty reply (rare), replace placeholder text.
    setMessages((prev) =>
      prev.map((m) =>
        m.id === axisMsgId && m.text === '' ? { ...m, text: '(Sense resposta)' } : m,
      ),
    )
  }

  return (
    <div className="flex h-full min-h-screen w-full flex-col">
      <ChatHeader
        sessionId={sessionId}
        onNewSession={onNewSession}
        onLogout={onLogout}
      />
      <MessageList messages={messages} thinking={thinking} />
      <Composer
        value={input}
        onChange={setInput}
        onSend={onSend}
        disabled={thinking}
      />
    </div>
  )
}
