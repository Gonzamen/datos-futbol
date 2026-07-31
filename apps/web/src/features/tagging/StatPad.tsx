import { STAT_DEFINITIONS, findPlayer } from '@datos-futbol/domain'
import type { StatDefinition, StatTone } from '@datos-futbol/domain'
import { useMatchStore } from '../../shared/store/matchStore.js'
import { IconUndo, STAT_ICONS } from '../../shared/ui/icons.js'
import { useCurrentMsReader, useVideo, useVideoTime } from '../../shared/video/VideoContext.js'
import { formatVideoTime } from '../../shared/video/VideoSource.js'

/**
 * Fourteen buttons in one undifferentiated grid is slow to scan with a video
 * running, so they are grouped by what the action means. The grouping falls
 * out of each statistic's own tone rather than a list repeated here: a new
 * stat lands in the right group by declaring what kind of thing it is.
 */
const GROUPS: Array<{ tone: StatTone; title: string }> = [
  { tone: 'highlight', title: 'Decisivas' },
  { tone: 'positive', title: 'Juego' },
  { tone: 'negative', title: 'Errores' },
]

export function StatPad() {
  const match = useMatchStore((state) => state.match!)
  const selectedPlayerId = useMatchStore((state) => state.selectedPlayerId)
  const { source } = useVideo()

  const selected = selectedPlayerId ? findPlayer(match, selectedPlayerId) : null

  return (
    <>
      <p className="panel__hint">
        {selected ? (
          <>
            Sumando a{' '}
            <strong
              className="team"
              style={
                { '--team': selected.team.color, color: 'var(--team-ink)' } as React.CSSProperties
              }
            >
              {selected.player.name}
            </strong>
            {source
              ? ' en el minuto que está el video.'
              : '. Cargá el video para anclar cada acción.'}
          </>
        ) : (
          'Elegí un jugador para empezar a cargar.'
        )}
      </p>

      <div className="stat-pad">
        {GROUPS.map((group) => (
          <section key={group.tone}>
            <h3 className="stat-group__title">{group.title}</h3>
            <div className="stat-group__grid">
              {STAT_DEFINITIONS.filter((stat) => stat.tone === group.tone).map((stat) => (
                <StatButton key={stat.id} stat={stat} disabled={!selected} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="stat-pad__footer">
        <UndoButton />
        <CurrentPosition />
      </div>
    </>
  )
}

function StatButton({ stat, disabled }: { stat: StatDefinition; disabled: boolean }) {
  const selectedPlayerId = useMatchStore((state) => state.selectedPlayerId)
  const count = useMatchStore((state) => state.count)
  const readCurrentMs = useCurrentMsReader()
  const Icon = STAT_ICONS[stat.id]

  return (
    <button
      type="button"
      className={`stat-button stat-button--${stat.tone}`}
      disabled={disabled}
      title={stat.label}
      onClick={() => {
        if (selectedPlayerId) {
          count(selectedPlayerId, stat.id, 1, readCurrentMs())
        }
      }}
    >
      <Icon className="stat-button__icon" />
      <span className="stat-button__label">{stat.short}</span>
      <kbd className="stat-button__key">{stat.key}</kbd>
    </button>
  )
}

function UndoButton() {
  const undo = useMatchStore((state) => state.undo)

  return (
    <button type="button" className="btn btn--ghost btn--small" onClick={undo}>
      <IconUndo />
      Deshacer último
    </button>
  )
}

function CurrentPosition() {
  const { source } = useVideo()
  const currentMs = useVideoTime()

  if (!source) {
    return <span className="stat-pad__position">Sin video cargado</span>
  }

  return (
    <span className="stat-pad__position">
      Se ancla en <strong>{formatVideoTime(currentMs)}</strong>
    </span>
  )
}
