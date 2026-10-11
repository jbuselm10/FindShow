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
