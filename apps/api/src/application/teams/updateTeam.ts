import type { Dependencies } from '../dependencies.js'
import { assertCanWrite } from '../matches/assertMembership.js'

export async function updateTeam(
  deps: Pick<Dependencies, 'matches' | 'memberships'>,
  userId: string,
  matchId: string,
  teamId: string,
  changes: { name?: string; color?: string },
): Promise<void> {
  await assertCanWrite(deps, matchId, userId)
  await deps.matches.updateTeam(matchId, teamId, changes)
}
