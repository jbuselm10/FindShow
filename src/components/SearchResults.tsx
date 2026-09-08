import type { SearchResult } from '../types'

type SearchResultsProps = {
  results: SearchResult[]
  selectedId: number | null
  onSelect: (id: number) => void
}

export function SearchResults({ results, selectedId, onSelect }: SearchResultsProps) {
  if (results.length === 0) return null

  return (
    <section className="panel results-panel" aria-label="Search results">
      <h2 className="panel-title">Matches</h2>
      <ul className="result-list">
        {results.map((show) => (
          <li key={show.id}>
            <button
              type="button"
              className={`result-item${selectedId === show.id ? ' is-selected' : ''}`}
              onClick={() => onSelect(show.id)}
            >
              {show.posterUrl ? (
                <img className="result-poster" src={show.posterUrl} alt="" loading="lazy" />
              ) : (
                <div className="result-poster result-poster--empty" aria-hidden="true" />
              )}
              <span className="result-meta">
                <span className="result-name">{show.name}</span>
                {show.year ? <span className="result-year">{show.year}</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
