import type { HistoryItem, ShowDetail } from './types'

const STORAGE_KEY = 'findshow:history'
const MAX_ITEMS = 20

export function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as HistoryItem[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function addToHistory(show: Pick<ShowDetail, 'id' | 'name' | 'year' | 'posterUrl'>): HistoryItem[] {
  const next: HistoryItem = {
    id: show.id,
    name: show.name,
    year: show.year,
    posterUrl: show.posterUrl,
    viewedAt: new Date().toISOString(),
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
