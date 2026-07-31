import { forbidden, notFound } from '../errors.js'
import type { Dependencies } from '../dependencies.js'
import { assertCanWrite } from '../matches/assertMembership.js'

/**
 * Marks a segment done, or releases it back to `pending` with nobody
 * assigned — the manual counterpart of "alguien abandona a mitad": whoever
 * notices reopens the segment so someone else can pick it up.
 */
export async function updateSegmentStatus(
  deps: Pick<Dependencies, 'matches' | 'memberships' | 'segments'>,
  userId: string,
  matchId: string,
  segmentId: string,
  status: 'done' | 'pending',
): Promise<void> {
  await assertCanWrite(deps, matchId, userId)

  const segments = await deps.segments.listForMatch(matchId)
  const target = segments.find((segment) => segment.id === segmentId)

  if (!target) {
    throw notFound('Ese tramo no existe.')
  }

  if (status === 'done') {
    if (target.assigneeUserId !== userId) {
      throw forbidden('Solo quien tiene el tramo asignado puede marcarlo completo.')
    }
    await deps.segments.complete(segmentId)
    return
  }

  await deps.segments.release(segmentId)
}
