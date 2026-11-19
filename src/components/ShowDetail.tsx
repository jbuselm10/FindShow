import { useMemo, useState } from 'react'
import type { ListVisibility, Provider, ProviderGroups, ShowDetail } from '../types'

const GROUP_LABELS: { key: keyof ProviderGroups; label: string }[] = [
  { key: 'flatrate', label: 'Stream with subscription' },
  { key: 'ads', label: 'Free with ads' },
  { key: 'free', label: 'Free' },
  { key: 'rent', label: 'Rent' },
  { key: 'buy', label: 'Buy' },
]

function ProviderRow({ providers }: { providers: Provider[] }) {
  return (
    <ul className="provider-list">
      {providers.map((provider) => (
        <li key={provider.id} className="provider-chip">
          {provider.logoUrl ? (
            <img className="provider-logo" src={provider.logoUrl} alt="" loading="lazy" />
          ) : null}
          <span>{provider.name}</span>
        </li>
      ))}
    </ul>
  )
}

function uniqueProviders(groups: ProviderGroups, keys: (keyof ProviderGroups)[]): Provider[] {
  const seen = new Set<number>()
  const out: Provider[] = []
  for (const key of keys) {
    for (const provider of groups[key]) {
      if (seen.has(provider.id)) continue
      seen.add(provider.id)
      out.push(provider)
    }
  }
  return out.sort((a, b) => a.displayPriority - b.displayPriority)
}

type ShowDetailViewProps = {
  show: ShowDetail
  loading: boolean
  onBack?: () => void
  backLabel?: string
  isOnWatching?: boolean
  isOnToWatch?: boolean
  listBusy?: boolean
  onAddWatching: (providers: Provider[], visibility: ListVisibility) => void
  onRemoveWatching: () => void
  onAddToWatch: (visibility: ListVisibility) => void
  onRemoveToWatch: () => void
}

export function ShowDetailView({
  show,
  loading,
  onBack,
  backLabel = 'Back',
  isOnWatching = false,
  isOnToWatch = false,
  listBusy = false,
  onAddWatching,
  onRemoveWatching,
  onAddToWatch,
  onRemoveToWatch,
}: ShowDetailViewProps) {
  const streamingKeys = useMemo(
    () => ['flatrate', 'ads', 'free'] as (keyof ProviderGroups)[],
    [],
  )
  const hasStreamingNow = streamingKeys.some((key) => show.providers[key].length > 0)
  const pickableProviders = useMemo(
    () => uniqueProviders(show.providers, streamingKeys),
    [show.providers, streamingKeys],
  )
  const [picking, setPicking] = useState<'watching' | 'toWatch' | null>(null)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [visibility, setVisibility] = useState<ListVisibility>('private')
  const [pickError, setPickError] = useState<string | null>(null)

  function startAddWatching() {
    setPicking('watching')
    setVisibility('private')
    setSelectedIds(pickableProviders.slice(0, 1).map((p) => p.id))
    setPickError(null)
  }

  function startAddToWatch() {
    setPicking('toWatch')
    setVisibility('private')
    setPickError(null)
  }

  function toggleProvider(id: number) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  function confirmWatching() {
    const providers = pickableProviders.filter((provider) => selectedIds.includes(provider.id))
    if (providers.length === 0) {
      setPickError('Select at least one streaming service.')
      return
    }
    setPickError(null)
    setPicking(null)
    onAddWatching(providers, visibility)
  }

  function confirmToWatch() {
    setPicking(null)
    onAddToWatch(visibility)
  }

  return (
    <section className="panel detail-panel" aria-busy={loading}>
      {onBack ? (
        <button type="button" className="back-button" onClick={onBack}>
          <span className="back-button-icon" aria-hidden="true">
            ←
          </span>
          {backLabel}
        </button>
      ) : null}

      <div className="detail-header">
        {show.posterUrl ? (
          <img className="detail-poster" src={show.posterUrl} alt="" />
        ) : (
          <div className="detail-poster detail-poster--empty" aria-hidden="true" />
        )}
        <div className="detail-copy">
          <h2 className="detail-title">{show.name}</h2>
          {show.year ? <p className="detail-year">{show.year}</p> : null}
        </div>
      </div>

      <div className="list-actions">
        {show.mediaType === 'tv' ? (
          isOnWatching ? (
            <button
              type="button"
              className="landing-secondary"
              disabled={listBusy}
              onClick={onRemoveWatching}
            >
              Remove from Currently Watching
            </button>
          ) : (
            <button
              type="button"
              className="landing-primary"
              disabled={listBusy || loading}
              onClick={startAddWatching}
            >
              Add to Currently Watching
            </button>
          )
        ) : null}

        {isOnToWatch ? (
          <button
            type="button"
            className="landing-secondary"
            disabled={listBusy}
            onClick={onRemoveToWatch}
          >
            Remove from Movies and Shows to watch
          </button>
        ) : (
          <button
            type="button"
            className="landing-primary"
            disabled={listBusy || loading}
            onClick={startAddToWatch}
          >
            Add to Movies and Shows to watch
          </button>
        )}
      </div>

      {picking ? (
        <div className="provider-picker">
          {picking === 'watching' ? (
            <>
              <h3 className="providers-heading">Which services are you watching on?</h3>
              {pickableProviders.length === 0 ? (
                <p className="status-line">
                  No US streaming services listed. You can still cancel, or check rent/buy below.
                </p>
              ) : (
                <ul className="provider-pick-list">
                  {pickableProviders.map((provider) => {
                    const checked = selectedIds.includes(provider.id)
                    return (
                      <li key={provider.id}>
                        <label className={`provider-pick${checked ? ' is-selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleProvider(provider.id)}
                          />
                          {provider.logoUrl ? (
                            <img className="provider-logo" src={provider.logoUrl} alt="" />
                          ) : null}
                          <span>{provider.name}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          ) : (
            <h3 className="providers-heading">Save to Movies and Shows to watch</h3>
          )}

          <fieldset className="visibility-fieldset">
            <legend className="visibility-legend">Visibility</legend>
            <label className={`visibility-option${visibility === 'private' ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="list-visibility"
                checked={visibility === 'private'}
                onChange={() => setVisibility('private')}
              />
              <span>
                <strong>Private</strong> (default) — only you see this when signed in with your email
              </span>
            </label>
            <label className={`visibility-option${visibility === 'public' ? ' is-selected' : ''}`}>
              <input
                type="radio"
                name="list-visibility"
                checked={visibility === 'public'}
                onChange={() => setVisibility('public')}
              />
              <span>
                <strong>Public</strong> — others can find this by searching your email or first name
              </span>
            </label>
          </fieldset>

          {pickError ? (
            <p className="error-banner" role="alert">
              {pickError}
            </p>
          ) : null}
          <div className="email-prompt-actions">
            <button type="button" className="landing-secondary" onClick={() => setPicking(null)}>
              Cancel
            </button>
            {picking === 'watching' ? (
              <button
                type="button"
                className="landing-primary"
                disabled={listBusy || pickableProviders.length === 0}
                onClick={confirmWatching}
              >
                Save to watching
              </button>
            ) : (
              <button
                type="button"
                className="landing-primary"
                disabled={listBusy}
                onClick={confirmToWatch}
              >
                Save to list
              </button>
            )}
          </div>
        </div>
      ) : null}

      <div className="providers-block">
        <h3 className="providers-heading">Currently available on (US)</h3>
        {loading ? <p className="status-line">Loading streaming services…</p> : null}
        {!loading && !hasStreamingNow ? (
          <p className="status-line">Not currently available to stream in the US.</p>
        ) : null}
        {!loading &&
          streamingKeys.map((key) => {
            const providers = show.providers[key]
            if (providers.length === 0) return null
            const label = GROUP_LABELS.find((group) => group.key === key)?.label ?? key
            return (
              <div key={key} className="provider-group">
                <h4 className="provider-group-title">{label}</h4>
                <ProviderRow providers={providers} />
              </div>
            )
          })}

        {!loading &&
          (['rent', 'buy'] as const).map((key) => {
            const providers = show.providers[key]
            if (providers.length === 0) return null
            const label = GROUP_LABELS.find((group) => group.key === key)?.label ?? key
            return (
              <div key={key} className="provider-group provider-group--secondary">
                <h4 className="provider-group-title">{label}</h4>
                <ProviderRow providers={providers} />
              </div>
            )
          })}

        <p className="attribution">
          Streaming data from{' '}
          <a href="https://www.justwatch.com" target="_blank" rel="noreferrer">
            JustWatch
          </a>
          {show.tmdbUrl ? (
            <>
              {' '}
              ·{' '}
              <a href={show.tmdbUrl} target="_blank" rel="noreferrer">
                View on TMDB
              </a>
            </>
          ) : null}
        </p>
      </div>

      {show.overview ? <p className="detail-overview">{show.overview}</p> : null}
    </section>
  )
}
