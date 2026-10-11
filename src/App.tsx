import { useEffect, useState } from 'react'
import { getTitleProviders, searchShows } from './api/client'
import { SearchForm } from './components/SearchForm'
import { SearchResults } from './components/SearchResults'
import { ShowDetailView } from './components/ShowDetail'
import { PreviouslyViewed } from './components/PreviouslyViewed'
import { addToHistory, loadHistory, removeFromHistory } from './history'
import type { HistoryItem, MediaType, SearchResult, ShowDetail } from './types'

export default function App() {
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory())
  const [searchLoading, setSearchLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState<{ id: number; mediaType: MediaType } | null>(null)
  const [show, setShow] = useState<ShowDetail | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  async function handleSearch(query: string) {
    setSearchLoading(true)
    setError(null)
    setHasSearched(true)
    setShow(null)
    setSelected(null)

    try {
      const nextResults = await searchShows(query)
      setResults(nextResults)
      if (nextResults.length === 1) {
        await openTitle(nextResults[0].id, nextResults[0].mediaType)
      }
    } catch (err) {
      setResults([])
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearchLoading(false)
    }
  }

  async function openTitle(id: number, mediaType: MediaType) {
    setSelected({ id, mediaType })
    setResults([])
    setHasSearched(false)
    setDetailLoading(true)
    setError(null)

    try {
      const detail = await getTitleProviders(id, mediaType)
      setShow(detail)
      setHistory(addToHistory(detail))
    } catch (err) {
      setShow(null)
      setError(err instanceof Error ? err.message : 'Could not load streaming info')
    } finally {
      setDetailLoading(false)
    }
  }

  function handleRemoveHistory(id: number, mediaType: MediaType) {
    setHistory(removeFromHistory(id, mediaType))
    if (selected?.id === id && selected.mediaType === mediaType) {
      setSelected(null)
      setShow(null)
    }
  }

  return (
    <div className="app-shell">
      <div className="atmosphere" aria-hidden="true" />
      <header className="hero">
        <p className="brand">FindShow</p>
        <p className="tagline">Type a show or movie. See where it streams.</p>
        <SearchForm loading={searchLoading} onSearch={handleSearch} />
      </header>

      {error ? (
        <p className="error-banner" role="alert">
          {error}
        </p>
      ) : null}

      <main className="layout">
        <div className="main-column">
          {hasSearched && !searchLoading && results.length === 0 && !error && !show ? (
            <p className="status-line empty-state">
              No shows or movies matched that name. Try another title.
            </p>
          ) : null}

          {!show && !detailLoading ? (
            <SearchResults
              results={results}
              selectedId={selected?.id ?? null}
              selectedMediaType={selected?.mediaType ?? null}
              onSelect={openTitle}
            />
          ) : null}

          {show ? <ShowDetailView show={show} loading={detailLoading} /> : null}

          {!show && detailLoading ? <p className="status-line">Loading show…</p> : null}

          {!hasSearched && !show && !detailLoading ? (
            <p className="status-line empty-state">
              Search for a show or movie to see Netflix, Hulu, Disney+, Max, Prime Video, and more.
            </p>
          ) : null}
        </div>

        <PreviouslyViewed
          items={history}
          activeId={selected?.id ?? null}
          activeMediaType={selected?.mediaType ?? null}
          onSelect={openTitle}
          onRemove={handleRemoveHistory}
        />
      </main>
    </div>
  )
}
