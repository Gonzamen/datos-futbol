import { useEffect, useState } from 'react'
import { matchesApi } from '../../shared/api/matches.js'
import type { MatchSummary } from '../../shared/api/matches.js'
import { ApiError } from '../../shared/api/client.js'
import { IconClapper } from '../../shared/ui/icons.js'

interface MatchListViewProps {
  onOpen(matchId: string): void
}

const ROLE_LABELS: Record<MatchSummary['role'], string> = {
  owner: 'Dueño',
  tagger: 'Cargando',
  viewer: 'Solo lectura',
}

export function MatchListView({ onOpen }: MatchListViewProps) {
  const [matches, setMatches] = useState<MatchSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    matchesApi
      .list()
      .then(setMatches)
      .catch((err: unknown) => setError(describeError(err)))
  }, [])

  async function refresh(): Promise<void> {
    setMatches(await matchesApi.list())
  }

  return (
    <div className="match-list">
      <h1 className="match-list__title">Mis partidos</h1>

      <div className="match-list__actions">
        <CreateMatchForm onCreated={onOpen} onRefresh={refresh} />
        <JoinMatchForm onJoined={onOpen} onRefresh={refresh} />
      </div>

      {error ? <p className="video-error">{error}</p> : null}

      {matches === null ? (
        <p className="panel__hint">Cargando…</p>
      ) : matches.length === 0 ? (
        <div className="empty">
          <IconClapper />
          <span className="empty__title">Ningún partido todavía</span>
          <p>Creá uno, o unite con el código de 6 caracteres que te pasó quien lo armó.</p>
        </div>
      ) : (
        <ul className="match-list__items">
          {matches.map((match) => (
            <li className="match-list__item" key={match.matchId}>
              <button
                type="button"
                className="match-list__open"
                onClick={() => onOpen(match.matchId)}
              >
                <span className="match-list__name">
                  {match.name || `Partido del ${match.date}`}
                </span>
                <span className="match-list__meta">
                  {match.date} · {match.eventCount} acciones · {match.memberCount}{' '}
                  {match.memberCount === 1 ? 'persona' : 'personas'}
                  {match.hasVideo ? '' : ' · sin video'} · {ROLE_LABELS[match.role]}
                </span>
              </button>
              <span className="match-list__code" title="Código de invitación">
                {match.inviteCode}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CreateMatchForm({
  onCreated,
  onRefresh,
}: {
  onCreated(matchId: string): void
  onRefresh(): Promise<void>
}) {
  const [name, setName] = useState('')
  const [date, setDate] = useState(today())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const match = await matchesApi.create({ name: name.trim() || undefined, date })
      await onRefresh()
      onCreated(match.id)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="match-list__form" onSubmit={submit}>
      <h2 className="match-list__form-title">Crear partido</h2>
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Fecha del jueves"
        aria-label="Nombre del partido"
      />
      <input
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
        aria-label="Día del partido"
      />
      <button type="submit" className="btn btn--primary" disabled={busy}>
        Crear
      </button>
      {error ? <p className="video-error">{error}</p> : null}
    </form>
  )
}

function JoinMatchForm({
  onJoined,
  onRefresh,
}: {
  onJoined(matchId: string): void
  onRefresh(): Promise<void>
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const match = await matchesApi.join(code)
      await onRefresh()
      onJoined(match.id)
    } catch (err) {
      setError(describeError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="match-list__form" onSubmit={submit}>
      <h2 className="match-list__form-title">Unirme con un código</h2>
      <input
        type="text"
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
        placeholder="ABC123"
        aria-label="Código de invitación"
        maxLength={6}
      />
      <button type="submit" className="btn" disabled={busy || !code.trim()}>
        Unirme
      </button>
      {error ? <p className="video-error">{error}</p> : null}
    </form>
  )
}

function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Error desconocido'
}
