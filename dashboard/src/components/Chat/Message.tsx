import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import clsx from 'clsx'

export type ChatMessage = {
  id: string
  role: 'user' | 'axis' | 'system'
  text: string
  timestamp: Date
  status?: 'sending' | 'error' | 'ok'
}

type Props = { message: ChatMessage }

export function Message({ message }: Props) {
  const { role, text, status } = message
  const isUser = role === 'user'
  const isError = status === 'error'

  return (
    <div
      className={clsx(
        'flex w-full',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      <div
        className={clsx(
          'max-w-[82%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-hangar-accent/15 border border-hangar-accent/25 text-hangar-text'
            : 'frosted text-hangar-text',
          isError && 'border-red-400/30 bg-red-500/10',
        )}
      >
        {role === 'axis' || role === 'system' ? (
          <div className="markdown max-w-none text-sm leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        ) : (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {text}
          </div>
        )}
      </div>
    </div>
  )
}
