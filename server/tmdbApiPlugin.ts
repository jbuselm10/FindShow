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

async function handleSearch(apiKey: string, req: IncomingMessage, res: ServerResponse) {
  const { searchParams } = readUrl(req)
  const q = (searchParams.get('q') ?? '').trim()
  if (!q) {
    sendJson(res, 400, { error: 'Missing search query' })
    return
  }

  type SearchShow = {
    id: number
    name: string
    first_air_date?: string
    overview?: string
    poster_path?: string | null
  }

  const data = await tmdbFetch<{ results?: SearchShow[] }>(apiKey, '/search/tv', {
    query: q,
    include_adult: 'false',
    language: 'en-US',
  })

  const results = (data.results ?? []).map((show) => ({
    id: show.id,
    name: show.name,
    firstAirDate: show.first_air_date ?? null,
    year: show.first_air_date ? show.first_air_date.slice(0, 4) : null,
    overview: show.overview ?? '',
    posterUrl: show.poster_path ? `${IMAGE_BASE}/w185${show.poster_path}` : null,
  }))

  sendJson(res, 200, { results })
}

async function handleShowProviders(apiKey: string, id: string, res: ServerResponse) {
  if (!/^\d+$/.test(id)) {
    sendJson(res, 400, { error: 'Invalid show id' })
    return
  }

  type ShowDetails = {
    id: number
    name: string
    first_air_date?: string
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

  const [details, providersPayload] = await Promise.all([
    tmdbFetch<ShowDetails>(apiKey, `/tv/${id}`, { language: 'en-US' }),
    tmdbFetch<{ results?: Record<string, RegionProviders> }>(apiKey, `/tv/${id}/watch/providers`),
  ])

  const us = providersPayload.results?.US ?? null
  const groups = {
    flatrate: sortProviders((us?.flatrate ?? []).map(mapProvider)),
    ads: sortProviders((us?.ads ?? []).map(mapProvider)),
    free: sortProviders((us?.free ?? []).map(mapProvider)),
    rent: sortProviders((us?.rent ?? []).map(mapProvider)),
    buy: sortProviders((us?.buy ?? []).map(mapProvider)),
  }

  sendJson(res, 200, {
    id: details.id,
    name: details.name,
    firstAirDate: details.first_air_date ?? null,
    year: details.first_air_date ? String(details.first_air_date).slice(0, 4) : null,
    overview: details.overview ?? '',
    posterUrl: details.poster_path ? `${IMAGE_BASE}/w342${details.poster_path}` : null,
    tmdbUrl: us?.link ?? `https://www.themoviedb.org/tv/${details.id}`,
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

      const showMatch = url.pathname.match(/^\/api\/show\/([^/]+)\/providers$/)
      if (req.method === 'GET' && showMatch) {
        await handleShowProviders(apiKey, showMatch[1], res)
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
