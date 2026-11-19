import type {
  ChatMessage,
  ChatResponse,
  ListVisibility,
  MediaType,
  Provider,
  PublicSearchResponse,
  SearchResult,
  ShowDetail,
  ToWatchItem,
  UserLists,
} from '../types'

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error ?? `Request failed (${response.status})`)
  }
  return data as T
}

export async function searchShows(query: string): Promise<SearchResult[]> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
  const data = await parseJson<{ results: SearchResult[] }>(response)
  return data.results
}

export async function getTitleProviders(id: number, mediaType: MediaType): Promise<ShowDetail> {
  const response = await fetch(`/api/title/${mediaType}/${id}/providers`)
  return parseJson<ShowDetail>(response)
}

export async function sendChatMessage(messages: ChatMessage[]): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  return parseJson<ChatResponse>(response)
}

export async function loadUserLists(email: string, firstName?: string): Promise<UserLists> {
  const response = await fetch('/api/lists/load', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      ...(firstName !== undefined ? { firstName } : {}),
    }),
  })
  return parseJson<UserLists>(response)
}

export async function updateWatching(
  email: string,
  action: 'add' | 'remove',
  item: {
    id: number
    name: string
    year: string | null
    posterUrl: string | null
    providers?: Provider[]
    visibility?: ListVisibility
  },
): Promise<UserLists> {
  const response = await fetch('/api/lists/watching', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, action, item }),
  })
  return parseJson<UserLists>(response)
}

export async function updateToWatch(
  email: string,
  action: 'add' | 'remove',
  item: Pick<ToWatchItem, 'id' | 'mediaType' | 'name' | 'year' | 'posterUrl'> & {
    providers?: Provider[]
    visibility?: ListVisibility
  },
): Promise<UserLists> {
  const response = await fetch('/api/lists/to-watch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, action, item }),
  })
  return parseJson<UserLists>(response)
}

export async function searchPublicLists(query: string): Promise<PublicSearchResponse> {
  const response = await fetch('/api/lists/public-search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return parseJson<PublicSearchResponse>(response)
}

export async function deleteUserLists(email: string): Promise<void> {
  const response = await fetch('/api/lists/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  await parseJson<{ ok: boolean }>(response)
}
