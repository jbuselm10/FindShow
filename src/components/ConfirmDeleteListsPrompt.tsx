import { useEffect, useId } from 'react'

type ConfirmDeleteListsPromptProps = {
  open: boolean
  email: string
  loading?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDeleteListsPrompt({
  open,
  email,
  loading = false,
  error = null,
  onCancel,
  onConfirm,
}: ConfirmDeleteListsPromptProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !loading) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, loading, onCancel])

  if (!open) return null

  return (
    <div className="email-prompt-backdrop" role="presentation" onClick={loading ? undefined : onCancel}>
      <div
        className="panel email-prompt"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="panel-title">
          Remove email and lists?
        </h2>
        <p className="landing-copy">
          This permanently deletes <strong>{email}</strong> and every Currently Watching and Movies
          and Shows to watch title saved under it. This cannot be undone.
        </p>
        {error ? (
          <p className="error-banner" role="alert">
            {error}
          </p>
        ) : null}
        <div className="email-prompt-actions">
          <button type="button" className="landing-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="landing-danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Removing…' : 'Remove everything'}
          </button>
        </div>
      </div>
    </div>
  )
}
