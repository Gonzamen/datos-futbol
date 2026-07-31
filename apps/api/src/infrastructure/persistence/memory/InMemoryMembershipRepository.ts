import type { MembershipRepository } from '../../../domain/ports/MembershipRepository.js'
import type { Membership, MembershipRole } from '../../../domain/user.js'

export class InMemoryMembershipRepository implements MembershipRepository {
  private readonly memberships: Membership[] = []

  async find(matchId: string, userId: string): Promise<Membership | null> {
    return this.memberships.find((m) => m.matchId === matchId && m.userId === userId) ?? null
  }

  async listForMatch(matchId: string): Promise<Membership[]> {
    return this.memberships.filter((m) => m.matchId === matchId)
  }

  async listForUser(userId: string): Promise<Membership[]> {
    return this.memberships.filter((m) => m.userId === userId)
  }

  async add(membership: Membership): Promise<void> {
    if (await this.find(membership.matchId, membership.userId)) {
      return
    }
    this.memberships.push(membership)
  }

  async setRole(matchId: string, userId: string, role: MembershipRole): Promise<void> {
    const membership = await this.find(matchId, userId)
    if (membership) {
      membership.role = role
    }
  }
}
