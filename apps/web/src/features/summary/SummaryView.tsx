import { formatPercent, formatScore } from '@datos-futbol/domain'
import type { CSSProperties } from 'react'
import { useReport } from '../../shared/hooks/useReport.js'

const RANKING_SIZE = 14

export function SummaryView() {
  const { report, analysis } = useReport()

  return (
    <div className="summary-grid">
      <section className="panel panel--wide">
        <h2 className="panel__title">Ranking</h2>
        {report.ranking.length ? (
          <div className="table-scroll">
            <table className="grid grid--ranking">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jugador</th>
                  <th>Puntaje</th>
                  <th>G</th>
                  <th>A</th>
                  <th>G+A</th>
                  <th>% Pases</th>
                  <th>% Al arco</th>
                  <th>% Regate</th>
                  <th>Defensivas</th>
                </tr>
              </thead>
              <tbody>
                {report.ranking.slice(0, RANKING_SIZE).map((player) => (
                  <tr
                    key={player.id}
                    className="team"
                    style={{ '--team': player.color } as CSSProperties}
                  >
                    <td className="grid__rank">{player.position}</td>
                    <th style={{ color: 'var(--team-ink)' }}>{player.name}</th>
                    <td className="grid__score">{formatScore(player.score)}</td>
                    <td>{player.totals.goles}</td>
                    <td>{player.totals.asistencias}</td>
                    <td>{player.metrics.participacionesEnGol}</td>
                    <td>{formatPercent(player.metrics.efectividadPases)}</td>
                    <td>{formatPercent(player.metrics.precisionDisparos)}</td>
                    <td>{formatPercent(player.metrics.efectividadRegate)}</td>
                    <td>{player.metrics.accionesDefensivas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="panel__hint">Cargá algunas estadísticas para ver el ranking.</p>
        )}
      </section>

      <section className="panel">
        <h2 className="panel__title">Análisis del partido</h2>
        <dl className="readings">
          {analysis.map((reading) => (
            <div className="reading" key={reading.label}>
              <dt>{reading.label}</dt>
              <dd>{reading.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="panel">
        <h2 className="panel__title">Comparativa</h2>
        <ul className="highlights">
          {report.highlights.map((highlight) => (
            <li key={highlight.label}>
              <span className="highlights__label">{highlight.label}</span>
              <span
                className="highlights__winner"
                style={{ color: highlight.winnerColor ?? undefined }}
              >
                {highlight.winnerName}
              </span>
              <span className="highlights__value">
                {highlight.format === 'percent' ? formatPercent(highlight.value) : highlight.value}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2 className="panel__title">Líderes individuales</h2>
        <ul className="leaders">
          {report.leaders.map((leader) => (
            <li key={leader.label}>
              <span className="leaders__label">{leader.label}</span>
              <span className="leaders__name" style={{ color: leader.color ?? undefined }}>
                {leader.names}
              </span>
              <span className="leaders__value">{leader.value}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
