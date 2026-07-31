import type { Match } from '@datos-futbol/domain'
import { notFound } from '../errors.js'
import type { Dependencies } from '../dependencies.js'

/**
 * Anybody with the code becomes a `tagger`: able to count and correct, not
 * able to remove the match or promote others. That is deliberately the
 * highest a link alone should grant — ownership stays with whoever created
 * the match.
 */
export async function joinMatchByCode(
  deps: Pick<Dependencies, 'matches' | 'memberships' | 'ids'>,
  userId: string,
  inviteCode: string,
): Promise<Match> {
  const match = await deps.matches.findByInviteCode(inviteCode.trim().toUpperCase())

  if (!match) {
    throw notFound('No encontramos ningún partido con ese código.')
  }

  const existing = await deps.memberships.find(match.id, userId)

  if (!existing) {
    await deps.memberships.add({
      matchId: match.id,
      userId,
      role: 'tagger',
      joinedAt: deps.ids.now(),
    })
  }

  return match
}
