import { mkdirSync, openSync, closeSync, ftruncateSync, readFileSync, writeSync, existsSync } from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'

const MAX_ITEMS = 50

type Provider = {
  id: number
  name: string
  logoUrl: string | null
  displayPriority: number
}

type ListVisibility = 'private' | 'public'

type WatchingItem = {
  id: number
  mediaType: 'tv'
  name: string
  year: string | null
  posterUrl: string | null
  selectedProviders: Provider[]
  visibility: ListVisibility
  updatedAt: string
}

type ToWatchItem = {
  id: number
  mediaType: 'movie' | 'tv'
  name: string
  year: string | null
  posterUrl: string | null
  selectedProviders: Provider[]
  visibility: ListVisibility
  updatedAt: string
}

type UserBucket = {
  watching: WatchingItem[]
  toWatch: ToWatchItem[]
  firstName?: string | null
}

type Store = {
  users: Record<string, UserBucket>
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? '/', 'http://localhost')
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const limit = 64 * 1024

    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('Request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  if (!email || email.length > 254) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

function normalizeProviders(raw: unknown): Provider[] {
  if (!Array.isArray(raw)) return []
  const out: Provider[] = []
  const seen = new Set<number>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const id = typeof row.id === 'number' ? row.id : Number(row.id)
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!Number.isFinite(id) || id <= 0 || !name || seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      name,
      logoUrl: typeof row.logoUrl === 'string' && row.logoUrl ? row.logoUrl : null,
      displayPriority:
        typeof row.displayPriority === 'number' ? row.displayPriority : Number(row.displayPriority) || 0,
    })
  }
  return out
}

function emptyStore(): Store {
  return { users: {} }
}

function decodeStore(raw: string): Store {
  if (!raw.trim()) return emptyStore()
  try {
    const data = JSON.parse(raw) as { users?: Record<string, UserBucket> }
    if (!data || typeof data !== 'object' || !data.users || typeof data.users !== 'object') {
      return emptyStore()
    }
    return { users: data.users }
  } catch {
    return emptyStore()
  }
}

function normalizeFirstName(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined
  if (raw === null) return ''
  if (typeof raw !== 'string') return null
  return raw.trim().slice(0, 80)
}

function normalizeVisibility(raw: unknown): ListVisibility {
  return raw === 'public' ? 'public' : 'private'
}

function withVisibilityWatching(row: WatchingItem): WatchingItem {
  return { ...row, visibility: normalizeVisibility(row.visibility) }
}

function withVisibilityToWatch(row: ToWatchItem): ToWatchItem {
  return {
    ...row,
    selectedProviders: normalizeProviders(row.selectedProviders),
    visibility: normalizeVisibility(row.visibility),
  }
}

function ensureBucket(store: Store, email: string): UserBucket {
  if (!store.users[email]) {
    store.users[email] = { watching: [], toWatch: [], firstName: null }
  }
  const bucket = store.users[email]
  if (!Array.isArray(bucket.watching)) bucket.watching = []
  if (!Array.isArray(bucket.toWatch)) bucket.toWatch = []
  if (!('firstName' in bucket)) bucket.firstName = null
  return bucket
}

function sortByUpdated<T extends { updatedAt?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
}

function listsFilePath(root: string): string {
  const dir = path.join(root, 'data')
  mkdirSync(dir, { recursive: true })
  return path.join(dir, 'lists.json')
}

function readStore(filePath: string): Store {
  if (!existsSync(filePath)) return emptyStore()
  return decodeStore(readFileSync(filePath, 'utf8'))
}

function writeStore(filePath: string, store: Store) {
  const json = `${JSON.stringify(store, null, 2)}\n`
  const fd = openSync(filePath, 'w')
  try {
    ftruncateSync(fd, 0)
    writeSync(fd, json)
  } finally {
    closeSync(fd)
  }
}

function fetchAll(
  store: Store,
  email: string,
): { watching: WatchingItem[]; toWatch: ToWatchItem[]; firstName: string | null } {
  const bucket = ensureBucket(store, email)
  const firstName =
    typeof bucket.firstName === 'string' && bucket.firstName.trim() ? bucket.firstName.trim() : null
  return {
    watching: sortByUpdated(bucket.watching.map(withVisibilityWatching)),
    toWatch: sortByUpdated(bucket.toWatch.map(withVisibilityToWatch)),
    firstName,
  }
}

function createListsMiddleware(root: string): Connect.NextHandleFunction {
  const filePath = listsFilePath(root)

  return async (req, res, next) => {
    const url = readUrl(req)
    const pathname = url.pathname

    if (
      pathname !== '/api/lists/load' &&
      pathname !== '/api/lists/watching' &&
      pathname !== '/api/lists/to-watch' &&
      pathname !== '/api/lists/public-search' &&
      pathname !== '/api/lists/delete'
    ) {
      next()
      return
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' })
      return
    }

    try {
      const contentType = req.headers['content-type'] ?? ''
      if (!contentType.includes('application/json')) {
        sendJson(res, 415, { error: 'Content-Type must be application/json' })
        return
      }

      let body: Record<string, unknown>
      try {
        body = JSON.parse(await readBody(req)) as Record<string, unknown>
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid JSON'
        sendJson(res, 400, { error: message })
        return
      }

      const store = readStore(filePath)

      if (pathname === '/api/lists/delete') {
        const email = normalizeEmail(body.email)
        if (!email) {
          sendJson(res, 400, { error: 'Valid email is required' })
          return
        }
        if (store.users[email]) {
          delete store.users[email]
          writeStore(filePath, store)
        }
        sendJson(res, 200, { ok: true })
        return
      }

      if (pathname === '/api/lists/public-search') {
        const query = typeof body.query === 'string' ? body.query.trim() : ''
        if (query.length > 254) {
          sendJson(res, 400, { error: 'Search text is too long' })
          return
        }
        const queryLower = query.toLowerCase()
        const listAll = query === ''
        const results: Array<{
          email: string
          firstName: string | null
          watching: WatchingItem[]
          toWatch: ToWatchItem[]
        }> = []
        for (const [userEmail, bucketRaw] of Object.entries(store.users)) {
          const bucket = ensureBucket(store, userEmail)
          void bucketRaw
          const firstName =
            typeof bucket.firstName === 'string' && bucket.firstName.trim()
              ? bucket.firstName.trim()
              : ''
          if (!listAll) {
            const emailMatch = userEmail.toLowerCase() === queryLower
            const nameMatch = firstName !== '' && firstName.toLowerCase().includes(queryLower)
            if (!emailMatch && !nameMatch) continue
          }
          const payload = fetchAll(store, userEmail)
          const watching = payload.watching.filter((row) => row.visibility === 'public')
          const toWatch = payload.toWatch.filter((row) => row.visibility === 'public')
          if (watching.length === 0 && toWatch.length === 0) continue
          results.push({
            email: userEmail,
            firstName: firstName || null,
            watching,
            toWatch,
          })
          if (results.length >= (listAll ? 100 : 20)) break
        }
        sendJson(res, 200, { results })
        return
      }

      const email = normalizeEmail(body.email)
      if (!email) {
        sendJson(res, 400, { error: 'Valid email is required' })
        return
      }

      if (pathname === '/api/lists/load') {
        const firstName = normalizeFirstName(body.firstName)
        if (firstName === null) {
          sendJson(res, 400, { error: 'firstName must be a string' })
          return
        }
        const bucket = ensureBucket(store, email)
        if (firstName !== undefined) {
          bucket.firstName = firstName === '' ? null : firstName
          writeStore(filePath, store)
        }
        sendJson(res, 200, fetchAll(store, email))
        return
      }

      const action = body.action
      if (action !== 'add' && action !== 'remove') {
        sendJson(res, 400, { error: 'action must be add or remove' })
        return
      }

      const item = body.item
      if (!item || typeof item !== 'object') {
        sendJson(res, 400, { error: 'item.id is required' })
        return
      }
      const itemRow = item as Record<string, unknown>
      const id = typeof itemRow.id === 'number' ? itemRow.id : Number(itemRow.id)
      if (!Number.isFinite(id) || id <= 0) {
        sendJson(res, 400, { error: 'Invalid item id' })
        return
      }

      const bucket = ensureBucket(store, email)

      if (pathname === '/api/lists/watching') {
        if (action === 'remove') {
          bucket.watching = bucket.watching.filter((row) => row.id !== id)
          writeStore(filePath, store)
          sendJson(res, 200, fetchAll(store, email))
          return
        }

        const name = typeof itemRow.name === 'string' ? itemRow.name.trim() : ''
        if (!name) {
          sendJson(res, 400, { error: 'item.name is required' })
          return
        }
        const providers = normalizeProviders(itemRow.providers)
        if (providers.length === 0) {
          sendJson(res, 400, { error: 'Select at least one streaming service' })
          return
        }

        const exists = bucket.watching.some((row) => row.id === id)
        if (!exists && bucket.watching.length >= MAX_ITEMS) {
          sendJson(res, 400, { error: `Currently watching list is full (max ${MAX_ITEMS})` })
          return
        }

        const year = typeof itemRow.year === 'string' && itemRow.year ? itemRow.year : null
        const posterUrl =
          typeof itemRow.posterUrl === 'string' && itemRow.posterUrl ? itemRow.posterUrl : null
        const entry: WatchingItem = {
          id,
          mediaType: 'tv',
          name,
          year,
          posterUrl,
          selectedProviders: providers,
          visibility: normalizeVisibility(itemRow.visibility),
          updatedAt: new Date().toISOString(),
        }
        bucket.watching = [...bucket.watching.filter((row) => row.id !== id), entry]
        writeStore(filePath, store)
        sendJson(res, 200, fetchAll(store, email))
        return
      }

      const mediaTypeRaw = itemRow.mediaType
      if (mediaTypeRaw !== undefined && mediaTypeRaw !== 'movie' && mediaTypeRaw !== 'tv') {
        sendJson(res, 400, { error: 'item.mediaType must be movie or tv' })
        return
      }
      const mediaType: 'movie' | 'tv' = mediaTypeRaw === 'tv' ? 'tv' : 'movie'
      const sameItem = (row: ToWatchItem) =>
        row.id === id && (row.mediaType === 'tv' ? 'tv' : 'movie') === mediaType

      if (action === 'remove') {
        bucket.toWatch = bucket.toWatch.filter((row) => !sameItem(row))
        writeStore(filePath, store)
        sendJson(res, 200, fetchAll(store, email))
        return
      }

      const name = typeof itemRow.name === 'string' ? itemRow.name.trim() : ''
      if (!name) {
        sendJson(res, 400, { error: 'item.name is required' })
        return
      }

      const exists = bucket.toWatch.some(sameItem)
      if (!exists && bucket.toWatch.length >= MAX_ITEMS) {
        sendJson(res, 400, { error: `To watch list is full (max ${MAX_ITEMS})` })
        return
      }

      const year = typeof itemRow.year === 'string' && itemRow.year ? itemRow.year : null
      const posterUrl =
        typeof itemRow.posterUrl === 'string' && itemRow.posterUrl ? itemRow.posterUrl : null
      const entry: ToWatchItem = {
        id,
        mediaType,
        name,
        year,
        posterUrl,
        selectedProviders: normalizeProviders(itemRow.providers),
        visibility: normalizeVisibility(itemRow.visibility),
        updatedAt: new Date().toISOString(),
      }
      bucket.toWatch = [...bucket.toWatch.filter((row) => !sameItem(row)), entry]
      writeStore(filePath, store)
      sendJson(res, 200, fetchAll(store, email))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      sendJson(res, 502, { error: message })
    }
  }
}

export function userListsApiPlugin(): Plugin {
  return {
    name: 'user-lists-api',
    configureServer(server) {
      server.middlewares.use(createListsMiddleware(server.config.root))
    },
    configurePreviewServer(server) {
      server.middlewares.use(createListsMiddleware(server.config.root))
    },
  }
}
