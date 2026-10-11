import type { MediaType } from './types'

export type AppHistoryState = {
  findShow: true
  view: 'home' | 'search' | 'detail'
  query?: string
  id?: number
  mediaType?: MediaType
}

export function isAppHistoryState(value: unknown): value is AppHistoryState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<AppHistoryState>
  return (
    state.findShow === true &&
    (state.view === 'home' || state.view === 'search' || state.view === 'detail')
  )
}

export function parseTitleParam(value: string | null): { id: number; mediaType: MediaType } | null {
  if (!value) return null
  const match = /^(movie|tv)-(\d+)$/.exec(value)
  if (!match) return null
  return { mediaType: match[1] as MediaType, id: Number(match[2]) }
}

export function buildAppUrl(options: {
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
  const qs = params.toString()
  return qs ? `/?${qs}` : '/'
}

export function readLocationState(): AppHistoryState {
  const params = new URLSearchParams(window.location.search)
  const query = (params.get('q') ?? '').trim()
  const title = parseTitleParam(params.get('title'))

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

  return { findShow: true, view: 'home' }
}

export function navigateApp(state: AppHistoryState, mode: 'push' | 'replace') {
  const url = buildAppUrl({
    query: state.query,
    id: state.id,
    mediaType: state.mediaType,
  })
  if (mode === 'push') {
    window.history.pushState(state, '', url)
  } else {
    window.history.replaceState(state, '', url)
  }
}
