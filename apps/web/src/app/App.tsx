import { useCallback, useEffect, useState } from 'react'
import { LoginScreen } from '../features/auth/LoginScreen.js'
import { MatchListView } from '../features/matches/MatchListView.js'
import { RosterView } from '../features/roster/RosterView.js'
import { SummaryView } from '../features/summary/SummaryView.js'
import { TableView } from '../features/table/TableView.js'
import { TaggingView } from '../features/tagging/TaggingView.js'
import { TeamsView } from '../features/teams/TeamsView.js'
import { downloadCsv } from '../shared/download.js'
import { useSessionStore } from '../shared/session/sessionStore.js'
import { useMatchStore } from '../shared/store/matchStore.js'
import { Logo } from '../shared/ui/Logo.js'
import {
  IconChevronLeft,
  IconClapper,
  IconGrid,
  IconLogout,
  IconTrophy,
  IconUsers,
} from '../shared/ui/icons.js'
import { VideoProvider } from '../shared/video/VideoContext.js'
import type { VideoSource } from '../shared/video/VideoSource.js'
import { useKeyboardShortcuts } from './useKeyboardShortcuts.js'

const VIEWS = [
  { id: 'partido', label: 'Partido', Icon: IconClapper },
  { id: 'tabla', label: 'Tabla', Icon: IconGrid },
  { id: 'resumen', label: 'Resumen', Icon: IconTrophy },
  { id: 'equipos', label: 'Equipos', Icon: IconUsers },
] as const

type ViewId = (typeof VIEWS)[number]['id']

interface VideoState {
  source: VideoSource | null
  error: string | null
}

export function App() {
  const status = useSessionStore((state) => state.status)
  const checkSession = useSessionStore((state) => state.checkSession)

  useEffect(() => {
    void checkSession()
  }, [checkSession])

  if (status === 'loading') {
    return <div className="splash">Cargando…</div>
  }

  if (status === 'anonymous') {
    return <LoginScreen />
  }

  return <AuthenticatedApp />
}

function AuthenticatedApp() {
  const user = useSessionStore((state) => state.user)
  const logout = useSessionStore((state) => state.logout)
  const [openMatchId, setOpenMatchId] = useState<string | null>(null)
  const [showRoster, setShowRoster] = useState(false)
  const match = useMatchStore((state) => state.match)
  const loading = useMatchStore((state) => state.loading)
  const loadError = useMatchStore((state) => state.loadError)
  const openMatch = useMatchStore((state) => state.openMatch)
  const closeMatch = useMatchStore((state) => state.closeMatch)

  if (!user) {
    return null
  }

  function handleOpen(matchId: string): void {
    setOpenMatchId(matchId)
    void openMatch(matchId, user!.id)
  }

  function handleBack(): void {
    setOpenMatchId(null)
    closeMatch()
  }

  async function handleLogout(): Promise<void> {
    closeMatch()
    setOpenMatchId(null)
    await logout()
  }

  if (!openMatchId) {
    return (
      <div className="app-shell">
        <TopBar
          userName={user.name}
          onLogout={handleLogout}
          onRoster={() => setShowRoster((current) => !current)}
          rosterActive={showRoster}
        />
        {showRoster ? (
          <RosterView onBack={() => setShowRoster(false)} />
        ) : (
          <MatchListView onOpen={handleOpen} />
        )}
        <Toast />
      </div>
    )
  }

  if (loading || !match) {
    return (
      <div className="app-shell">
        <TopBar userName={user.name} onLogout={handleLogout} />
        <div className="match-loading">
          {loadError ? (
            <>
              <p className="video-error">{loadError}</p>
              <button type="button" className="btn" onClick={handleBack}>
                <IconChevronLeft />
                Mis partidos
              </button>
            </>
          ) : (
            <p>Cargando partido…</p>
          )}
        </div>
      </div>
    )
  }

  return <MatchApp onBack={handleBack} />
}

interface TopBarProps {
  userName: string
  onLogout(): void
  onRoster?(): void
  rosterActive?: boolean
}

function TopBar({ userName, onLogout, onRoster, rosterActive }: TopBarProps) {
  return (
    <div className="top-bar">
      <Logo />

      {onRoster ? (
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={onRoster}
          aria-pressed={rosterActive}
        >
          <IconUsers />
          Jugadores del grupo
        </button>
      ) : null}

      <span className="top-bar__user">
        <span className="top-bar__avatar">{userName.slice(0, 1).toUpperCase()}</span>
        {userName}
      </span>

      <button
        type="button"
        className="btn btn--ghost btn--small"
        onClick={onLogout}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
      >
        <IconLogout />
      </button>
    </div>
  )
}

function MatchApp({ onBack }: { onBack(): void }) {
  const [view, setView] = useState<ViewId>('partido')
  const [video, setVideo] = useState<VideoState>({ source: null, error: null })

  const onSourceChange = useCallback((value: VideoState) => setVideo(value), [])

  return (
    <VideoProvider value={video}>
      <Shell view={view} onViewChange={setView} onSourceChange={onSourceChange} onBack={onBack} />
    </VideoProvider>
  )
}

interface ShellProps {
  view: ViewId
  onViewChange(view: ViewId): void
  onSourceChange(value: VideoState): void
  onBack(): void
}

/**
 * Lives inside the provider so the shortcuts can reach the player.
 *
 * Every view stays mounted and is hidden with CSS instead of being unmounted:
 * switching to the table and back must not tear down the YouTube player and
 * lose the position in the video.
 */
function Shell({ view, onViewChange, onSourceChange, onBack }: ShellProps) {
  useKeyboardShortcuts()

  return (
    <div className="app-shell">
      <Header onBack={onBack} />

      <nav className="app-nav">
        {VIEWS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`app-nav__item${view === entry.id ? ' is-active' : ''}`}
            onClick={() => onViewChange(entry.id)}
            aria-current={view === entry.id}
          >
            <entry.Icon />
            {entry.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        <section className={panelClass(view, 'partido')}>
          <TaggingView onSourceChange={onSourceChange} />
        </section>
        <section className={panelClass(view, 'tabla')}>
          <TableView />
        </section>
        <section className={panelClass(view, 'resumen')}>
          <SummaryView />
        </section>
        <section className={panelClass(view, 'equipos')}>
          <TeamsView />
        </section>
      </main>

      <Toast />
    </div>
  )
}

function Header({ onBack }: { onBack(): void }) {
  const match = useMatchStore((state) => state.match!)
  const setMatchName = useMatchStore((state) => state.setMatchName)
  const setMatchDate = useMatchStore((state) => state.setMatchDate)

  return (
    <header className="app-header">
      <div className="app-header__back">
        <button type="button" className="btn btn--ghost btn--small" onClick={onBack}>
          <IconChevronLeft />
          Mis partidos
        </button>
        <input
          type="text"
          className="title-input"
          value={match.name}
          onChange={(event) => setMatchName(event.target.value)}
          autoComplete="off"
          placeholder="Fecha del jueves"
          aria-label="Nombre del partido"
        />
      </div>

      <div className="app-header__match">
        <label className="field">
          <span>Día</span>
          <input
            type="date"
            value={match.date}
            onChange={(event) => setMatchDate(event.target.value)}
          />
        </label>
      </div>

      <div className="app-header__actions">
        <button type="button" className="btn" onClick={() => downloadCsv(match)}>
          Exportar CSV
        </button>
      </div>
    </header>
  )
}

const TOAST_MS = 2600

function Toast() {
  const toast = useMatchStore((state) => state.toast)
  const dismissToast = useMatchStore((state) => state.dismissToast)

  useEffect(() => {
    if (!toast) {
      return
    }

    const timer = window.setTimeout(dismissToast, TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast, dismissToast])

  return (
    <div className={`toast${toast ? ' is-visible' : ''}`} role="status" aria-live="polite">
      {toast}
    </div>
  )
}

function panelClass(current: ViewId, target: ViewId): string {
  return `view${current === target ? ' is-active' : ''}`
}
