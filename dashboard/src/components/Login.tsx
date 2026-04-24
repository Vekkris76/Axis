import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { login } from '../lib/auth'
import { useAuth } from '../hooks/useAuth'
import { t } from '../lib/i18n'
import { AxisMark } from './AxisMark'

export function Login() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting || !password) return
    setSubmitting(true)
    setError(null)
    const result = await login(password)
    if (!result.ok) {
      if (result.error === 'invalid') setError(t('login.error.invalid'))
      else setError(t('login.error.network'))
      setSubmitting(false)
      return
    }
    await refresh()
    navigate('/app', { replace: true })
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center px-6">
      <form
        onSubmit={onSubmit}
        className="frosted flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl p-8"
      >
        <AxisMark className="h-16 w-16 text-hangar-accent drop-shadow-[0_0_8px_oklch(0.85_0.12_200_/_0.5)]" />
        <div className="flex flex-col items-center gap-1">
          <h1 className="font-sans text-2xl font-light tracking-wide text-hangar-text">
            {t('login.title')}
          </h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-hangar-muted">
            {t('login.subtitle')}
          </p>
        </div>

        <label className="flex w-full flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-hangar-muted">
            {t('login.password')}
          </span>
          <input
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            className="rounded-lg border border-hangar-border bg-black/30 px-4 py-3 font-mono text-sm text-hangar-text outline-none focus:border-hangar-accent/60 focus:ring-0 disabled:opacity-60"
          />
        </label>

        {error && (
          <p className="w-full text-center text-sm text-red-300">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting || !password}
          className="w-full rounded-lg bg-hangar-accent/80 px-4 py-3 font-sans text-sm font-medium text-slate-950 transition hover:bg-hangar-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? '…' : t('login.submit')}
        </button>
      </form>
    </div>
  )
}
