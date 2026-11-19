import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { isValidEmail } from '../listsStorage'

type EmailSavePromptProps = {
  open: boolean
  loading?: boolean
  error?: string | null
  initialEmail?: string
  initialFirstName?: string
  onCancel: () => void
  onSubmit: (email: string, firstName: string) => void
}

export function EmailSavePrompt({
  open,
  loading = false,
  error = null,
  initialEmail = '',
  initialFirstName = '',
  onCancel,
  onSubmit,
}: EmailSavePromptProps) {
  const titleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState(initialEmail)
  const [firstName, setFirstName] = useState(initialFirstName)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setEmail(initialEmail)
    setFirstName(initialFirstName)
    setLocalError(null)
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open, initialEmail, initialFirstName])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open) return null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isValidEmail(email)) {
      setLocalError('Enter a valid email address.')
      return
    }
    setLocalError(null)
    onSubmit(email.trim().toLowerCase(), firstName.trim())
  }

  return (
    <div className="email-prompt-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="email-prompt panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="panel-title">
          Save to your list
        </h2>
        <p className="landing-copy">
          Enter your email to save this. First name is optional and helps others find titles you
          mark Public.
        </p>
        <form className="landing-email-form" onSubmit={handleSubmit}>
          <label className="landing-label" htmlFor="email-save-input">
            Email
          </label>
          <input
            ref={inputRef}
            id="email-save-input"
            className="landing-email-input"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
            required
          />
          <label className="landing-label" htmlFor="email-save-first-name">
            First name <span className="landing-optional">(optional)</span>
          </label>
          <input
            id="email-save-first-name"
            className="landing-email-input"
            type="text"
            autoComplete="given-name"
            placeholder="First name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            disabled={loading}
            maxLength={80}
          />
          <div className="email-prompt-actions">
            <button type="button" className="landing-secondary" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="landing-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save and continue'}
            </button>
          </div>
        </form>
        {localError || error ? (
          <p className="error-banner" role="alert">
            {localError ?? error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
