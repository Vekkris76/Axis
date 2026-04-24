import { useEffect, useRef } from 'react'
import { Message } from './Message'
import type { ChatMessage } from './Message'
import { t } from '../../lib/i18n'

type Props = {
  messages: ChatMessage[]
  thinking: boolean
}

export function MessageList({ messages, thinking }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, thinking])

  if (messages.length === 0 && !thinking) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <h2 className="font-sans text-xl font-light text-hangar-text">
          {t('app.empty.title')}
        </h2>
        <p className="max-w-sm font-sans text-sm text-hangar-muted">
          {t('app.empty.body')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        {messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}
        {thinking && <ThinkingBubble />}
        <div ref={endRef} />
      </div>
    </div>
  )
}

function ThinkingBubble() {
  return (
    <div className="flex w-full justify-start">
      <div className="frosted flex items-center gap-2 rounded-2xl px-4 py-3">
        <span className="h-2 w-2 animate-pulse rounded-full bg-hangar-accent" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-hangar-accent [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-hangar-accent [animation-delay:300ms]" />
        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.2em] text-hangar-muted">
          {t('app.thinking')}
        </span>
      </div>
    </div>
  )
}
