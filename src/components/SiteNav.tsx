import type { AppView } from '../navigation'

type SiteNavProps = {
  activeView: AppView
  onHome: () => void
  onWatching: () => void
  onToWatch: () => void
}

export function SiteNav({ activeView, onHome, onWatching, onToWatch }: SiteNavProps) {
  return (
    <nav className="site-nav" aria-label="Primary">
      <button
        type="button"
        className={`site-nav-link${activeView === 'landing' ? ' is-active' : ''}`}
        onClick={onHome}
        aria-current={activeView === 'landing' ? 'page' : undefined}
      >
        Home
      </button>
      <button
        type="button"
        className={`site-nav-link${activeView === 'watching' ? ' is-active' : ''}`}
        onClick={onWatching}
        aria-current={activeView === 'watching' ? 'page' : undefined}
      >
        Currently Watching
      </button>
      <button
        type="button"
        className={`site-nav-link${activeView === 'toWatch' ? ' is-active' : ''}`}
        onClick={onToWatch}
        aria-current={activeView === 'toWatch' ? 'page' : undefined}
      >
        Movies and Shows to watch
      </button>
    </nav>
  )
}
