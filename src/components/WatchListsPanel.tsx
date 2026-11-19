import type { MediaType, ToWatchItem, WatchingItem } from '../types'

type WatchListsPanelProps = {
  email: string | null
  watching: WatchingItem[]
  toWatch: ToWatchItem[]
  activeId: number | null
  activeMediaType: MediaType | null
  onSelect: (id: number, mediaType: MediaType) => void
  onRemoveWatching: (id: number) => void
  onRemoveToWatch: (id: number, mediaType: MediaType) => void
  onPromptEmail: () => void
}

export function WatchListsPanel({
  email,
  watching,
  toWatch,
  activeId,
  activeMediaType,
  onSelect,
  onRemoveWatching,
  onRemoveToWatch,
  onPromptEmail,
}: WatchListsPanelProps) {
  if (!email) {
    return (
      <aside className="panel history-panel" aria-label="Save lists">
        <h2 className="panel-title">Your lists</h2>
        <p className="status-line">
          Enter an email to save shows you&apos;re watching and Movies and Shows to watch.
        </p>
        <button type="button" className="landing-secondary" onClick={onPromptEmail}>
          Enter email to save lists
        </button>
      </aside>
    )
  }

  return (
    <aside className="panel history-panel" aria-label="Your lists">
      <h2 className="panel-title">Your lists</h2>
      <p className="status-line history-email">{email}</p>

      <h3 className="provider-group-title">Currently Watching</h3>
      {watching.length === 0 ? (
        <p className="status-line">No shows yet.</p>
      ) : (
        <ul className="history-list">
          {watching.map((item) => (
            <li key={`tv-${item.id}`} className="history-row">
              <button
                type="button"
                className={`history-item${
                  activeId === item.id && activeMediaType === 'tv' ? ' is-selected' : ''
                }`}
                onClick={() => onSelect(item.id, 'tv')}
              >
                {item.posterUrl ? (
                  <img className="history-poster" src={item.posterUrl} alt="" loading="lazy" />
                ) : (
                  <div className="history-poster history-poster--empty" aria-hidden="true" />
                )}
                <span className="history-meta">
                  <span className="history-name">{item.name}</span>
                  {item.selectedProviders.length > 0 ? (
                    <span className="history-providers">
                      {item.selectedProviders.map((provider) => (
                        <span key={provider.id} className="history-provider" title={provider.name}>
                          {provider.logoUrl ? (
                            <img src={provider.logoUrl} alt="" className="history-provider-logo" />
                          ) : null}
                          <span className="history-provider-name">{provider.name}</span>
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
              </button>
              <button
                type="button"
                className="history-remove"
                aria-label={`Remove ${item.name}`}
                onClick={() => onRemoveWatching(item.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="provider-group-title">Movies and Shows to watch</h3>
      {toWatch.length === 0 ? (
        <p className="status-line">Nothing saved yet.</p>
      ) : (
        <ul className="history-list">
          {toWatch.map((item) => (
            <li key={`${item.mediaType}-${item.id}`} className="history-row">
              <button
                type="button"
                className={`history-item${
                  activeId === item.id && activeMediaType === item.mediaType ? ' is-selected' : ''
                }`}
                onClick={() => onSelect(item.id, item.mediaType)}
              >
                {item.posterUrl ? (
                  <img className="history-poster" src={item.posterUrl} alt="" loading="lazy" />
                ) : (
                  <div className="history-poster history-poster--empty" aria-hidden="true" />
                )}
                <span className="history-meta">
                  <span className="history-name">{item.name}</span>
                  <span className="history-year">
                    {[item.mediaType === 'tv' ? 'Show' : 'Movie', item.year].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="history-remove"
                aria-label={`Remove ${item.name}`}
                onClick={() => onRemoveToWatch(item.id, item.mediaType)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
