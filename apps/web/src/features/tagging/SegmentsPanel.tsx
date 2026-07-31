import { useState } from 'react'
import { useMatchStore } from '../../shared/store/matchStore.js'
import type { Segment } from '../../shared/api/segments.js'
import { useVideo } from '../../shared/video/VideoContext.js'

/**
 * Who is covering which stretch of the video. Segments are a coordination
 * aid, not a container: an event belongs to whatever segment its timecode
 * falls in, so regenerating this list never touches events already counted.
 */
export function SegmentsPanel() {
  const segments = useMatchStore((state) => state.segments)
  const currentUserId = useMatchStore((state) => state.currentUserId)
  const presence = useMatchStore((state) => state.presence)
  const generateSegments = useMatchStore((state) => state.generateSegments)
  const claimSegment = useMatchStore((state) => state.claimSegment)
  const completeSegment = useMatchStore((state) => state.completeSegment)
  const releaseSegment = useMatchStore((state) => state.releaseSegment)
  const { source } = useVideo()
  const [count, setCount] = useState(3)

  function assigneeLabel(segment: Segment): string {
    if (!segment.assigneeUserId) return 'Libre'
    if (segment.assigneeUserId === currentUserId) return 'Vos'
    return presence[segment.assigneeUserId]?.name ?? 'Otra persona'
  }

  const done = segments.filter((segment) => segment.status === 'done').length

  return (
    <div className="segments">
      {segments.length ? (
        <>
          <div className="segments__bar" aria-hidden>
            {segments.map((segment) => (
              <span
                key={segment.id}
                className={`segments__bar-part segments__bar-part--${segment.status}`}
              />
            ))}
          </div>
          <p className="panel__hint">
            {done} de {segments.length} tramos completos
            {done < segments.length ? ' — el ranking todavía es parcial.' : '.'}
          </p>
          <ul className="segments__list">
            {segments.map((segment) => (
              <li className={`segments__item segments__item--${segment.status}`} key={segment.id}>
                <button
                  type="button"
                  className="segments__label"
                  onClick={() => source?.seekTo(segment.startMs)}
                  disabled={!source}
                >
                  {segment.label}
                </button>
                <span
                  className={`segments__assignee${
                    segment.assigneeUserId === currentUserId ? ' segments__assignee--you' : ''
                  }`}
                >
                  {assigneeLabel(segment)}
                </span>
                {segment.status !== 'done' && segment.assigneeUserId !== currentUserId ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => claimSegment(segment.id)}
                    disabled={segment.status === 'in_progress' && Boolean(segment.assigneeUserId)}
                  >
                    Agarrar
                  </button>
                ) : null}
                {segment.assigneeUserId === currentUserId && segment.status !== 'done' ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => completeSegment(segment.id)}
                  >
                    Completar
                  </button>
                ) : null}
                {segment.assigneeUserId === currentUserId ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => releaseSegment(segment.id)}
                  >
                    Soltar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="panel__hint">
          Todavía no hay tramos. Repartí el video entre quienes carguen.
        </p>
      )}

      <form
        className="segments__generate"
        onSubmit={(event) => {
          event.preventDefault()
          const durationMs = source?.getDurationMs()
          if (durationMs) {
            void generateSegments(durationMs, count)
          }
        }}
      >
        <input
          type="number"
          min={1}
          max={20}
          value={count}
          onChange={(event) => setCount(Number(event.target.value) || 1)}
          aria-label="Cantidad de tramos"
        />
        <button type="submit" className="btn btn--small" disabled={!source}>
          {segments.length ? 'Repartir de nuevo' : 'Repartir en tramos'}
        </button>
      </form>
    </div>
  )
}
