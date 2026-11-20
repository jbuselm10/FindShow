import { useState, type FormEvent } from 'react'
import { isValidEmail } from '../listsStorage'

type HomeLandingProps = {
  savedEmail: string
  savedFirstName: string
  loading: boolean
  error: string | null
  onSearch: (query: string) => void
  onEnterEmail: (email: string, firstName: string) => void
  onContinueSaved: () => void
  onRemoveEmailAndLists: () => void
  onSearchOtherShows: (query: string) => void
  onSearchAllOtherShows: () => void
}

export function HomeLanding({
  savedEmail,
  savedFirstName,
  loading,
  error,
  onSearch,
  onEnterEmail,
  onContinueSaved,
  onRemoveEmailAndLists,
  onSearchOtherShows,
  onSearchAllOtherShows,
}: HomeLandingProps) {
  const [query, setQuery] = useState('')
  const [email, setEmail] = useState(savedEmail)
  const [firstName, setFirstName] = useState(savedFirstName)
  const [localError, setLocalError] = useState<string | null>(null)
  const [publicQuery, setPublicQuery] = useState('')

  function handleSearch(event: FormEvent) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) {
      setLocalError('Enter a show or movie name.')
      return
    }
    setLocalError(null)
    onSearch(trimmed)
  }

  function handleEmailSubmit(event: FormEvent) {
    event.preventDefault()
    if (!isValidEmail(email)) {
      setLocalError('Enter a valid email address.')
      return
    }
    setLocalError(null)
    onEnterEmail(email.trim().toLowerCase(), firstName.trim())
  }

  function handlePublicSearch(event: FormEvent) {
    event.preventDefault()
    const trimmed = publicQuery.trim()
    if (!trimmed) {
      setLocalError('Enter an email or first name, or use Search all.')
      return
    }
    setLocalError(null)
    onSearchOtherShows(trimmed)
  }

  return (
    <section className="panel landing-panel" aria-labelledby="landing-title">
      <h2 id="landing-title" className="panel-title">
        Get started
      </h2>
      <p className="landing-copy">
        Search for a title, or open your lists with email. Saves are private by default — choose
        Public when adding if you want others to find what you are watching. Optional first name
        makes public lists easier to discover.
      </p>

      <form className="landing-block" onSubmit={handleSearch}>
        <label className="landing-label" htmlFor="landing-search">
          Find a Show or Movie
        </label>
        <div className="landing-row">
          <input
            id="landing-search"
            className="landing-email-input"
            type="search"
            placeholder="Enter a show or movie name…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
          />
          <button className="landing-primary" type="submit">
            Find
          </button>
        </div>
      </form>

      <form className="landing-block" onSubmit={handleEmailSubmit}>
        <label className="landing-label" htmlFor="landing-email">
          Enter email <span className="landing-optional">(optional)</span>
        </label>
        <p className="landing-hint">Only needed if you want to track shows and movies on your lists.</p>
        <input
          id="landing-email"
          className="landing-email-input"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={loading}
          required
        />
        <label className="landing-label" htmlFor="landing-first-name">
          First name <span className="landing-optional">(optional)</span>
        </label>
        <input
          id="landing-first-name"
          className="landing-email-input"
          type="text"
          autoComplete="given-name"
          placeholder="First name"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          disabled={loading}
          maxLength={80}
        />
        <button className="landing-primary" type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'Open my lists'}
        </button>
      </form>

      {savedEmail ? (
        <div className="landing-continue-row">
          <button type="button" className="landing-link" onClick={onContinueSaved} disabled={loading}>
            {loading
              ? 'Loading…'
              : `Continue as ${savedFirstName ? `${savedFirstName} · ` : ''}${savedEmail}`}
          </button>
          <button
            type="button"
            className="landing-link landing-link--danger"
            onClick={onRemoveEmailAndLists}
            disabled={loading}
          >
            Remove email
          </button>
        </div>
      ) : null}

      <form className="landing-block public-browse" onSubmit={handlePublicSearch}>
        <h3 className="landing-subtitle">Search Other Shows</h3>
        <p className="landing-copy landing-copy--tight">
          Enter an email to see that person&apos;s public titles, or search all public lists.
        </p>
        <label className="landing-label" htmlFor="landing-public-search">
          Email or first name
        </label>
        <div className="landing-row">
          <input
            id="landing-public-search"
            className="landing-email-input"
            type="search"
            placeholder="friend@example.com or Alex"
            value={publicQuery}
            onChange={(event) => setPublicQuery(event.target.value)}
            autoComplete="off"
          />
          <button className="landing-primary" type="submit">
            Search
          </button>
        </div>
        <button
          type="button"
          className="landing-secondary landing-search-all"
          onClick={() => {
            setLocalError(null)
            onSearchAllOtherShows()
          }}
        >
          Search all
        </button>
      </form>

      {localError || error ? (
        <p className="error-banner" role="alert">
          {localError ?? error}
        </p>
      ) : null}
    </section>
  )
}
