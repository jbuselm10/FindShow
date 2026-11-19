import type { ListVisibility, MediaType, ToWatchItem, WatchingItem } from '../types'

type ListPageProps =
  | {
      mode: 'watching'
      email: string
      firstName?: string
      items: WatchingItem[]
      onFindNewShow: () => void
      onChangeEmail: () => void
      onRemoveEmailAndLists: () => void
      onSelect: (id: number, mediaType: MediaType) => void
      onRemove: (id: number, mediaType: MediaType) => void
    }
  | {
      mode: 'toWatch'
      email: string
      firstName?: string
      items: ToWatchItem[]
      onFindNewShow: () => void
      onChangeEmail: () => void
      onRemoveEmailAndLists: () => void
      onSelect: (id: number, mediaType: MediaType) => void
      onRemove: (id: number, mediaType: MediaType) => void
    }

function VisibilityBadge({ visibility }: { visibility: ListVisibility }) {
  return (
    <span
      className={`visibility-badge visibility-badge--${visibility}`}
      title={
        visibility === 'public'
          ? 'Visible when others search your email or first name'
          : 'Only visible when you open lists with your email'
      }
    >
      {visibility === 'public' ? 'Public' : 'Private'}
    </span>
  )
}

export function ListPage(props: ListPageProps) {
  const {
    mode,
    email,
    firstName,
    items,
    onFindNewShow,
    onChangeEmail,
    onRemoveEmailAndLists,
    onSelect,
    onRemove,
  } = props
  const title = mode === 'watching' ? 'Currently Watching' : 'Movies and Shows to watch'
  const empty =
    mode === 'watching'
      ? 'No shows yet. Find a TV show and add it with the services you use.'
      : 'Nothing saved yet. Find a movie or show and add it to this list.'
  const identity = firstName ? `${firstName} · ${email}` : email

  return (
    <section className="my-lists" aria-label={title}>
      <div className="my-lists-header panel">
        <div>
          <h2 className="panel-title">{title}</h2>
          <p className="status-line">
            Signed in as <strong>{identity}</strong>
          </p>
          <p className="status-line status-line--muted">
            New saves default to private. Public items can be found by email or first name on Home.
          </p>
        </div>
        <div className="my-lists-header-actions">
          <button type="button" className="landing-primary" onClick={onFindNewShow}>
            Find new show
          </button>
          <button type="button" className="landing-link" onClick={onChangeEmail}>
            Change email
          </button>
          <button type="button" className="landing-link landing-link--danger" onClick={onRemoveEmailAndLists}>
            Remove email &amp; lists
          </button>
        </div>
      </div>

      <div className="panel">
        {items.length === 0 ? (
          <p className="status-line">{empty}</p>
        ) : mode === 'watching' ? (
          <ul className="history-list">
            {(items as WatchingItem[]).map((item) => (
              <li key={`tv-${item.id}`} className="history-row">
                <button type="button" className="history-item" onClick={() => onSelect(item.id, 'tv')}>
                  {item.posterUrl ? (
                    <img className="history-poster" src={item.posterUrl} alt="" loading="lazy" />
                  ) : (
                    <div className="history-poster history-poster--empty" aria-hidden="true" />
                  )}
                  <span className="history-meta">
                    <span className="history-name-row">
                      <span className="history-name">{item.name}</span>
                      <VisibilityBadge visibility={item.visibility ?? 'private'} />
                    </span>
                    {item.year ? <span className="history-year">{item.year}</span> : null}
                    {item.selectedProviders.length > 0 ? (
                      <span className="history-providers" aria-label="Watching on">
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
                  aria-label={`Remove ${item.name} from currently watching`}
                  onClick={() => onRemove(item.id, 'tv')}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="history-list">
            {(items as ToWatchItem[]).map((item) => (
              <li key={`${item.mediaType}-${item.id}`} className="history-row">
                <button
                  type="button"
                  className="history-item"
                  onClick={() => onSelect(item.id, item.mediaType)}
                >
                  {item.posterUrl ? (
                    <img className="history-poster" src={item.posterUrl} alt="" loading="lazy" />
                  ) : (
                    <div className="history-poster history-poster--empty" aria-hidden="true" />
                  )}
                  <span className="history-meta">
                    <span className="history-name-row">
                      <span className="history-name">{item.name}</span>
                      <VisibilityBadge visibility={item.visibility ?? 'private'} />
                    </span>
                    <span className="history-year">
                      {[item.mediaType === 'tv' ? 'Show' : 'Movie', item.year].filter(Boolean).join(' · ')}
                    </span>
                    {item.selectedProviders?.length > 0 ? (
                      <span className="history-providers" aria-label="Available on">
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
                  aria-label={`Remove ${item.name} from Movies and Shows to watch`}
                  onClick={() => onRemove(item.id, item.mediaType)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
