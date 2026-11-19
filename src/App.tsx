import { useEffect, useRef, useState } from 'react'
import {
  deleteUserLists,
  getTitleProviders,
  loadUserLists,
  searchShows,
  updateToWatch,
  updateWatching,
} from './api/client'
import { ConfirmDeleteListsPrompt } from './components/ConfirmDeleteListsPrompt'
import { EmailSavePrompt } from './components/EmailSavePrompt'
import { HomeLanding } from './components/HomeLanding'
import { ListPage } from './components/ListPage'
import { SearchForm } from './components/SearchForm'
import { SearchResults } from './components/SearchResults'
import { ShowDetailView } from './components/ShowDetail'
import { SiteChat } from './components/SiteChat'
import { SiteNav } from './components/SiteNav'
import { WatchListsPanel } from './components/WatchListsPanel'
import { clearEmail, loadEmail, loadFirstName, saveEmail, saveFirstName } from './listsStorage'
import {
  isAppHistoryState,
  navigateApp,
  normalizeAppState,
  readLocationState,
  type AppHistoryState,
  type AppView,
  type ListFromView,
} from './navigation'
import type {
  ListVisibility,
  MediaType,
  Provider,
  SearchResult,
  ShowDetail,
  UserLists,
} from './types'

type PendingSave =
  | { kind: 'watching'; show: ShowDetail; providers: Provider[]; visibility: ListVisibility }
  | { kind: 'toWatch'; show: ShowDetail; visibility: ListVisibility; providers: Provider[] }
  | { kind: 'sidebar' }
  | { kind: 'nav'; target: 'watching' | 'toWatch' }

const emptyLists: UserLists = { watching: [], toWatch: [] }

export default function App() {
  const initialLocation = normalizeAppState(readLocationState())
  const [view, setView] = useState<AppView>(() => initialLocation.view)
  const [fromView, setFromView] = useState<ListFromView>(
    () => initialLocation.fromView ?? 'landing',
  )
  const [email, setEmail] = useState(() => loadEmail())
  const [firstName, setFirstName] = useState(() => loadFirstName())
  const [lists, setLists] = useState<UserLists>(emptyLists)
  const [listsLoading, setListsLoading] = useState(false)
  const [listBusy, setListBusy] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState(initialLocation.query ?? '')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState<{ id: number; mediaType: MediaType } | null>(null)
  const [show, setShow] = useState<ShowDetail | null>(null)
  const [hasSearched, setHasSearched] = useState(Boolean(initialLocation.query))
  const [emailPromptOpen, setEmailPromptOpen] = useState(false)
  const [emailPromptError, setEmailPromptError] = useState<string | null>(null)
  const [emailPromptLoading, setEmailPromptLoading] = useState(false)
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null)
  const [deletePromptOpen, setDeletePromptOpen] = useState(false)
  const [deletePromptError, setDeletePromptError] = useState<string | null>(null)
  const [deletePromptLoading, setDeletePromptLoading] = useState(false)

  const openTitleRef = useRef<
    (id: number, mediaType: MediaType, options?: { pushHistory?: boolean; query?: string }) => Promise<void>
  >(async () => {})
  const runSearchRef = useRef<(nextQuery: string, options?: { pushHistory?: boolean }) => Promise<void>>(
    async () => {},
  )
  const resultsQueryRef = useRef('')
  const bootstrappedRef = useRef(false)
  const emailRef = useRef(email)
  emailRef.current = email

  async function refreshLists(nextEmail: string) {
    const data = await loadUserLists(nextEmail)
    setLists(data)
    return data
  }

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
      const next = normalizeAppState(state)
      if (next.fromView) setFromView(next.fromView)
      setView(next.view)

      if (next.view === 'detail' && next.id != null && next.mediaType) {
        if (next.query) setQuery(next.query)
        void openTitleRef.current(next.id, next.mediaType, {
          pushHistory: false,
          query: next.query,
        })
        return
      }

      clearDetailView()

      if (next.view === 'search') {
        if (next.query) {
          setQuery(next.query)
          setHasSearched(true)
          if (resultsQueryRef.current !== next.query) {
            void runSearchRef.current(next.query, { pushHistory: false })
          }
        } else {
          setHasSearched(false)
          setResults([])
          setQuery('')
        }
        return
      }

      if (next.view === 'landing' || next.view === 'watching' || next.view === 'toWatch') {
        setQuery('')
        setResults([])
        setHasSearched(false)
      }
    }

    function onPopState(event: PopStateEvent) {
      const state = normalizeAppState(
        isAppHistoryState(event.state) ? event.state : readLocationState(),
      )
      applyHistoryState(state)
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (bootstrappedRef.current) return
    bootstrappedRef.current = true

    const state = normalizeAppState(readLocationState())
    setView(state.view)

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
      return
    }

    if (state.view === 'watching' || state.view === 'toWatch') {
      const saved = loadEmail()
      if (saved) {
        setEmail(saved)
        setListsLoading(true)
        void refreshLists(saved)
          .catch((err) => setError(err instanceof Error ? err.message : 'Could not load lists'))
          .finally(() => setListsLoading(false))
      } else {
        setView('landing')
        navigateApp({ findShow: true, view: 'landing' }, 'replace')
      }
    }
  }, [])

  async function enterWithEmail(
    nextEmail: string,
    target: 'watching' | 'toWatch' = 'watching',
    nextFirstName?: string,
  ) {
    setListsLoading(true)
    setError(null)
    try {
      const data = await loadUserLists(nextEmail, nextFirstName)
      saveEmail(nextEmail)
      const resolvedName =
        nextFirstName !== undefined
          ? nextFirstName.trim()
          : data.firstName?.trim() || loadFirstName()
      saveFirstName(resolvedName)
      setEmail(nextEmail)
      setFirstName(resolvedName)
      setLists(data)
      setView(target)
      setFromView(target)
      navigateApp({ findShow: true, view: target }, 'push')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load lists')
    } finally {
      setListsLoading(false)
    }
  }

  function goHome() {
    setView('landing')
    setShow(null)
    setSelected(null)
    setResults([])
    setQuery('')
    setHasSearched(false)
    setError(null)
    navigateApp({ findShow: true, view: 'landing' }, 'push')
  }

  function goFindFromLanding(searchQuery: string) {
    setFromView('landing')
    void runSearch(searchQuery, { pushHistory: true })
  }

  function goFindNewShow() {
    const origin: ListFromView = view === 'toWatch' ? 'toWatch' : 'watching'
    setFromView(origin)
    setView('search')
    setHasSearched(false)
    setResults([])
    setQuery('')
    setShow(null)
    setSelected(null)
    navigateApp({ findShow: true, view: 'search', fromView: origin }, 'push')
  }

  function requireEmailForList(target: 'watching' | 'toWatch') {
    if (emailRef.current) {
      void enterWithEmail(emailRef.current, target)
      return
    }
    setPendingSave({ kind: 'nav', target })
    setEmailPromptError(null)
    setEmailPromptOpen(true)
  }

  function changeEmail() {
    clearEmail()
    setEmail('')
    setFirstName('')
    setLists(emptyLists)
    goHome()
  }

  function requestRemoveEmailAndLists() {
    setDeletePromptError(null)
    setDeletePromptOpen(true)
  }

  async function confirmRemoveEmailAndLists() {
    const activeEmail = emailRef.current
    if (!activeEmail) {
      setDeletePromptOpen(false)
      return
    }
    setDeletePromptLoading(true)
    setDeletePromptError(null)
    try {
      await deleteUserLists(activeEmail)
      clearEmail()
      setEmail('')
      setFirstName('')
      setLists(emptyLists)
      setPendingSave(null)
      setDeletePromptOpen(false)
      goHome()
    } catch (err) {
      setDeletePromptError(err instanceof Error ? err.message : 'Could not remove email and lists')
    } finally {
      setDeletePromptLoading(false)
    }
  }

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
    setView('search')

    if (pushHistory) {
      const current = window.history.state
      const mode =
        isAppHistoryState(current) && current.view === 'detail' ? 'push' : 'replace'
      navigateApp({ findShow: true, view: 'search', query: trimmed, fromView }, mode)
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
    setView('detail')

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
            fromView,
          },
          'push',
        )
      }
    }

    try {
      const detail = await getTitleProviders(id, mediaType)
      setShow(detail)
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

    setShow(null)
    setSelected(null)
    setDetailLoading(false)
    setError(null)

    if (query) {
      setView('search')
      navigateApp({ findShow: true, view: 'search', query, fromView }, 'replace')
      return
    }

    if ((fromView === 'watching' || fromView === 'toWatch') && email) {
      setView(fromView)
      navigateApp({ findShow: true, view: fromView }, 'replace')
      return
    }

    setView('landing')
    navigateApp({ findShow: true, view: 'landing' }, 'replace')
  }

  async function addWatching(
    detail: ShowDetail,
    providers: Provider[],
    activeEmail: string,
    visibility: ListVisibility = 'private',
  ) {
    setListBusy(true)
    setError(null)
    try {
      const next = await updateWatching(activeEmail, 'add', {
        id: detail.id,
        name: detail.name,
        year: detail.year,
        posterUrl: detail.posterUrl,
        providers,
        visibility,
      })
      setLists(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update watching list')
    } finally {
      setListBusy(false)
    }
  }

  async function removeWatching(id: number, activeEmail: string) {
    setListBusy(true)
    setError(null)
    try {
      const next = await updateWatching(activeEmail, 'remove', {
        id,
        name: '',
        year: null,
        posterUrl: null,
      })
      setLists(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update watching list')
    } finally {
      setListBusy(false)
    }
  }

  async function addToWatchList(
    detail: ShowDetail,
    activeEmail: string,
    visibility: ListVisibility = 'private',
    providers: Provider[] = [],
  ) {
    setListBusy(true)
    setError(null)
    try {
      const next = await updateToWatch(activeEmail, 'add', {
        id: detail.id,
        mediaType: detail.mediaType,
        name: detail.name,
        year: detail.year,
        posterUrl: detail.posterUrl,
        providers,
        visibility,
      })
      setLists(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update to-watch list')
    } finally {
      setListBusy(false)
    }
  }

  async function removeToWatchList(id: number, mediaType: MediaType, activeEmail: string) {
    setListBusy(true)
    setError(null)
    try {
      const next = await updateToWatch(activeEmail, 'remove', {
        id,
        mediaType,
        name: '',
        year: null,
        posterUrl: null,
      })
      setLists(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update to-watch list')
    } finally {
      setListBusy(false)
    }
  }

  function requestAddWatching(providers: Provider[], visibility: ListVisibility) {
    if (!show || show.mediaType !== 'tv') return
    if (!emailRef.current) {
      setPendingSave({ kind: 'watching', show, providers, visibility })
      setEmailPromptError(null)
      setEmailPromptOpen(true)
      return
    }
    void addWatching(show, providers, emailRef.current, visibility)
  }

  function requestAddToWatch(visibility: ListVisibility, providers: Provider[]) {
    if (!show) return
    if (!emailRef.current) {
      setPendingSave({ kind: 'toWatch', show, visibility, providers })
      setEmailPromptError(null)
      setEmailPromptOpen(true)
      return
    }
    void addToWatchList(show, emailRef.current, visibility, providers)
  }

  function requestSidebarEmail() {
    setPendingSave({ kind: 'sidebar' })
    setEmailPromptError(null)
    setEmailPromptOpen(true)
  }

  async function handleEmailPromptSubmit(nextEmail: string, nextFirstName: string) {
    setEmailPromptLoading(true)
    setEmailPromptError(null)
    try {
      const data = await loadUserLists(nextEmail, nextFirstName)
      saveEmail(nextEmail)
      saveFirstName(nextFirstName)
      setEmail(nextEmail)
      setFirstName(nextFirstName.trim())
      setLists(data)
      setEmailPromptOpen(false)

      const pending = pendingSave
      setPendingSave(null)
      if (!pending) return

      if (pending.kind === 'watching') {
        await addWatching(pending.show, pending.providers, nextEmail, pending.visibility)
      } else if (pending.kind === 'toWatch') {
        await addToWatchList(pending.show, nextEmail, pending.visibility, pending.providers)
      } else if (pending.kind === 'nav') {
        setView(pending.target)
        setFromView(pending.target)
        navigateApp({ findShow: true, view: pending.target }, 'push')
      }
    } catch (err) {
      setEmailPromptError(err instanceof Error ? err.message : 'Could not save email')
    } finally {
      setEmailPromptLoading(false)
    }
  }

  const backLabel =
    results.length > 0 || query
      ? 'Back to results'
      : fromView === 'watching'
        ? 'Back to Currently Watching'
        : fromView === 'toWatch'
          ? 'Back to Movies and Shows to watch'
          : 'Back'
  const showSearchChrome = view === 'search' || view === 'detail'
  const isOnWatching = Boolean(
    show && show.mediaType === 'tv' && lists.watching.some((item) => item.id === show.id),
  )
  const isOnToWatch = Boolean(
    show &&
      lists.toWatch.some((item) => item.id === show.id && item.mediaType === show.mediaType),
  )

  const tagline =
    view === 'landing'
      ? 'Find where it streams — or open your watch lists.'
      : view === 'watching'
        ? "TV shows you're watching, with the services you chose."
        : view === 'toWatch'
          ? 'Movies and shows you want to watch later.'
          : 'Type a show or movie. See where it streams.'

  return (
    <div className="app-shell">
      <div className="atmosphere" aria-hidden="true" />
      <header className="hero">
        <p className="brand">FindShow</p>
        <p className="tagline">{tagline}</p>
        <SiteNav
          activeView={view}
          onHome={goHome}
          onWatching={() => requireEmailForList('watching')}
          onToWatch={() => requireEmailForList('toWatch')}
        />
        {showSearchChrome ? (
          <SearchForm initialQuery={query} loading={searchLoading} onSearch={runSearch} />
        ) : null}
      </header>

      {error ? (
        <p className="error-banner" role="alert">
          {error}
        </p>
      ) : null}

      {view === 'landing' ? (
        <HomeLanding
          savedEmail={email}
          savedFirstName={firstName}
          loading={listsLoading}
          error={error}
          onSearch={goFindFromLanding}
          onEnterEmail={(value, name) => void enterWithEmail(value, 'watching', name)}
          onContinueSaved={() => {
            if (email) void enterWithEmail(email, 'watching')
          }}
          onOpenTitle={(id, mediaType) => {
            setFromView('landing')
            void openTitle(id, mediaType)
          }}
        />
      ) : null}

      {view === 'watching' ? (
        listsLoading ? (
          <p className="status-line">Loading your lists…</p>
        ) : (
          <ListPage
            mode="watching"
            email={email}
            firstName={firstName}
            items={lists.watching}
            onFindNewShow={goFindNewShow}
            onChangeEmail={changeEmail}
            onRemoveEmailAndLists={requestRemoveEmailAndLists}
            onSelect={openTitle}
            onRemove={(id) => {
              if (email) void removeWatching(id, email)
            }}
          />
        )
      ) : null}

      {view === 'toWatch' ? (
        listsLoading ? (
          <p className="status-line">Loading your lists…</p>
        ) : (
          <ListPage
            mode="toWatch"
            email={email}
            firstName={firstName}
            items={lists.toWatch}
            onFindNewShow={goFindNewShow}
            onChangeEmail={changeEmail}
            onRemoveEmailAndLists={requestRemoveEmailAndLists}
            onSelect={openTitle}
            onRemove={(id, mediaType) => {
              if (email) void removeToWatchList(id, mediaType, email)
            }}
          />
        )
      ) : null}

      {showSearchChrome ? (
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
                isOnWatching={isOnWatching}
                isOnToWatch={isOnToWatch}
                listBusy={listBusy}
                onAddWatching={requestAddWatching}
                onRemoveWatching={() => {
                  if (show && email) void removeWatching(show.id, email)
                }}
                onAddToWatch={requestAddToWatch}
                onRemoveToWatch={() => {
                  if (show && email) void removeToWatchList(show.id, show.mediaType, email)
                }}
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

          <WatchListsPanel
            email={email || null}
            watching={lists.watching}
            toWatch={lists.toWatch}
            activeId={selected?.id ?? null}
            activeMediaType={selected?.mediaType ?? null}
            onSelect={openTitle}
            onRemoveWatching={(id) => {
              if (email) void removeWatching(id, email)
            }}
            onRemoveToWatch={(id, mediaType) => {
              if (email) void removeToWatchList(id, mediaType, email)
            }}
            onPromptEmail={requestSidebarEmail}
          />
        </main>
      ) : null}

      <EmailSavePrompt
        open={emailPromptOpen}
        loading={emailPromptLoading}
        error={emailPromptError}
        initialEmail={email}
        initialFirstName={firstName}
        onCancel={() => {
          setEmailPromptOpen(false)
          setPendingSave(null)
          setEmailPromptError(null)
        }}
        onSubmit={(value, name) => void handleEmailPromptSubmit(value, name)}
      />

      <ConfirmDeleteListsPrompt
        open={deletePromptOpen}
        email={email}
        loading={deletePromptLoading}
        error={deletePromptError}
        onCancel={() => {
          if (deletePromptLoading) return
          setDeletePromptOpen(false)
          setDeletePromptError(null)
        }}
        onConfirm={() => void confirmRemoveEmailAndLists()}
      />

      <SiteChat />
    </div>
  )
}
