import type { SearchResult, ShowDetail } from '../types'

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

export async function getShowProviders(id: number): Promise<ShowDetail> {
  const response = await fetch(`/api/show/${id}/providers`)
  return parseJson<ShowDetail>(response)
}
