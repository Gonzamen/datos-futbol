import { useEffect, useState } from 'react'
import { useRosterStore } from '../../shared/store/rosterStore.js'
import { IconChevronLeft, IconUsers } from '../../shared/ui/icons.js'

interface RosterViewProps {
  onBack(): void
}

/**
 * Standalone screen for the group's roster — separate from any match, so
 * people can be added or fixed ahead of time and then just picked from a
 * list when building a match's teams (see TeamsView's AddPlayerField).
 */
export function RosterView({ onBack }: RosterViewProps) {
  const people = useRosterStore((state) => state.people)
  const loading = useRosterStore((state) => state.loading)
  const error = useRosterStore((state) => state.error)
  const load = useRosterStore((state) => state.load)

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="match-list">
      <div className="people__header">
        <h1 className="match-list__title">Jugadores del grupo</h1>
        <button type="button" className="btn btn--ghost btn--small" onClick={onBack}>
          <IconChevronLeft />
          Mis partidos
        </button>
      </div>

      <p className="panel__hint">
        Todos los que jugaron alguna vez, en cualquier partido. Al armar un partido nuevo, los
        elegís de acá en vez de escribirlos de cero.
      </p>

      <AddPersonForm />

      {error ? <p className="video-error">{error}</p> : null}

      {loading && people.length === 0 ? (
        <p className="panel__hint">Cargando…</p>
      ) : people.length === 0 ? (
        <div className="empty">
          <IconUsers />
          <span className="empty__title">Todavía no hay nadie</span>
          <p>Sumá a los que juegan y después armá los equipos de cada partido eligiéndolos.</p>
        </div>
      ) : (
        <ul className="people__list">
          {people.map((person) => (
            <PersonRow key={person.id} personId={person.id} name={person.name} />
          ))}
        </ul>
      )}
    </div>
  )
}

function AddPersonForm() {
  const add = useRosterStore((state) => state.add)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setBusy(true)

    if (await add(draft)) {
      setDraft('')
    }

    setBusy(false)
  }

  return (
    <form className="people__add" onSubmit={submit}>
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Nombre del jugador nuevo"
        aria-label="Nombre del jugador nuevo"
      />
      <button type="submit" className="btn btn--primary" disabled={busy || !draft.trim()}>
        Agregar
      </button>
    </form>
  )
}

function PersonRow({ personId, name }: { personId: string; name: string }) {
  const rename = useRosterStore((state) => state.rename)
  const [draft, setDraft] = useState(name)

  useEffect(() => setDraft(name), [name])

  function commit(): void {
    if (draft.trim() && draft.trim() !== name) {
      void rename(personId, draft)
    } else {
      setDraft(name)
    }
  }

  return (
    <li className="people__item">
      <span className="people__initial">{name.slice(0, 1).toUpperCase()}</span>
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur()
          }
        }}
        aria-label={`Nombre de ${name}`}
      />
    </li>
  )
}
