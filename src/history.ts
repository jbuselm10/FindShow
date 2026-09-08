import type { HistoryItem, Provider, ProviderGroups, ShowDetail } from './types'

const STORAGE_KEY = 'findshow:history'
const MAX_ITEMS = 20

export function getStreamingProviders(providers: ProviderGroups): Provider[] {
  const seen = new Set<number>()
  const merged: Provider[] = []

  for (const group of [providers.flatrate, providers.ads, providers.free]) {
    for (const provider of group) {
      if (seen.has(provider.id)) continue
      seen.add(provider.id)
      merged.push(provider)
    }
  }

  return merged.sort((a, b) => a.displayPriority - b.displayPriority)
}

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<Partial<HistoryItem> & { id: number; name: string }>
    if (!Array.isArray(parsed)) return []

    return parsed.map((item) => ({
      id: item.id,
      name: item.name,
      year: item.year ?? null,
      posterUrl: item.posterUrl ?? null,
      viewedAt: item.viewedAt ?? new Date().toISOString(),
      streamingProviders: Array.isArray(item.streamingProviders) ? item.streamingProviders : [],
    }))
  } catch {
    return []
  }
}

function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function addToHistory(show: ShowDetail): HistoryItem[] {
  const next: HistoryItem = {
    id: show.id,
    name: show.name,
    year: show.year,
    posterUrl: show.posterUrl,
    viewedAt: new Date().toISOString(),
    streamingProviders: getStreamingProviders(show.providers),
  }

  const filtered = loadHistory().filter((item) => item.id !== show.id)
  const items = [next, ...filtered].slice(0, MAX_ITEMS)
  saveHistory(items)
  return items
}

export function removeFromHistory(id: number): HistoryItem[] {
  const items = loadHistory().filter((item) => item.id !== id)
  saveHistory(items)
  return items
}
