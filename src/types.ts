export type SearchResult = {
  id: number
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
  name: string
  year: string | null
  posterUrl: string | null
  viewedAt: string
}
