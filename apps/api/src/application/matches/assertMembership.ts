import { forbidden } from '../errors.js'
import type { Dependencies } from '../dependencies.js'
import type { Membership } from '../../domain/user.js'

/**
 * `viewer` can look at a match but not touch it — the role for someone who
 * wants to check the numbers without being trusted to correct them. Every
 * mutation in `application/` goes through this before touching a repository.
 */
export async function assertCanWrite(
  deps: Pick<Dependencies, 'memberships'>,
  matchId: string,
  userId: string,
): Promise<Membership> {
  const membership = await deps.memberships.find(matchId, userId)

  if (!membership) {
    throw forbidden('No sos parte de este partido.')
  }

  if (membership.role === 'viewer') {
    throw forbidden('Tenés acceso de solo lectura a este partido.')
  }

  return membership
}
