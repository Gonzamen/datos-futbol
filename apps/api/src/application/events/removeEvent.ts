import type { Dependencies } from '../dependencies.js'
import { assertCanWrite } from '../matches/assertMembership.js'

export async function removeEvent(
  deps: Pick<Dependencies, 'matches' | 'memberships' | 'ids'>,
  userId: string,
  matchId: string,
  eventId: string,
): Promise<void> {
  await assertCanWrite(deps, matchId, userId)
  await deps.matches.markEventDeleted(matchId, eventId, userId, deps.ids.now())
}
