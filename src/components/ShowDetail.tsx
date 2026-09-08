import type { Provider, ProviderGroups, ShowDetail } from '../types'

const GROUP_LABELS: { key: keyof ProviderGroups; label: string }[] = [
  { key: 'flatrate', label: 'Stream with subscription' },
  { key: 'ads', label: 'Free with ads' },
  { key: 'free', label: 'Free' },
  { key: 'rent', label: 'Rent' },
  { key: 'buy', label: 'Buy' },
]

function ProviderRow({ providers }: { providers: Provider[] }) {
  return (
    <ul className="provider-list">
      {providers.map((provider) => (
        <li key={provider.id} className="provider-chip">
          {provider.logoUrl ? (
            <img className="provider-logo" src={provider.logoUrl} alt="" loading="lazy" />
          ) : null}
          <span>{provider.name}</span>
        </li>
      ))}
    </ul>
  )
}

type ShowDetailViewProps = {
  show: ShowDetail
  loading: boolean
}

export function ShowDetailView({ show, loading }: ShowDetailViewProps) {
  const hasAnyProvider = GROUP_LABELS.some(({ key }) => show.providers[key].length > 0)

  return (
    <section className="panel detail-panel" aria-busy={loading}>
      <div className="detail-header">
        {show.posterUrl ? (
          <img className="detail-poster" src={show.posterUrl} alt="" />
        ) : (
          <div className="detail-poster detail-poster--empty" aria-hidden="true" />
        )}
        <div className="detail-copy">
          <h2 className="detail-title">{show.name}</h2>
          {show.year ? <p className="detail-year">{show.year}</p> : null}
          {show.overview ? <p className="detail-overview">{show.overview}</p> : null}
        </div>
      </div>

      <div className="providers-block">
        <h3 className="providers-heading">Where to watch (US)</h3>
        {loading ? <p className="status-line">Loading streaming services…</p> : null}
        {!loading && !hasAnyProvider ? (
          <p className="status-line">No streaming providers found for this show in the US.</p>
        ) : null}
        {!loading &&
          GROUP_LABELS.map(({ key, label }) => {
            const providers = show.providers[key]
            if (providers.length === 0) return null
            return (
              <div key={key} className="provider-group">
                <h4 className="provider-group-title">{label}</h4>
                <ProviderRow providers={providers} />
              </div>
            )
          })}
        <p className="attribution">
          Streaming data from{' '}
          <a href="https://www.justwatch.com" target="_blank" rel="noreferrer">
            JustWatch
          </a>
          {show.tmdbUrl ? (
            <>
              {' '}
              ·{' '}
              <a href={show.tmdbUrl} target="_blank" rel="noreferrer">
                View on TMDB
              </a>
            </>
          ) : null}
        </p>
      </div>
    </section>
  )
}
