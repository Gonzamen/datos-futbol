import type { Dependencies } from '../dependencies.js'
import { assertCanWrite } from '../matches/assertMembership.js'

export async function removePlayer(
  deps: Pick<Dependencies, 'matches' | 'memberships'>,
  userId: string,
  matchId: string,
  playerId: string,
): Promise<void> {
  await assertCanWrite(deps, matchId, userId)
  await deps.matches.removePlayer(matchId, playerId)
}
