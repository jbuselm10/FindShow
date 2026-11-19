import type { MediaType } from './types'

export type AppView = 'landing' | 'watching' | 'toWatch' | 'search' | 'detail'

export type ListFromView = 'landing' | 'watching' | 'toWatch'

export type AppHistoryState = {
  findShow: true
  view: AppView
  query?: string
  id?: number
  mediaType?: MediaType
  /** Where search was entered from, for Back navigation */
  fromView?: ListFromView
}

function normalizeView(view: unknown): AppView | null {
  if (view === 'home' || view === 'landing') return 'landing'
  if (view === 'myLists' || view === 'watching') return 'watching'
  if (view === 'toWatch') return 'toWatch'
  if (view === 'search') return 'search'
  if (view === 'detail') return 'detail'
  return null
}

export function isAppHistoryState(value: unknown): value is AppHistoryState {
  if (!value || typeof value !== 'object') return false
  const state = value as { findShow?: unknown; view?: unknown }
  if (state.findShow !== true) return false
  return normalizeView(state.view) !== null
}

export function normalizeAppState(state: AppHistoryState): AppHistoryState {
  const view = normalizeView((state as { view?: unknown }).view) ?? 'landing'
  const fromRaw = (state as { fromView?: unknown }).fromView
  let fromView: ListFromView | undefined
  if (fromRaw === 'landing' || fromRaw === 'watching' || fromRaw === 'toWatch') {
    fromView = fromRaw
  } else if (fromRaw === 'myLists') {
    fromView = 'watching'
  }
  return { ...state, view, fromView }
}

export function parseTitleParam(value: string | null): { id: number; mediaType: MediaType } | null {
  if (!value) return null
  const match = /^(movie|tv)-(\d+)$/.exec(value)
  if (!match) return null
  return { mediaType: match[1] as MediaType, id: Number(match[2]) }
}

export function buildAppUrl(options: {
  view?: AppView
  query?: string
  id?: number
  mediaType?: MediaType
}): string {
  const params = new URLSearchParams()
  const query = options.query?.trim()
  if (query) params.set('q', query)
  if (options.id != null && options.mediaType) {
    params.set('title', `${options.mediaType}-${options.id}`)
  }
  if (!query && options.id == null) {
    if (options.view === 'watching') params.set('watching', '1')
    if (options.view === 'toWatch') params.set('towatch', '1')
  }
  const qs = params.toString()
  return qs ? `/?${qs}` : '/'
}

export function readLocationState(): AppHistoryState {
  const params = new URLSearchParams(window.location.search)
  const query = (params.get('q') ?? '').trim()
  const title = parseTitleParam(params.get('title'))
  const watching = params.get('watching') === '1' || params.get('lists') === '1'
  const toWatch = params.get('towatch') === '1'

  if (title) {
    return {
      findShow: true,
      view: 'detail',
      query: query || undefined,
      id: title.id,
      mediaType: title.mediaType,
    }
  }

  if (query) {
    return { findShow: true, view: 'search', query }
  }

  if (toWatch) {
    return { findShow: true, view: 'toWatch' }
  }

  if (watching) {
    return { findShow: true, view: 'watching' }
  }

  return { findShow: true, view: 'landing' }
}

export function navigateApp(state: AppHistoryState, mode: 'push' | 'replace') {
  const normalized = normalizeAppState(state)
  const url = buildAppUrl({
    view: normalized.view,
    query: normalized.query,
    id: normalized.id,
    mediaType: normalized.mediaType,
  })
  if (mode === 'push') {
    window.history.pushState(normalized, '', url)
  } else {
    window.history.replaceState(normalized, '', url)
  }
}
