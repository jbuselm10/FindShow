import type { MediaType, SearchResult } from '../types'

type SearchResultsProps = {
  results: SearchResult[]
  selectedId: number | null
  selectedMediaType: MediaType | null
  onSelect: (id: number, mediaType: MediaType) => void
}

export function SearchResults({
  results,
  selectedId,
  selectedMediaType,
  onSelect,
}: SearchResultsProps) {
  if (results.length === 0) return null

  return (
    <section className="panel results-panel" aria-label="Search results">
      <h2 className="panel-title">Matches</h2>
      <ul className="result-list">
        {results.map((show) => (
          <li key={`${show.mediaType}-${show.id}`}>
            <button
              type="button"
              className={`result-item${
                selectedId === show.id && selectedMediaType === show.mediaType ? ' is-selected' : ''
              }`}
              onClick={() => onSelect(show.id, show.mediaType)}
            >
              {show.posterUrl ? (
                <img className="result-poster" src={show.posterUrl} alt="" loading="lazy" />
              ) : (
                <div className="result-poster result-poster--empty" aria-hidden="true" />
              )}
              <span className="result-meta">
                <span className="result-name">{show.name}</span>
                <span className="result-kind">
                  {show.mediaType === 'movie' ? 'Movie' : 'TV'}
                  {show.year ? ` · ${show.year}` : ''}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
