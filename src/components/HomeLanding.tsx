import { useState, type FormEvent } from 'react'
import { searchPublicLists } from '../api/client'
import { isValidEmail } from '../listsStorage'
import type { MediaType, PublicListProfile } from '../types'

type HomeLandingProps = {
  savedEmail: string
  savedFirstName: string
  loading: boolean
  error: string | null
  onSearch: (query: string) => void
  onEnterEmail: (email: string, firstName: string) => void
  onContinueSaved: () => void
  onRemoveEmailAndLists: () => void
  onOpenTitle: (id: number, mediaType: MediaType) => void
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
  onOpenTitle,
}: HomeLandingProps) {
  const [query, setQuery] = useState('')
  const [email, setEmail] = useState(savedEmail)
  const [firstName, setFirstName] = useState(savedFirstName)
  const [localError, setLocalError] = useState<string | null>(null)
  const [publicQuery, setPublicQuery] = useState('')
  const [publicLoading, setPublicLoading] = useState(false)
  const [publicError, setPublicError] = useState<string | null>(null)
  const [publicResults, setPublicResults] = useState<PublicListProfile[] | null>(null)

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

  async function handlePublicSearch(event: FormEvent) {
    event.preventDefault()
    const trimmed = publicQuery.trim()
    if (!trimmed) {
      setPublicError('Enter an email or first name.')
      setPublicResults(null)
      return
    }
    setPublicError(null)
    setPublicLoading(true)
    try {
      const response = await searchPublicLists(trimmed)
      setPublicResults(response.results)
      if (response.results.length === 0) {
        setPublicError('No public lists matched that email or first name.')
      }
    } catch (err) {
      setPublicResults(null)
      setPublicError(err instanceof Error ? err.message : 'Could not search public lists')
    } finally {
      setPublicLoading(false)
    }
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
          Enter email
        </label>
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

      <form className="landing-block public-browse" onSubmit={(event) => void handlePublicSearch(event)}>
        <h3 className="landing-subtitle">Browse public lists</h3>
        <p className="landing-copy landing-copy--tight">
          Search by someone&apos;s email or first name to see titles they marked public.
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
            disabled={publicLoading}
            autoComplete="off"
          />
          <button className="landing-primary" type="submit" disabled={publicLoading}>
            {publicLoading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      {publicResults && publicResults.length > 0 ? (
        <div className="public-results" aria-live="polite">
          {publicResults.map((profile) => {
            const label = profile.firstName
              ? `${profile.firstName} · ${profile.email}`
              : profile.email
            return (
              <article key={profile.email} className="public-profile">
                <h4 className="public-profile-name">{label}</h4>
                {profile.watching.length > 0 ? (
                  <div className="public-section">
                    <p className="public-section-label">Currently Watching</p>
                    <ul className="public-title-list">
                      {profile.watching.map((item) => (
                        <li key={`watching-${item.id}`}>
                          <button
                            type="button"
                            className="public-title-btn"
                            onClick={() => onOpenTitle(item.id, 'tv')}
                          >
                            {item.name}
                            {item.year ? ` (${item.year})` : ''}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {profile.toWatch.length > 0 ? (
                  <div className="public-section">
                    <p className="public-section-label">Movies and Shows to watch</p>
                    <ul className="public-title-list">
                      {profile.toWatch.map((item) => (
                        <li key={`towatch-${item.mediaType}-${item.id}`}>
                          <button
                            type="button"
                            className="public-title-btn"
                            onClick={() => onOpenTitle(item.id, item.mediaType)}
                          >
                            {item.name}
                            {item.year ? ` (${item.year})` : ''}
                            {item.selectedProviders?.length
                              ? ` · ${item.selectedProviders.map((provider) => provider.name).join(', ')}`
                              : ''}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      ) : null}

      {localError || error || publicError ? (
        <p className="error-banner" role="alert">
          {localError ?? error ?? publicError}
        </p>
      ) : null}
    </section>
  )
}
