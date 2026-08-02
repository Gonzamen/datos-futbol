import { formatScore } from '@datos-futbol/domain'
import { useEffect } from 'react'
import { useSeasonStore } from '../../shared/store/seasonStore.js'
import { IconChevronLeft, IconChart } from '../../shared/ui/icons.js'

interface SeasonViewProps {
  onBack(): void
  onOpenMatch(matchId: string): void
}

/**
 * Standalone screen for stats accumulated across every match the user
 * belongs to, keyed by person rather than by any single match's roster — same
 * top-level placement as RosterView, reached from the top bar instead of from
 * inside an open match.
 */
export function SeasonView({ onBack, onOpenMatch }: SeasonViewProps) {
  const season = useSeasonStore((state) => state.season)
  const loading = useSeasonStore((state) => state.loading)
  const error = useSeasonStore((state) => state.error)
  const load = useSeasonStore((state) => state.load)

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="match-list">
      <div className="people__header">
        <h1 className="match-list__title">Temporada</h1>
        <button type="button" className="btn btn--ghost btn--small" onClick={onBack}>
          <IconChevronLeft />
          Mis partidos
        </button>
      </div>

      <p className="panel__hint">
        Estadísticas acumuladas de todos los partidos en los que participaste, sumadas por
        persona aunque cada partido arme los equipos de nuevo.
      </p>

      {error ? <p className="video-error">{error}</p> : null}

      {loading && !season ? (
        <p className="panel__hint">Cargando…</p>
      ) : !season || season.matchesPlayed === 0 ? (
        <div className="empty">
          <IconChart />
          <span className="empty__title">Todavía no hay partidos</span>
          <p>En cuanto cargues estadísticas en algún partido, acá se va a armar la tabla.</p>
        </div>
      ) : (
        <div className="summary-grid">
          <section className="panel panel--wide">
            <h2 className="panel__title">Ranking de temporada</h2>
            {season.ranking.length ? (
              <div className="table-scroll">
                <table className="grid grid--ranking">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Jugador</th>
                      <th>Partidos</th>
                      <th>Puntaje</th>
                      <th>Puntaje Prom.</th>
                      <th>G</th>
                      <th>A</th>
                      <th>G+A</th>
                      <th>Defensivas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {season.ranking.map((player) => (
                      <tr key={player.personId}>
                        <td className="grid__rank">{player.position}</td>
                        <th>{player.name}</th>
                        <td>{player.matchesPlayed}</td>
                        <td className="grid__score">{formatScore(player.score)}</td>
                        <td>{formatScore(player.averageScore)}</td>
                        <td>{player.totals.goles}</td>
                        <td>{player.totals.asistencias}</td>
                        <td>{player.totals.goles + player.totals.asistencias}</td>
                        <td>
                          {player.totals.intercepciones +
                            player.totals.robosDePelota +
                            player.totals.golesEvitados +
                            player.totals.atajadas}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="panel__hint">Nadie cargó estadísticas todavía.</p>
            )}
          </section>

          <section className="panel">
            <h2 className="panel__title">Mejores actuaciones</h2>
            <ul className="highlights">
              {season.records.map((record) => (
                <li key={record.label}>
                  <span className="highlights__label">{record.label}</span>
                  {record.entry ? (
                    <>
                      <button
                        type="button"
                        className="highlights__winner link-button"
                        onClick={() => onOpenMatch(record.entry!.matchId)}
                        title={`Ver ${record.entry.matchName}`}
                      >
                        {record.entry.name}
                      </button>
                      <span className="highlights__value">{record.entry.value}</span>
                    </>
                  ) : (
                    <span className="highlights__winner">—</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
