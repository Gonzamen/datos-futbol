import { findPlayer } from '@datos-futbol/domain'
import { notFound } from '../errors.js'
import type { Dependencies } from '../dependencies.js'
import { assertCanWrite } from '../matches/assertMembership.js'

/**
 * Renames the player's entry in this match and, along with it, the person's
 * name in the shared registry — the same rule the offline app follows: a
 * player's display name and the person behind it are edited together.
 */
export async function renamePlayer(
  deps: Pick<Dependencies, 'matches' | 'memberships' | 'people'>,
  userId: string,
  matchId: string,
  playerId: string,
  name: string,
): Promise<void> {
  await assertCanWrite(deps, matchId, userId)

  const clean = name.trim()
  if (!clean) {
    return
  }

  const match = await deps.matches.findById(matchId)
  const located = match ? findPlayer(match, playerId) : null

  if (!located) {
    throw notFound('Ese jugador no está en este partido.')
  }

  await Promise.all([
    deps.matches.renamePlayer(matchId, playerId, clean),
    deps.people.rename(located.player.personId, clean),
  ])
}
