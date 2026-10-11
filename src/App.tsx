import { useEffect, useRef, useState } from 'react'
import { getTitleProviders, searchShows } from './api/client'
import { SearchForm } from './components/SearchForm'
import { SearchResults } from './components/SearchResults'
import { ShowDetailView } from './components/ShowDetail'
import { PreviouslyViewed } from './components/PreviouslyViewed'
import { addToHistory, loadHistory, removeFromHistory } from './history'
import {
  isAppHistoryState,
  navigateApp,
  readLocationState,
  type AppHistoryState,
} from './navigation'
import type { HistoryItem, MediaType, SearchResult, ShowDetail } from './types'

export default function App() {
  const initialLocation = readLocationState()
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory())
  const [searchLoading, setSearchLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState(initialLocation.query ?? '')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState<{ id: number; mediaType: MediaType } | null>(null)
  const [show, setShow] = useState<ShowDetail | null>(null)
  const [hasSearched, setHasSearched] = useState(Boolean(initialLocation.query))
  const openTitleRef = useRef<
    (id: number, mediaType: MediaType, options?: { pushHistory?: boolean; query?: string }) => Promise<void>
  >(async () => {})
  const runSearchRef = useRef<(nextQuery: string, options?: { pushHistory?: boolean }) => Promise<void>>(
    async () => {},
  )
  const resultsQueryRef = useRef('')
  const bootstrappedRef = useRef(false)

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  useEffect(() => {
    if (!isAppHistoryState(window.history.state)) {
      navigateApp(readLocationState(), 'replace')
    }
  }, [])

  useEffect(() => {
    function clearDetailView() {
      setShow(null)
      setSelected(null)
      setDetailLoading(false)
      setError(null)
    }

    function applyHistoryState(state: AppHistoryState) {
      if (state.view === 'detail' && state.id != null && state.mediaType) {
        if (state.query) setQuery(state.query)
        void openTitleRef.current(state.id, state.mediaType, {
          pushHistory: false,
          query: state.query,
        })
        return
      }

      clearDetailView()

      if (state.view === 'search' && state.query) {
        setQuery(state.query)
        setHasSearched(true)
        if (resultsQueryRef.current !== state.query) {
          void runSearchRef.current(state.query, { pushHistory: false })
        }
        return
      }

      if (state.view === 'home') {
        setQuery('')
        setResults([])
        setHasSearched(false)
      }
    }

    function onPopState(event: PopStateEvent) {
      const state = isAppHistoryState(event.state) ? event.state : readLocationState()
      applyHistoryState(state)
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (bootstrappedRef.current) return
    bootstrappedRef.current = true

    const state = readLocationState()
    if (state.view === 'detail' && state.id != null && state.mediaType) {
      if (state.query) {
        setQuery(state.query)
        setHasSearched(true)
      }
      void openTitleRef.current(state.id, state.mediaType, {
        pushHistory: false,
        query: state.query,
      })
      return
    }

    if (state.view === 'search' && state.query) {
      void runSearchRef.current(state.query, { pushHistory: false })
    }
  }, [])

  async function runSearch(nextQuery: string, options: { pushHistory?: boolean } = {}) {
    const { pushHistory = true } = options
    const trimmed = nextQuery.trim()
    if (!trimmed) return

    setSearchLoading(true)
    setError(null)
    setHasSearched(true)
    setQuery(trimmed)
    setShow(null)
    setSelected(null)

    if (pushHistory) {
      const current = window.history.state
      const mode =
        isAppHistoryState(current) && current.view === 'detail' ? 'push' : 'replace'
      navigateApp({ findShow: true, view: 'search', query: trimmed }, mode)
    }

    try {
      const nextResults = await searchShows(trimmed)
      setResults(nextResults)
      resultsQueryRef.current = trimmed
      if (nextResults.length === 1 && pushHistory) {
        await openTitle(nextResults[0].id, nextResults[0].mediaType, { query: trimmed })
      }
    } catch (err) {
      setResults([])
      resultsQueryRef.current = ''
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearchLoading(false)
    }
  }

  runSearchRef.current = runSearch

  async function openTitle(
    id: number,
    mediaType: MediaType,
    options: { pushHistory?: boolean; query?: string } = {},
  ) {
    const { pushHistory = true, query: queryOverride } = options
    const activeQuery = (queryOverride ?? query).trim()

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
        navigateApp(
          {
            findShow: true,
            view: 'detail',
            query: activeQuery || undefined,
            id,
            mediaType,
          },
          'push',
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
    const current = window.history.state
    if (isAppHistoryState(current) && current.view === 'detail') {
      window.history.back()
      return
    }

    // Fallback if history state was lost: restore list without leaving the site.
    setShow(null)
    setSelected(null)
    setDetailLoading(false)
    setError(null)
    navigateApp(
      query
        ? { findShow: true, view: 'search', query }
        : { findShow: true, view: 'home' },
      'replace',
    )
  }

  function handleRemoveHistory(id: number, mediaType: MediaType) {
    setHistory(removeFromHistory(id, mediaType))
    if (selected?.id === id && selected.mediaType === mediaType) {
      setSelected(null)
      setShow(null)
    }
  }

  const backLabel = results.length > 0 || query ? 'Back to results' : 'Back'

  return (
    <div className="app-shell">
      <div className="atmosphere" aria-hidden="true" />
      <header className="hero">
        <p className="brand">FindShow</p>
        <p className="tagline">Type a show or movie. See where it streams.</p>
        <SearchForm initialQuery={query} loading={searchLoading} onSearch={runSearch} />
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
