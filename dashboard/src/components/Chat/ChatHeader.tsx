import { Link } from 'react-router'
import { ArrowLeft, LogOut, Plus } from 'lucide-react'
import { AxisMark } from '../AxisMark'
import { t } from '../../lib/i18n'

type Props = {
  sessionId: string
  onNewSession: () => void
  onLogout: () => void
}

export function ChatHeader({ sessionId, onNewSession, onLogout }: Props) {
  const shortId = sessionId.length > 12 ? sessionId.slice(-6) : sessionId

  return (
    <header className="flex items-center justify-between border-b border-hangar-border/40 px-6 py-4">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          title={t('header.back')}
          className="flex h-8 w-8 items-center justify-center rounded-md text-hangar-muted transition hover:text-hangar-text"
        >
          <ArrowLeft size={18} />
        </Link>
        <AxisMark className="h-8 w-8 text-hangar-accent drop-shadow-[0_0_6px_oklch(0.85_0.12_200_/_0.45)]" />
        <div className="flex flex-col">
          <span className="font-sans text-sm font-medium text-hangar-text">
            Axis
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-hangar-muted">
            {t('app.tagline')}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-hangar-muted"
          title={sessionId}
        >
          {t('app.session_label')} · {shortId}
        </span>
        <button
          onClick={onNewSession}
          title={t('app.new_session')}
          className="flex h-8 items-center gap-1 rounded-md px-2 text-hangar-muted transition hover:text-hangar-text"
        >
          <Plus size={16} />
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] sm:inline">
            {t('app.new_session')}
          </span>
        </button>
        <button
          onClick={onLogout}
          title={t('app.logout')}
          className="flex h-8 items-center gap-1 rounded-md px-2 text-hangar-muted transition hover:text-hangar-text"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
