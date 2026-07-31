import { suggestPeople } from '@datos-futbol/domain'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useMatchStore } from '../../shared/store/matchStore.js'
import { IconClose } from '../../shared/ui/icons.js'

/**
 * Rosters change every weekend, so building a match's teams means picking
 * from the group's roster (managed in its own screen, reachable from "Mis
 * partidos") rather than typing everybody in from scratch.
 */
export function TeamsView() {
  const teams = useMatchStore((state) => state.match!.teams)

  return (
    <div className="panel">
      <h2 className="panel__title">Equipos y jugadores</h2>
      <p className="panel__hint">
        Los cambios se guardan solos. Borrar un jugador borra sus estadísticas de este partido. Si
        alguien todavía no está en el grupo, sumalo primero desde "Jugadores del grupo" en Mis
        partidos.
      </p>

      <div className="teams-editor">
        {teams.map((team) => (
          <TeamEditor key={team.id} teamId={team.id} />
        ))}
      </div>
    </div>
  )
}

function TeamEditor({ teamId }: { teamId: string }) {
  const team = useMatchStore((state) => state.match!.teams.find((entry) => entry.id === teamId))
  const setTeamName = useMatchStore((state) => state.setTeamName)
  const setTeamColor = useMatchStore((state) => state.setTeamColor)
  const renamePlayer = useMatchStore((state) => state.renamePlayer)
  const dropPlayer = useMatchStore((state) => state.dropPlayer)

  if (!team) {
    return null
  }

  return (
    <div className="team-editor team" style={{ '--team': team.color } as CSSProperties}>
      <div className="team-editor__header">
        <input
          type="text"
          value={team.name}
          onChange={(event) => setTeamName(team.id, event.target.value)}
          aria-label="Nombre del equipo"
          style={{ color: 'var(--team-ink)' }}
        />
        <input
          type="color"
          value={team.color}
          onChange={(event) => setTeamColor(team.id, event.target.value)}
          aria-label={`Color de ${team.name}`}
        />
      </div>

      <p className="team-editor__count">
        {team.players.length} {team.players.length === 1 ? 'jugador' : 'jugadores'}
      </p>

      <ul className="team-editor__players">
        {team.players.map((player) => (
          <li key={player.id}>
            <input
              type="text"
              value={player.name}
              onChange={(event) => renamePlayer(player.id, event.target.value)}
              aria-label="Nombre del jugador"
            />
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={() => dropPlayer(player.id)}
              aria-label={`Quitar a ${player.name}`}
            >
              <IconClose />
            </button>
          </li>
        ))}
      </ul>

      <AddPlayerField teamId={team.id} />
    </div>
  )
}

function AddPlayerField({ teamId }: { teamId: string }) {
  const people = useMatchStore((state) => state.people)
  const teams = useMatchStore((state) => state.match!.teams)
  const addPlayerToTeam = useMatchStore((state) => state.addPlayerToTeam)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const alreadyPlaying = new Set(
    teams.flatMap((team) => team.players.map((player) => player.personId)),
  )
  const available = people.filter((person) => !alreadyPlaying.has(person.id))
  const filtered = query.trim() ? suggestPeople(available, query) : available

  function toggle(personId: string): void {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(personId)) {
        next.delete(personId)
      } else {
        next.add(personId)
      }
      return next
    })
  }

  async function submit(): Promise<void> {
    if (selected.size === 0 || busy) return
    setBusy(true)

    for (const person of people.filter((entry) => selected.has(entry.id))) {
      await addPlayerToTeam(teamId, person.name)
    }

    setSelected(new Set())
    setQuery('')
    setBusy(false)
  }

  return (
    <div className="team-editor__add">
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar en el grupo"
        aria-label="Buscar jugador del grupo"
      />

      {filtered.length === 0 ? (
        <p className="panel__hint">
          {available.length === 0
            ? 'Ya están todos sumados a algún equipo.'
            : 'Nadie coincide con la búsqueda.'}
        </p>
      ) : (
        <ul className="team-editor__picker">
          {filtered.map((person) => (
            <li key={person.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.has(person.id)}
                  onChange={() => toggle(person.id)}
                />
                {person.name}
              </label>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="btn" onClick={submit} disabled={busy || selected.size === 0}>
        Sumar seleccionados{selected.size ? ` (${selected.size})` : ''}
      </button>
    </div>
  )
}
