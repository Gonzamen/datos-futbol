import type { StatId } from '@datos-futbol/domain'
import type { SVGProps } from 'react'

/**
 * One hand-drawn set instead of emoji or a general-purpose icon library: no
 * library has a mark for "gol evitado", "burrada" or "regate", and mixing a
 * library's stroke with custom football glyphs reads as two sets stapled
 * together.
 *
 * Shared grammar, so the sixteen stats scan as one family at 20px:
 *   · 24×24 grid, 1.75 stroke, round caps and joins, no fill except the ball
 *   · the ball is always a filled disc — it is the only solid shape
 *   · movement is an arc, obstruction is a straight bar, failure is a cross
 *   · everything inherits `currentColor`, so tone is set by CSS
 */

const BASE: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
}

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'children'>

function icon(paths: React.ReactNode) {
  return function Icon(props: IconProps) {
    return (
      <svg {...BASE} {...props}>
        {paths}
      </svg>
    )
  }
}

/* Stats — the sixteen counted actions. */

/** Ball leaving on an arc that lands on its target. */
const PassCompleted = icon(
  <>
    <circle cx="5" cy="18" r="2.5" fill="currentColor" stroke="none" />
    <path d="M7.4 16.9C11 12.6 14.4 9.9 18.2 8.6" />
    <path d="M14.9 7.6 18.8 8.4 17.9 12.3" />
  </>,
)

/** The same arc, cut short and crossed out. */
const PassFailed = icon(
  <>
    <circle cx="5" cy="18" r="2.5" fill="currentColor" stroke="none" />
    <path d="M7.4 16.9C9.8 14.1 11.9 12 14 10.6" strokeDasharray="3 2.6" />
    <path d="M16.4 6.4 21 11M21 6.4 16.4 11" />
  </>,
)

/** Aimed and on frame: the ball sits dead centre of the target. */
const ShotOnTarget = icon(
  <>
    <circle cx="12" cy="12" r="7.6" />
    <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
    <path d="M12 1.6v2.6M12 19.8v2.6M1.6 12h2.6M19.8 12h2.6" />
  </>,
)

/** Same target, but the ball sails wide over the top. */
const ShotMissed = icon(
  <>
    <circle cx="10" cy="15" r="6.2" />
    <path d="M3.6 18.6C6.6 7.6 13.4 2.9 21.2 4.6" />
    <path d="M17.9 3.1 21.6 4.5 20.4 8.3" />
  </>,
)

/** Ball inside the frame, net implied by the two inner verticals. */
const Goal = icon(
  <>
    <path d="M3.4 20V6.4h17.2V20" />
    <path d="M8.4 6.4V20M15.6 6.4V20M3.4 13.2h17.2" opacity="0.45" />
    <circle cx="12" cy="16.4" r="3" fill="currentColor" stroke="none" />
  </>,
)

/** One ball feeds another, and the second one bursts. */
const Assist = icon(
  <>
    <circle cx="4.8" cy="17.2" r="2.4" fill="currentColor" stroke="none" />
    <path d="M7.1 16.1C10 12.4 12.6 10 15.2 8.7" />
    <circle cx="17.6" cy="7.6" r="2.4" fill="currentColor" stroke="none" />
    <path d="M17.6 2.6v1.6M21.8 4.4 20.7 5.5M22.4 9.4h-1.7" />
  </>,
)

/** A pass in flight, stopped dead by a body across its line. */
const Interception = icon(
  <>
    <circle cx="3.8" cy="12" r="2.3" fill="currentColor" stroke="none" />
    <path d="M6.8 12h5.4" strokeDasharray="2.8 2.4" />
    <path d="M15.4 5.2v13.6" strokeWidth="2.4" />
    <path d="M19.2 8.6 22 12l-2.8 3.4" opacity="0.45" />
  </>,
)

/** The ball, and the challenge sweeping in underneath it. */
const Tackle = icon(
  <>
    <circle cx="15.2" cy="8.8" r="3" fill="currentColor" stroke="none" />
    <path d="M2.8 20.4C6.2 20.6 9.2 19.2 11.4 16.2" />
    <path d="M8.6 15.6 11.8 15.6 11.9 18.8" />
    <path d="M18.6 15.4C19.9 16.6 21 17.9 21.8 19.4" opacity="0.45" />
  </>,
)

/** A weave that gets through, past two standing defenders. */
const DribbleWon = icon(
  <>
    <path d="M4.4 20.6C8.4 17.4 6.4 13.6 9.4 11.2C12.2 9 13.4 7 18 5.4" />
    <path d="M14.9 4.2 18.8 5.2 17.9 9.1" />
    <circle cx="12.4" cy="17.4" r="1.5" fill="currentColor" stroke="none" opacity="0.45" />
    <circle cx="15.6" cy="11.2" r="1.5" fill="currentColor" stroke="none" opacity="0.45" />
  </>,
)

/** The same weave, walled off before it gets anywhere. */
const DribbleLost = icon(
  <>
    <path d="M4 20.4C7.6 17.4 5.8 13.8 8.6 11.4" />
    <path d="M13.4 5.4v13.2" strokeWidth="2.4" />
    <path d="M17.4 8.6 20.8 12l-3.4 3.4" opacity="0.45" />
    <circle cx="10.6" cy="9.4" r="1.5" fill="currentColor" stroke="none" opacity="0.45" />
  </>,
)

/** Cleared off the line: the ball never reaches the goal behind the block. */
const GoalPrevented = icon(
  <>
    <path d="M20.6 3.8v16.4" strokeWidth="2.4" />
    <path d="M14.4 6.4v11.2" />
    <circle cx="7" cy="12" r="3.2" fill="currentColor" stroke="none" />
    <path d="M2.6 7.6 4.4 9.2M2.6 16.4 4.4 14.8" opacity="0.45" />
  </>,
)

/** Glove up, ball held. */
const Save = icon(
  <>
    <path d="M6.6 21V12.4c0-1.5 2-1.5 2 0V8.2c0-1.5 2-1.5 2 0v-1c0-1.5 2-1.5 2 0v2.2c0-1.5 2-1.5 2 0V15c0 3.6-1.8 6-4.2 6z" />
    <circle cx="18.6" cy="6.2" r="2.7" fill="currentColor" stroke="none" />
  </>,
)

/** Ball, and the bolt of everything going wrong with it. */
const Blunder = icon(
  <>
    <circle cx="10" cy="13.6" r="6.6" />
    <path d="M11.6 8.2 8.2 13.8h3.6L8.6 19.2" />
    <path d="M19.6 3.4v6.2" strokeWidth="2.2" />
    <circle cx="19.6" cy="13.2" r="1.2" fill="currentColor" stroke="none" />
  </>,
)

/** The card. Nothing else needs to be said. */
const Foul = icon(
  <path d="M9.6 2.8 18.4 5.2C19.3 5.5 19.8 6.4 19.6 7.3L16.4 20.4C16.1 21.3 15.2 21.8 14.4 21.6L5.6 19.2C4.7 18.9 4.2 18 4.4 17.1L7.6 4C7.9 3.1 8.8 2.6 9.6 2.8Z" />,
)

/** The ball sent away in a long arc, straight out of defence. */
const Clearance = icon(
  <>
    <circle cx="4.4" cy="19.4" r="2.4" fill="currentColor" stroke="none" />
    <path d="M6.6 18C10.6 12.4 14.6 8.2 20.6 5.4" />
    <path d="M13.6 4.6 20.8 4.8 20 12" opacity="0.45" />
  </>,
)

/** The ball, touched heavy and skidding away underfoot. */
const MiscontrolIcon = icon(
  <>
    <circle cx="9" cy="14.4" r="3.2" fill="currentColor" stroke="none" />
    <path d="M11.6 12.4C14.4 10.6 16.4 10 19.4 10.2" strokeDasharray="3 2.6" />
    <path d="M17.4 18.2 21 18.2M17.4 21.4 21 21.4" opacity="0.45" />
  </>,
)

/**
 * Every counted stat has a mark. Keyed by `StatId` so adding a statistic to
 * the domain fails to compile here until it gets one, instead of silently
 * rendering a blank square.
 */
export const STAT_ICONS: Record<StatId, (props: IconProps) => React.ReactElement> = {
  pasesCompletados: PassCompleted,
  pasesErrados: PassFailed,
  disparosAlArco: ShotOnTarget,
  disparosErrados: ShotMissed,
  goles: Goal,
  asistencias: Assist,
  intercepciones: Interception,
  robosDePelota: Tackle,
  regatesExitosos: DribbleWon,
  regatesFallidos: DribbleLost,
  golesEvitados: GoalPrevented,
  atajadas: Save,
  burradas: Blunder,
  faltas: Foul,
  despejes: Clearance,
  controlesFallidos: MiscontrolIcon,
}

/* Interface — same grammar, used for controls rather than actions. */

export const IconUndo = icon(
  <>
    <path d="M3.2 12a8.8 8.8 0 1 0 8.8-8.8 9.5 9.5 0 0 0-6.6 2.7L3.2 8.4" />
    <path d="M3.2 3.4v5h5" />
  </>,
)

export const IconClose = icon(<path d="M5.4 5.4 18.6 18.6M18.6 5.4 5.4 18.6" />)

export const IconPlus = icon(<path d="M12 5v14M5 12h14" />)

export const IconMinus = icon(<path d="M5 12h14" />)

export const IconCheck = icon(<path d="M4.4 12.6 9.6 17.8 19.6 6.6" />)

export const IconChevronLeft = icon(<path d="M15 4.8 7.8 12l7.2 7.2" />)

export const IconPlay = icon(<path d="M7.4 4.6 19 12 7.4 19.4Z" />)

export const IconPause = icon(<path d="M8.6 4.8v14.4M15.4 4.8v14.4" />)

export const IconUsers = icon(
  <>
    <circle cx="9.4" cy="8" r="3.6" />
    <path d="M2.8 20.2c0-3.6 2.9-6.2 6.6-6.2s6.6 2.6 6.6 6.2" />
    <path d="M16.6 4.8a3.6 3.6 0 0 1 0 6.9M18.4 14.6c1.8.9 2.8 2.6 2.8 4.6" opacity="0.5" />
  </>,
)

export const IconGrid = icon(
  <>
    <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="2.4" />
    <path d="M3.2 9.4h17.6M3.2 14.8h17.6M9.4 9.4v11.4" />
  </>,
)

export const IconTrophy = icon(
  <>
    <path d="M7 3.6h10v5.2a5 5 0 0 1-10 0Z" />
    <path d="M7 5.4H4.2v1.8a3 3 0 0 0 3 3M17 5.4h2.8v1.8a3 3 0 0 1-3 3" />
    <path d="M12 13.8v3.4M8.4 20.4h7.2" />
  </>,
)

export const IconClapper = icon(
  <>
    <rect x="2.8" y="7.4" width="18.4" height="13.2" rx="2.2" />
    <path d="M2.8 11.6h18.4" />
    <path d="M6.4 7.4 5 3.6l3.6-.6.9 3.4M12.4 7.4 11.4 3.6l3.6-.6.9 3.4" opacity="0.5" />
  </>,
)

export const IconLogout = icon(
  <>
    <path d="M9.4 20.6H5.2a2 2 0 0 1-2-2V5.4a2 2 0 0 1 2-2h4.2" />
    <path d="M15.6 16.4 20 12l-4.4-4.4M20 12H9.4" />
  </>,
)

export const IconTrash = icon(
  <>
    <path d="M3.8 6.4h16.4M9 6.4V4.6a1.6 1.6 0 0 1 1.6-1.6h2.8A1.6 1.6 0 0 1 15 4.6v1.8" />
    <path d="M5.8 6.4 6.9 19.6a1.8 1.8 0 0 0 1.8 1.6h6.6a1.8 1.8 0 0 0 1.8-1.6L18.2 6.4" />
  </>,
)

export const IconChart = icon(
  <>
    <path d="M3.4 20.6V3.4M3.4 20.6h17.2" />
    <path d="M7.4 20.6v-6.4M12 20.6V9.4M16.6 20.6V6" />
  </>,
)

export const IconLive = icon(
  <>
    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    <path d="M6.6 6.6a7.6 7.6 0 0 0 0 10.8M17.4 17.4a7.6 7.6 0 0 0 0-10.8" opacity="0.6" />
  </>,
)
