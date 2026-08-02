import { buildSeasonReport } from '@datos-futbol/domain'
import type { Match, SeasonReport } from '@datos-futbol/domain'
import type { Dependencies } from '../dependencies.js'

/**
 * Season stats are computed on read, not stored: load every match the user
 * belongs to (same membership-then-load shape as listMyMatches) and fold them
 * with the domain's buildSeasonReport. Full aggregates are needed, not just
 * meta, since the report reads each match's roster and event log.
 */
export async function getSeasonStats(
  deps: Pick<Dependencies, 'memberships' | 'matches'>,
  userId: string,
): Promise<SeasonReport> {
  const memberships = await deps.memberships.listForUser(userId)

  if (!memberships.length) {
    return buildSeasonReport([])
  }

  const matches = await Promise.all(
    memberships.map((membership) => deps.matches.findById(membership.matchId)),
  )

  return buildSeasonReport(matches.filter((match): match is Match => match !== null))
}
