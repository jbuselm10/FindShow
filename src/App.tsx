import { useEffect, useState } from 'react'
import { getShowProviders, searchShows } from './api/client'
import { SearchForm } from './components/SearchForm'
import { SearchResults } from './components/SearchResults'
import { ShowDetailView } from './components/ShowDetail'
import { PreviouslyViewed } from './components/PreviouslyViewed'
import { addToHistory, loadHistory, removeFromHistory } from './history'
import type { HistoryItem, SearchResult, ShowDetail } from './types'

export default function App() {
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory())
  const [searchLoading, setSearchLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
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
    setSelectedId(null)

    try {
      const nextResults = await searchShows(query)
      setResults(nextResults)
      if (nextResults.length === 1) {
        await openShow(nextResults[0].id)
      }
    } catch (err) {
      setResults([])
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearchLoading(false)
    }
  }

  async function openShow(id: number) {
    setSelectedId(id)
    setDetailLoading(true)
    setError(null)

    try {
      const detail = await getShowProviders(id)
      setShow(detail)
      setHistory(addToHistory(detail))
    } catch (err) {
      setShow(null)
      setError(err instanceof Error ? err.message : 'Could not load streaming info')
    } finally {
      setDetailLoading(false)
    }
  }

  function handleRemoveHistory(id: number) {
    setHistory(removeFromHistory(id))
    if (selectedId === id) {
      setSelectedId(null)
      setShow(null)
    }
  }

  return (
    <div className="app-shell">
      <div className="atmosphere" aria-hidden="true" />
      <header className="hero">
        <p className="brand">FindShow</p>
        <p className="tagline">Type a show. See where it streams.</p>
        <SearchForm loading={searchLoading} onSearch={handleSearch} />
      </header>

      {error ? (
        <p className="error-banner" role="alert">
          {error}
        </p>
      ) : null}

      <main className="layout">
        <div className="main-column">
          {hasSearched && !searchLoading && results.length === 0 && !error ? (
            <p className="status-line empty-state">No shows matched that name. Try another title.</p>
          ) : null}

          <SearchResults results={results} selectedId={selectedId} onSelect={openShow} />

          {show ? <ShowDetailView show={show} loading={detailLoading} /> : null}

          {!show && detailLoading ? <p className="status-line">Loading show…</p> : null}

          {!hasSearched && !show ? (
            <p className="status-line empty-state">
              Search for a TV show to see Netflix, Hulu, Disney+, Max, Prime Video, and more.
            </p>
          ) : null}
        </div>

        <PreviouslyViewed
          items={history}
          activeId={selectedId}
          onSelect={openShow}
          onRemove={handleRemoveHistory}
        />
      </main>
    </div>
  )
}
