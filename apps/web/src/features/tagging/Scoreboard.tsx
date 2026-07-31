import type { CSSProperties } from 'react'
import { useReport } from '../../shared/hooks/useReport.js'
import type { MatchReport } from '@datos-futbol/domain'

type TeamReport = MatchReport['teams'][number]

/**
 * A broadcast scoreline rather than two cards: both totals on one baseline is
 * what makes the result readable at a glance from across the room, which is
 * how it actually gets looked at while the video plays.
 */
export function Scoreboard() {
  const { report } = useReport()
  const [home, away] = report.teams

  if (!home || !away) {
    return null
  }

  return (
    <div className="scoreboard">
      <TeamSide team={home} align="home" />

      <div className="scoreboard__score">
        <span>{home.totals.goles}</span>
        <span className="scoreboard__dash" />
        <span>{away.totals.goles}</span>
      </div>

      <TeamSide team={away} align="away" />
    </div>
  )
}

function TeamSide({ team, align }: { team: TeamReport; align: 'home' | 'away' }) {
  return (
    <div
      className={`scoreboard__side scoreboard__side--${align} team`}
      style={{ '--team': team.color } as CSSProperties}
    >
      <span className="scoreboard__name" style={{ color: 'var(--team-ink)' }}>
        {align === 'away' ? <span className="scoreboard__chip" /> : null}
        {team.name}
        {align === 'home' ? <span className="scoreboard__chip" /> : null}
      </span>
      <span className="scoreboard__detail">
        {team.totals.disparos} remates · {team.metrics.accionesDefensivas} defensivas
      </span>
    </div>
  )
}
