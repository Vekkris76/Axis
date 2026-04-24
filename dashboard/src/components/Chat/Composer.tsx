import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { t } from '../../lib/i18n'

type Props = {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  disabled: boolean
}

export function Composer({ value, onChange, onSend, disabled }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const autosize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
    autosize()
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && value.trim()) {
        onSend()
      }
    }
  }

  return (
    <div className="border-t border-hangar-border/40 px-4 py-4">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder={t('app.composer.placeholder')}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-hangar-border bg-black/30 px-4 py-3 font-sans text-sm text-hangar-text outline-none placeholder:text-hangar-muted/60 focus:border-hangar-accent/60"
        />
        <button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-hangar-accent/80 text-slate-950 transition hover:bg-hangar-accent disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="send"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  )
}
