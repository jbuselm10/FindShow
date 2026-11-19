export type MediaType = 'movie' | 'tv'

export type SearchResult = {
  id: number
  mediaType: MediaType
  name: string
  firstAirDate: string | null
  year: string | null
  overview: string
  posterUrl: string | null
}

export type Provider = {
  id: number
  name: string
  logoUrl: string | null
  displayPriority: number
}

export type ProviderGroups = {
  flatrate: Provider[]
  ads: Provider[]
  free: Provider[]
  rent: Provider[]
  buy: Provider[]
}

export type ShowDetail = {
  id: number
  mediaType: MediaType
  name: string
  firstAirDate: string | null
  year: string | null
  overview: string
  posterUrl: string | null
  tmdbUrl: string
  providers: ProviderGroups
}

export type HistoryItem = {
  id: number
  mediaType: MediaType
  name: string
  year: string | null
  posterUrl: string | null
  viewedAt: string
  streamingProviders: Provider[]
}

export type ChatRole = 'user' | 'assistant'

export type ChatMessage = {
  role: ChatRole
  content: string
}

export type ChatResponse = {
  reply: string
  sources?: string[]
}

export type ListVisibility = 'private' | 'public'

export type WatchingItem = {
  id: number
  mediaType: 'tv'
  name: string
  year: string | null
  posterUrl: string | null
  selectedProviders: Provider[]
  visibility: ListVisibility
  updatedAt?: string
}

export type ToWatchItem = {
  id: number
  mediaType: MediaType
  name: string
  year: string | null
  posterUrl: string | null
  visibility: ListVisibility
  updatedAt?: string
}

export type UserLists = {
  watching: WatchingItem[]
  toWatch: ToWatchItem[]
  firstName?: string | null
}

export type PublicListProfile = {
  email: string
  firstName: string | null
  watching: WatchingItem[]
  toWatch: ToWatchItem[]
}

export type PublicSearchResponse = {
  results: PublicListProfile[]
}
