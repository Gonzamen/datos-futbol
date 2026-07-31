import type { VideoReference } from '@datos-futbol/domain'
import type { Dependencies } from '../dependencies.js'
import { assertCanWrite } from './assertMembership.js'

export interface UpdateMatchInfoInput {
  name?: string
  date?: string
  video?: VideoReference | null
}

export async function updateMatchInfo(
  deps: Pick<Dependencies, 'matches' | 'memberships'>,
  userId: string,
  matchId: string,
  changes: UpdateMatchInfoInput,
): Promise<void> {
  await assertCanWrite(deps, matchId, userId)
  await deps.matches.updateInfo(matchId, changes)
}
