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
  const streamingKeys: (keyof ProviderGroups)[] = ['flatrate', 'ads', 'free']
  const hasStreamingNow = streamingKeys.some((key) => show.providers[key].length > 0)

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
        </div>
      </div>

      <div className="providers-block">
        <h3 className="providers-heading">Currently available on (US)</h3>
        {loading ? <p className="status-line">Loading streaming services…</p> : null}
        {!loading && !hasStreamingNow ? (
          <p className="status-line">Not currently available to stream in the US.</p>
        ) : null}
        {!loading &&
          streamingKeys.map((key) => {
            const providers = show.providers[key]
            if (providers.length === 0) return null
            const label = GROUP_LABELS.find((group) => group.key === key)?.label ?? key
            return (
              <div key={key} className="provider-group">
                <h4 className="provider-group-title">{label}</h4>
                <ProviderRow providers={providers} />
              </div>
            )
          })}

        {!loading &&
          (['rent', 'buy'] as const).map((key) => {
            const providers = show.providers[key]
            if (providers.length === 0) return null
            const label = GROUP_LABELS.find((group) => group.key === key)?.label ?? key
            return (
              <div key={key} className="provider-group provider-group--secondary">
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

      {show.overview ? <p className="detail-overview">{show.overview}</p> : null}
    </section>
  )
}
