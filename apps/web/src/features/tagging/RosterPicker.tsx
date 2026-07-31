import type { CSSProperties } from 'react'
import { useMatchStore } from '../../shared/store/matchStore.js'

export function RosterPicker() {
  const teams = useMatchStore((state) => state.match!.teams)
  const selectedPlayerId = useMatchStore((state) => state.selectedPlayerId)
  const selectPlayer = useMatchStore((state) => state.selectPlayer)

  const hasPlayers = teams.some((team) => team.players.length > 0)

  if (!hasPlayers) {
    return (
      <p className="panel__hint">
        Todavía no hay jugadores. Cargalos en la pestaña <strong>Equipos</strong>.
      </p>
    )
  }

  return (
    <div className="rosters">
      {teams.map((team) => (
        <div
          className="roster team"
          key={team.id}
          style={{ '--team': team.color } as CSSProperties}
        >
          <h3 className="roster__title" style={{ color: 'var(--team-ink)' }}>
            <span className="team-dot" />
            {team.name}
          </h3>
          <ul className="roster__list">
            {team.players.map((player) => (
              <li key={player.id}>
                <button
                  type="button"
                  className={`roster__player${player.id === selectedPlayerId ? ' is-selected' : ''}`}
                  style={
                    player.id === selectedPlayerId
                      ? ({ color: 'var(--team-ink)' } as CSSProperties)
                      : undefined
                  }
                  onClick={() => selectPlayer(player.id)}
                  aria-pressed={player.id === selectedPlayerId}
                >
                  {player.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
