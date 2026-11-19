import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { sendChatMessage } from '../api/client'
import type { ChatMessage } from '../types'

const WELCOME =
  'Ask about how FindShow works — searching titles, streaming categories, history, and more.'

export function SiteChat() {
  const panelId = useId()
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, loading, open])

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (!open || !panelRef.current) return

    const panel = panelRef.current
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
    )
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Tab') return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    panel.addEventListener('keydown', onKeyDown)
    return () => panel.removeEventListener('keydown', onKeyDown)
  }, [open, messages, loading])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const content = input.trim()
    if (!content || loading) return

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(nextMessages)
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const data = await sendChatMessage(nextMessages)
      setMessages([...nextMessages, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chat failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="site-chat">
      {open ? (
        <div
          ref={panelRef}
          className="site-chat-panel panel"
          id={panelId}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="site-chat-header">
            <h2 className="site-chat-title" id={titleId}>
              Site help
            </h2>
            <button
              type="button"
              className="site-chat-close"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              Close
            </button>
          </div>

          <div className="site-chat-messages" ref={listRef} aria-live="polite">
            {messages.length === 0 ? <p className="site-chat-welcome">{WELCOME}</p> : null}
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`site-chat-bubble site-chat-bubble--${message.role}`}
              >
                {message.content}
              </div>
            ))}
            {loading ? <p className="site-chat-status">Thinking…</p> : null}
            {error ? (
              <p className="site-chat-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <form className="site-chat-form" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="site-chat-input">
              Ask a question about FindShow
            </label>
            <input
              ref={inputRef}
              id="site-chat-input"
              className="site-chat-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about FindShow…"
              disabled={loading}
              autoComplete="off"
            />
            <button
              className="site-chat-send"
              type="submit"
              disabled={loading || !input.trim()}
            >
              Send
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        className="site-chat-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        {open ? 'Hide chat' : 'Ask about this site'}
      </button>
    </div>
  )
}
