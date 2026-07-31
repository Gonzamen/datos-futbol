import type { Segment } from '../../domain/segment.js'
import { conflict, notFound } from '../errors.js'
import type { Dependencies } from '../dependencies.js'
import { assertCanWrite } from '../matches/assertMembership.js'

/**
 * Claims a segment for the caller. Refuses a segment somebody else already
 * has, but re-claiming your own is a no-op success — a page refresh mid-tag
 * should not error.
 */
export async function claimSegment(
  deps: Pick<Dependencies, 'matches' | 'memberships' | 'segments'>,
  userId: string,
  matchId: string,
  segmentId: string,
): Promise<Segment> {
  await assertCanWrite(deps, matchId, userId)

  const segments = await deps.segments.listForMatch(matchId)
  const target = segments.find((segment) => segment.id === segmentId)

  if (!target) {
    throw notFound('Ese tramo no existe.')
  }

  if (target.assigneeUserId && target.assigneeUserId !== userId) {
    throw conflict('Ese tramo ya lo agarró otra persona.')
  }

  const claimed = await deps.segments.claim(segmentId, userId)

  if (!claimed) {
    throw notFound('Ese tramo no existe.')
  }

  return claimed
}
