import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { loadEnv } from 'vite'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMAGE_BASE = 'https://image.tmdb.org/t/p'

type Provider = {
  provider_id: number
  provider_name: string
  logo_path: string | null
  display_priority?: number
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? '/', 'http://localhost')
}

async function tmdbFetch<T>(
  apiKey: string,
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${TMDB_BASE}${path}`)
  url.searchParams.set('api_key', apiKey)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`TMDB ${response.status}: ${text}`)
  }
  return (await response.json()) as T
}

function mapProvider(provider: Provider) {
  return {
    id: provider.provider_id,
    name: provider.provider_name,
    logoUrl: provider.logo_path ? `${IMAGE_BASE}/original${provider.logo_path}` : null,
    displayPriority: provider.display_priority ?? 999,
  }
}

function sortProviders(providers: ReturnType<typeof mapProvider>[]) {
  return [...providers].sort((a, b) => a.displayPriority - b.displayPriority)
}

const MAX_SEARCH_RESULTS = 20

type MediaType = 'movie' | 'tv'

async function handleSearch(apiKey: string, req: IncomingMessage, res: ServerResponse) {
  const { searchParams } = readUrl(req)
  const q = (searchParams.get('q') ?? '').trim()
  if (!q) {
    sendJson(res, 400, { error: 'Missing search query' })
    return
  }

  type MultiResult = {
    id: number
    media_type?: string
    name?: string
    title?: string
    first_air_date?: string
    release_date?: string
    overview?: string
    poster_path?: string | null
  }

  const data = await tmdbFetch<{ results?: MultiResult[] }>(apiKey, '/search/multi', {
    query: q,
    include_adult: 'false',
    language: 'en-US',
  })

  const results = (data.results ?? [])
    .filter((item): item is MultiResult & { media_type: MediaType } => {
      return item.media_type === 'movie' || item.media_type === 'tv'
    })
    .slice(0, MAX_SEARCH_RESULTS)
    .map((item) => {
      const date = item.media_type === 'movie' ? item.release_date : item.first_air_date
      const name = item.media_type === 'movie' ? (item.title ?? '') : (item.name ?? '')
      return {
        id: item.id,
        mediaType: item.media_type,
        name,
        firstAirDate: date ?? null,
        year: date ? date.slice(0, 4) : null,
        overview: item.overview ?? '',
        posterUrl: item.poster_path ? `${IMAGE_BASE}/w185${item.poster_path}` : null,
      }
    })

  sendJson(res, 200, { results })
}

async function handleTitleProviders(
  apiKey: string,
  mediaType: MediaType,
  id: string,
  res: ServerResponse,
) {
  if (!/^\d+$/.test(id)) {
    sendJson(res, 400, { error: 'Invalid title id' })
    return
  }

  type TitleDetails = {
    id: number
    name?: string
    title?: string
    first_air_date?: string
    release_date?: string
    overview?: string
    poster_path?: string | null
  }

  type RegionProviders = {
    link?: string
    flatrate?: Provider[]
    ads?: Provider[]
    free?: Provider[]
    rent?: Provider[]
    buy?: Provider[]
  }

  const detailsPath = mediaType === 'movie' ? `/movie/${id}` : `/tv/${id}`
  const [details, providersPayload] = await Promise.all([
    tmdbFetch<TitleDetails>(apiKey, detailsPath, { language: 'en-US' }),
    tmdbFetch<{ results?: Record<string, RegionProviders> }>(apiKey, `${detailsPath}/watch/providers`),
  ])

  const us = providersPayload.results?.US ?? null
  const groups = {
    flatrate: sortProviders((us?.flatrate ?? []).map(mapProvider)),
    ads: sortProviders((us?.ads ?? []).map(mapProvider)),
    free: sortProviders((us?.free ?? []).map(mapProvider)),
    rent: sortProviders((us?.rent ?? []).map(mapProvider)),
    buy: sortProviders((us?.buy ?? []).map(mapProvider)),
  }

  const date = mediaType === 'movie' ? details.release_date : details.first_air_date
  const name = mediaType === 'movie' ? (details.title ?? '') : (details.name ?? '')
  const tmdbPath = mediaType === 'movie' ? 'movie' : 'tv'

  sendJson(res, 200, {
    id: details.id,
    mediaType,
    name,
    firstAirDate: date ?? null,
    year: date ? String(date).slice(0, 4) : null,
    overview: details.overview ?? '',
    posterUrl: details.poster_path ? `${IMAGE_BASE}/w342${details.poster_path}` : null,
    tmdbUrl: us?.link ?? `https://www.themoviedb.org/${tmdbPath}/${details.id}`,
    providers: groups,
  })
}

function createApiMiddleware(apiKey: string): Connect.NextHandleFunction {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/')) {
      next()
      return
    }

    try {
      if (!apiKey) {
        sendJson(res, 500, {
          error: 'TMDB_API_KEY is not configured. Add it to your .env file.',
        })
        return
      }

      const url = readUrl(req)
      if (req.method === 'GET' && url.pathname === '/api/search') {
        await handleSearch(apiKey, req, res)
        return
      }

      const titleMatch = url.pathname.match(/^\/api\/title\/(movie|tv)\/([^/]+)\/providers$/)
      if (req.method === 'GET' && titleMatch) {
        await handleTitleProviders(apiKey, titleMatch[1] as MediaType, titleMatch[2], res)
        return
      }

      const showMatch = url.pathname.match(/^\/api\/show\/([^/]+)\/providers$/)
      if (req.method === 'GET' && showMatch) {
        await handleTitleProviders(apiKey, 'tv', showMatch[1], res)
        return
      }

      sendJson(res, 404, { error: 'Not found' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      sendJson(res, 502, { error: message })
    }
  }
}

export function tmdbApiPlugin(): Plugin {
  return {
    name: 'tmdb-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, '')
      const apiKey = env.TMDB_API_KEY ?? process.env.TMDB_API_KEY ?? ''
      server.middlewares.use(createApiMiddleware(apiKey))
    },
    configurePreviewServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, '')
      const apiKey = env.TMDB_API_KEY ?? process.env.TMDB_API_KEY ?? ''
      server.middlewares.use(createApiMiddleware(apiKey))
    },
  }
}
