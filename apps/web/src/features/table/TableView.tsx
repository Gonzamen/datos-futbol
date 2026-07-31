import { STAT_DEFINITIONS } from '@datos-futbol/domain'
import type { CSSProperties } from 'react'
import { useReport } from '../../shared/hooks/useReport.js'
import { useMatchStore } from '../../shared/store/matchStore.js'
import { IconMinus, IconPlus, STAT_ICONS } from '../../shared/ui/icons.js'
import { useCurrentMsReader } from '../../shared/video/VideoContext.js'

/**
 * The full spreadsheet, same shape as the Excel it replaced, with a minus and a
 * plus on every cell so a wrong count is fixed where it is seen.
 *
 * Most of a match's grid is zeros. They are dimmed rather than hidden so the
 * non-zero cells form a readable shape instead of a wall of identical digits.
 */
export function TableView() {
  const match = useMatchStore((state) => state.match!)
  const count = useMatchStore((state) => state.count)
  const readCurrentMs = useCurrentMsReader()
  const { report } = useReport()

  const hasPlayers = match.teams.some((team) => team.players.length > 0)

  if (!hasPlayers) {
    return (
      <div className="panel">
        <h2 className="panel__title">Planilla completa</h2>
        <p className="panel__hint">
          Cargá los jugadores en la pestaña <strong>Equipos</strong> y acá vas a ver la planilla.
        </p>
      </div>
    )
  }

  return (
    <div className="panel">
      <h2 className="panel__title">Planilla completa</h2>
      <p className="panel__hint">Igual que el Excel, pero cada celda se corrige con un toque.</p>

      <div className="table-scroll">
        <table className="grid">
          <thead>
            <tr>
              <th className="grid__sticky">Jugador</th>
              {STAT_DEFINITIONS.map((stat) => {
                const Icon = STAT_ICONS[stat.id]

                return (
                  <th key={stat.id} title={stat.label}>
                    <Icon
                      className="grid__head-icon"
                      style={{ '--tone': `var(--${stat.tone})` } as CSSProperties}
                    />
                    {stat.short}
                  </th>
                )
              })}
              <th>Disparos</th>
            </tr>
          </thead>
          {match.teams.map((team) => (
            <tbody key={team.id}>
              <tr className="grid__team-row team" style={{ '--team': team.color } as CSSProperties}>
                <th className="grid__sticky" colSpan={STAT_DEFINITIONS.length + 2}>
                  <span style={{ color: 'var(--team-ink)' }}>
                    <span className="team-dot" />
                    {team.name}
                  </span>
                </th>
              </tr>
              {team.players.map((player) => {
                const totals = report.playerTotals[player.id]

                return (
                  <tr key={player.id}>
                    <th className="grid__sticky">{player.name}</th>
                    {STAT_DEFINITIONS.map((stat) => {
                      const value = totals?.[stat.id] ?? 0

                      return (
                        <td key={stat.id}>
                          <div className="cell">
                            <button
                              type="button"
                              className="cell__step"
                              onClick={() => count(player.id, stat.id, -1, readCurrentMs())}
                              aria-label={`Restar ${stat.label} a ${player.name}`}
                            >
                              <IconMinus />
                            </button>
                            <span
                              className={`cell__value${value === 0 ? ' cell__value--zero' : ''}`}
                            >
                              {value}
                            </span>
                            <button
                              type="button"
                              className="cell__step"
                              onClick={() => count(player.id, stat.id, 1, readCurrentMs())}
                              aria-label={`Sumar ${stat.label} a ${player.name}`}
                            >
                              <IconPlus />
                            </button>
                          </div>
                        </td>
                      )
                    })}
                    <td className="cell__derived">{totals?.disparos ?? 0}</td>
                  </tr>
                )
              })}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  )
}
