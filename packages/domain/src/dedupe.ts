import type { StatId } from './stats.js'
import type { MatchEvent } from './types.js'

/**
 * How close two counts of the same statistic, for the same player, have to be
 * in the video before they are worth a second look.
 *
 * Rare, high-stakes actions (goals, saves, blunders) get a wide window: two of
 * them seconds apart are almost certainly the same play seen by two taggers.
 * Frequent ones (passes, dribbles, interceptions) get none at all — a player
 * can complete three passes in five seconds, so flagging that would just be
 * noise nobody would act on. See PLAN.md §4.2.
 */
export const DEDUPE_WINDOW_MS: Partial<Record<StatId, number>> = {
  goles: 15_000,
  asistencias: 15_000,
  golesEvitados: 15_000,
  atajadas: 15_000,
  burradas: 15_000,
  disparosAlArco: 5_000,
  disparosErrados: 5_000,
  faltas: 5_000,
}

export interface DuplicateCandidate {
  playerId: string
  statId: StatId
  videoMs: number | null
}

/**
 * Looks for an already-counted event close enough in the video to plausibly be
 * the same play. Never blocks the new event from being recorded — see the
 * plan's rationale: a real repeat (two goals seconds apart) is rare but
 * possible, so this only flags for a human to confirm, it never rejects.
 *
 * @returns The event it might duplicate, or null when there is no window for
 *   this statistic, no video position to compare, or nothing nearby.
 */
export function findPossibleDuplicate(
  activeEvents: MatchEvent[],
  candidate: DuplicateCandidate,
): MatchEvent | null {
  const window = DEDUPE_WINDOW_MS[candidate.statId]

  if (!window || candidate.videoMs === null) {
    return null
  }

  let closest: MatchEvent | null = null
  let closestDistance = Infinity

  for (const event of activeEvents) {
    if (
      event.playerId !== candidate.playerId ||
      event.statId !== candidate.statId ||
      event.videoMs === null
    ) {
      continue
    }

    const distance = Math.abs(event.videoMs - candidate.videoMs)

    if (distance <= window && distance < closestDistance) {
      closest = event
      closestDistance = distance
    }
  }

  return closest
}
