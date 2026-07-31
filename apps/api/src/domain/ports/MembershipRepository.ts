import type { Membership, MembershipRole } from '../user.js'

export interface MembershipRepository {
  find(matchId: string, userId: string): Promise<Membership | null>
  listForMatch(matchId: string): Promise<Membership[]>
  listForUser(userId: string): Promise<Membership[]>
  add(membership: Membership): Promise<void>
  setRole(matchId: string, userId: string, role: MembershipRole): Promise<void>
}
