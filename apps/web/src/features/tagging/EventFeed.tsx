import { activeEvents, findPlayer, findStat, statLabel } from '@datos-futbol/domain'
import type { CSSProperties } from 'react'
import { useMatchStore } from '../../shared/store/matchStore.js'
import { IconClose, STAT_ICONS } from '../../shared/ui/icons.js'
import { useVideo } from '../../shared/video/VideoContext.js'
import { formatVideoTime } from '../../shared/video/VideoSource.js'

const VISIBLE_EVENTS = 25

/**
 * The last actions counted, newest first. Each one links back to the moment in
 * the video it came from: that is what makes a disputed call checkable instead
 * of an argument.
 */
export function EventFeed() {
  const match = useMatchStore((state) => state.match!)
  const deleteEvent = useMatchStore((state) => state.deleteEvent)
  const duplicateFlags = useMatchStore((state) => state.duplicateFlags)
  const { source } = useVideo()

  const recent = activeEvents(match).slice(-VISIBLE_EVENTS).reverse()

  if (!recent.length) {
    return (
      <div className="empty">
        <span className="empty__title">Nada cargado</span>
        <p>Elegí un jugador y tocá lo que pasó. Cada acción queda anclada al video.</p>
      </div>
    )
  }

  return (
    <ul className="feed">
      {recent.map((event) => {
        const located = findPlayer(match, event.playerId)
        const duplicateOf = duplicateFlags[event.id]
        const stat = findStat(event.statId)
        const Icon = stat ? STAT_ICONS[stat.id] : null

        return (
          <li
            className="feed__item team"
            key={event.id}
            style={{ '--team': located?.team.color ?? 'var(--text-3)' } as CSSProperties}
          >
            <div className="feed__row">
              {event.videoMs === null ? (
                <span className="feed__time feed__time--unknown">—</span>
              ) : (
                <button
                  type="button"
                  className="feed__time"
                  onClick={() => source?.seekTo(event.videoMs ?? 0)}
                  disabled={!source}
                  title="Ver la jugada"
                >
                  {formatVideoTime(event.videoMs)}
                </button>
              )}

              {Icon ? (
                <Icon
                  className="feed__icon"
                  style={{ '--tone': `var(--${stat!.tone})` } as CSSProperties}
                />
              ) : null}

              <span className="feed__player" style={{ color: 'var(--team-ink)' }}>
                {located?.player.name ?? 'Jugador borrado'}
              </span>
              <span className="feed__stat">
                {event.delta < 0 ? 'corrección: ' : ''}
                {statLabel(event.statId)}
              </span>

              <button
                type="button"
                className="feed__remove"
                onClick={() => deleteEvent(event.id)}
                aria-label={`Borrar ${statLabel(event.statId)}`}
              >
                <IconClose />
              </button>
            </div>

            {duplicateOf ? (
              <div className="feed__duplicate">
                <span>¿Es la misma jugada que otra ya cargada?</span>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() =>
                    source?.seekTo(match.events.find((e) => e.id === duplicateOf)?.videoMs ?? 0)
                  }
                  disabled={!source}
                >
                  Ver la otra
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => deleteEvent(event.id)}
                >
                  Sí, borrar esta
                </button>
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
