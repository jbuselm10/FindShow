import { useEffect, useRef, useState } from 'react'
import { getTitleProviders, searchShows } from './api/client'
import { SearchForm } from './components/SearchForm'
import { SearchResults } from './components/SearchResults'
import { ShowDetailView } from './components/ShowDetail'
import { PreviouslyViewed } from './components/PreviouslyViewed'
import { addToHistory, loadHistory, removeFromHistory } from './history'
import type { HistoryItem, MediaType, SearchResult, ShowDetail } from './types'

type AppHistoryState = {
  findShow?: true
  view: 'search' | 'detail'
  id?: number
  mediaType?: MediaType
}

function isAppHistoryState(value: unknown): value is AppHistoryState {
  if (!value || typeof value !== 'object') return false
  const state = value as AppHistoryState
  return state.findShow === true && (state.view === 'search' || state.view === 'detail')
}

export default function App() {
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory())
  const [searchLoading, setSearchLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState<{ id: number; mediaType: MediaType } | null>(null)
  const [show, setShow] = useState<ShowDetail | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const openTitleRef = useRef<(id: number, mediaType: MediaType, pushHistory?: boolean) => Promise<void>>(
    async () => {},
  )

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  useEffect(() => {
    if (!isAppHistoryState(window.history.state)) {
      window.history.replaceState({ findShow: true, view: 'search' } satisfies AppHistoryState, '')
    }
  }, [])

  useEffect(() => {
    function clearDetailView() {
      setShow(null)
      setSelected(null)
      setDetailLoading(false)
      setError(null)
    }

    function onPopState(event: PopStateEvent) {
      const state = isAppHistoryState(event.state)
        ? event.state
        : ({ findShow: true, view: 'search' } satisfies AppHistoryState)

      if (state.view === 'detail' && state.id != null && state.mediaType) {
        void openTitleRef.current(state.id, state.mediaType, false)
        return
      }

      clearDetailView()
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  async function handleSearch(query: string) {
    setSearchLoading(true)
    setError(null)
    setHasSearched(true)
    setShow(null)
    setSelected(null)

    const current = window.history.state
    if (isAppHistoryState(current) && current.view === 'detail') {
      window.history.pushState({ findShow: true, view: 'search' } satisfies AppHistoryState, '')
    } else {
      window.history.replaceState({ findShow: true, view: 'search' } satisfies AppHistoryState, '')
    }

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

  async function openTitle(id: number, mediaType: MediaType, pushHistory = true) {
    setSelected({ id, mediaType })
    setDetailLoading(true)
    setError(null)

    if (pushHistory) {
      const current = window.history.state
      const sameDetail =
        isAppHistoryState(current) &&
        current.view === 'detail' &&
        current.id === id &&
        current.mediaType === mediaType
      if (!sameDetail) {
        window.history.pushState(
          { findShow: true, view: 'detail', id, mediaType } satisfies AppHistoryState,
          '',
        )
      }
    }

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

  openTitleRef.current = openTitle

  function handleBack() {
    if (isAppHistoryState(window.history.state) && window.history.state.view === 'detail') {
      window.history.back()
      return
    }

    setShow(null)
    setSelected(null)
    setDetailLoading(false)
    setError(null)
  }

  function handleRemoveHistory(id: number, mediaType: MediaType) {
    setHistory(removeFromHistory(id, mediaType))
    if (selected?.id === id && selected.mediaType === mediaType) {
      setSelected(null)
      setShow(null)
    }
  }

  const backLabel = results.length > 0 ? 'Back to results' : 'Back'

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
          {hasSearched && !searchLoading && results.length === 0 && !error && !show && !detailLoading ? (
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

          {show ? (
            <ShowDetailView
              show={show}
              loading={detailLoading}
              onBack={handleBack}
              backLabel={backLabel}
            />
          ) : null}

          {!show && detailLoading ? (
            <div className="panel detail-panel">
              <button type="button" className="back-button" onClick={handleBack}>
                <span className="back-button-icon" aria-hidden="true">
                  ←
                </span>
                {backLabel}
              </button>
              <p className="status-line">Loading show…</p>
            </div>
          ) : null}

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
