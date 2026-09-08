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
