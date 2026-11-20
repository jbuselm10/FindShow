import type { MediaType, PublicListProfile } from '../types'

type PublicListsPageProps = {
  query: string
  loading: boolean
  error: string | null
  results: PublicListProfile[]
  onBack: () => void
  onOpenTitle: (id: number, mediaType: MediaType) => void
}

function profileLabel(profile: PublicListProfile): string {
  return profile.firstName ? `${profile.firstName} · ${profile.email}` : profile.email
}

export function PublicListsPage({
  query,
  loading,
  error,
  results,
  onBack,
  onOpenTitle,
}: PublicListsPageProps) {
  const trimmed = query.trim()
  const title = trimmed ? 'Search Other Shows' : 'All public shows'
  const subtitle = trimmed
    ? `Public lists matching “${trimmed}”.`
    : 'Everyone who shared public watching or to-watch titles.'

  return (
    <section className="my-lists" aria-label={title}>
      <div className="my-lists-header panel">
        <div>
          <button type="button" className="back-button" onClick={onBack}>
            <span className="back-button-icon" aria-hidden="true">
              ←
            </span>
            Back to Home
          </button>
          <h2 className="panel-title">{title}</h2>
          <p className="status-line">{subtitle}</p>
        </div>
      </div>

      <div className="panel">
        {loading ? <p className="status-line">Loading public lists…</p> : null}
        {error ? (
          <p className="error-banner" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && results.length === 0 ? (
          <p className="status-line">
            {trimmed
              ? 'No public lists matched that email or first name.'
              : 'No one has shared public titles yet.'}
          </p>
        ) : null}
        {!loading && results.length > 0 ? (
          <div className="public-results">
            {results.map((profile) => (
              <article key={profile.email} className="public-profile">
                <h3 className="public-profile-name">{profileLabel(profile)}</h3>
                {profile.watching.length > 0 ? (
                  <div className="public-section">
                    <p className="public-section-label">Currently Watching</p>
                    <ul className="public-title-list">
                      {profile.watching.map((item) => (
                        <li key={`watching-${item.id}`}>
                          <button
                            type="button"
                            className="public-title-btn"
                            onClick={() => onOpenTitle(item.id, 'tv')}
                          >
                            {item.name}
                            {item.year ? ` (${item.year})` : ''}
                            {item.selectedProviders?.length
                              ? ` · ${item.selectedProviders.map((provider) => provider.name).join(', ')}`
                              : ''}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {profile.toWatch.length > 0 ? (
                  <div className="public-section">
                    <p className="public-section-label">Movies and Shows to watch</p>
                    <ul className="public-title-list">
                      {profile.toWatch.map((item) => (
                        <li key={`towatch-${item.mediaType}-${item.id}`}>
                          <button
                            type="button"
                            className="public-title-btn"
                            onClick={() => onOpenTitle(item.id, item.mediaType)}
                          >
                            {item.name}
                            {item.year ? ` (${item.year})` : ''}
                            {item.selectedProviders?.length
                              ? ` · ${item.selectedProviders.map((provider) => provider.name).join(', ')}`
                              : ''}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
