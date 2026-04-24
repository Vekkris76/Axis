import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { v4 as uuid } from 'uuid'
import { ChatHeader } from './ChatHeader'
import { MessageList } from './MessageList'
import { Composer } from './Composer'
import type { ChatMessage } from './Message'
import { sendChat } from '../../lib/api'
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
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setThinking(true)

    const result = await sendChat(text, sessionId)
    setThinking(false)

    if (!result.ok) {
      if (result.error.kind === 'auth') {
        navigate('/login', { replace: true })
        return
      }
      const errText = result.error.kind === 'rate'
        ? `${t('app.error.send')} (rate limit)`
        : result.error.kind === 'network'
          ? t('app.error.send')
          : result.error.kind === 'bad_request'
            ? `${t('app.error.send')} (${result.error.detail})`
            : `${t('app.error.reply')} (${result.error.detail || 'server error'})`
      const errMsg: ChatMessage = {
        id: uuid(),
        role: 'system',
        text: errText,
        timestamp: new Date(),
        status: 'error',
      }
      setMessages((prev) => [...prev, errMsg])
      return
    }

    // Update sessionId in case backend assigned a new canonical id
    if (result.data.sessionId && result.data.sessionId !== sessionId) {
      // Keep local id; don't rotate (backend can differ from client's view). Just log.
    }

    const axisMsg: ChatMessage = {
      id: uuid(),
      role: 'axis',
      text: result.data.reply || '(Sense resposta)',
      timestamp: new Date(),
      status: 'ok',
    }
    setMessages((prev) => [...prev, axisMsg])
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
