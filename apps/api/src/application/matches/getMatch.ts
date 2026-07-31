import type { Match } from '@datos-futbol/domain'
import { forbidden, notFound } from '../errors.js'
import type { Dependencies } from '../dependencies.js'

/**
 * Loading a match always checks membership first. There is no "public read"
 * mode: match data includes players' names tied to real people, and the group
 * decides who counts as "in the match", not the URL.
 */
export async function getMatch(
  deps: Pick<Dependencies, 'matches' | 'memberships'>,
  userId: string,
  matchId: string,
): Promise<Match> {
  const membership = await deps.memberships.find(matchId, userId)

  if (!membership) {
    throw forbidden('No sos parte de este partido.')
  }

  const match = await deps.matches.findById(matchId)

  if (!match) {
    throw notFound('El partido no existe.')
  }

  return match
}
