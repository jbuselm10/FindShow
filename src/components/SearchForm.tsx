import { useState, type FormEvent } from 'react'

type SearchFormProps = {
  initialQuery?: string
  loading: boolean
  onSearch: (query: string) => void
}

export function SearchForm({ initialQuery = '', loading, onSearch }: SearchFormProps) {
  const [query, setQuery] = useState(initialQuery)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed || loading) return
    onSearch(trimmed)
  }

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="show-query">
        Show name
      </label>
      <input
        id="show-query"
        className="search-input"
        type="search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Enter a show name…"
        autoComplete="off"
        autoFocus
      />
      <button className="search-button" type="submit" disabled={loading || !query.trim()}>
        {loading ? 'Searching…' : 'Find'}
      </button>
    </form>
  )
}
