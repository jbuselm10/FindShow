import type { HistoryItem } from '../types'

type PreviouslyViewedProps = {
  items: HistoryItem[]
  activeId: number | null
  onSelect: (id: number) => void
  onRemove: (id: number) => void
}

export function PreviouslyViewed({ items, activeId, onSelect, onRemove }: PreviouslyViewedProps) {
  return (
    <aside className="panel history-panel" aria-label="Previously viewed shows">
      <h2 className="panel-title">Previously viewed</h2>
      {items.length === 0 ? (
        <p className="status-line">Shows you open will show up here.</p>
      ) : (
        <ul className="history-list">
          {items.map((item) => (
            <li key={item.id} className="history-row">
              <button
                type="button"
                className={`history-item${activeId === item.id ? ' is-selected' : ''}`}
                onClick={() => onSelect(item.id)}
              >
                {item.posterUrl ? (
                  <img className="history-poster" src={item.posterUrl} alt="" loading="lazy" />
                ) : (
                  <div className="history-poster history-poster--empty" aria-hidden="true" />
                )}
                <span className="history-meta">
                  <span className="history-name">{item.name}</span>
                  {item.year ? <span className="history-year">{item.year}</span> : null}
                  {item.streamingProviders.length > 0 ? (
                    <span className="history-providers" aria-label="Available on">
                      {item.streamingProviders.map((provider) => (
                        <span key={provider.id} className="history-provider" title={provider.name}>
                          {provider.logoUrl ? (
                            <img src={provider.logoUrl} alt="" className="history-provider-logo" />
                          ) : null}
                          <span className="history-provider-name">{provider.name}</span>
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="history-providers-empty">No current stream</span>
                  )}
                </span>
              </button>
              <button
                type="button"
                className="history-remove"
                aria-label={`Remove ${item.name} from previously viewed`}
                onClick={() => onRemove(item.id)}
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
