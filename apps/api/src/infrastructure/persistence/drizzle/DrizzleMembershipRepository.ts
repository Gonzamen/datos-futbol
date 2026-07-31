import { and, eq } from 'drizzle-orm'
import type { MembershipRepository } from '../../../domain/ports/MembershipRepository.js'
import type { Membership, MembershipRole } from '../../../domain/user.js'
import type { Database } from './client.js'
import { matchMembers } from './schema.js'

export class DrizzleMembershipRepository implements MembershipRepository {
  constructor(private readonly db: Database) {}

  async find(matchId: string, userId: string): Promise<Membership | null> {
    const [row] = await this.db
      .select()
      .from(matchMembers)
      .where(and(eq(matchMembers.matchId, matchId), eq(matchMembers.userId, userId)))
      .limit(1)

    return row ? toMembership(row) : null
  }

  async listForMatch(matchId: string): Promise<Membership[]> {
    const rows = await this.db.select().from(matchMembers).where(eq(matchMembers.matchId, matchId))

    return rows.map(toMembership)
  }

  async listForUser(userId: string): Promise<Membership[]> {
    const rows = await this.db.select().from(matchMembers).where(eq(matchMembers.userId, userId))
    return rows.map(toMembership)
  }

  async add(membership: Membership): Promise<void> {
    await this.db
      .insert(matchMembers)
      .values({
        matchId: membership.matchId,
        userId: membership.userId,
        role: membership.role,
        joinedAt: new Date(membership.joinedAt),
      })
      .onConflictDoNothing()
  }

  async setRole(matchId: string, userId: string, role: MembershipRole): Promise<void> {
    await this.db
      .update(matchMembers)
      .set({ role })
      .where(and(eq(matchMembers.matchId, matchId), eq(matchMembers.userId, userId)))
  }
}

function toMembership(row: typeof matchMembers.$inferSelect): Membership {
  return {
    matchId: row.matchId,
    userId: row.userId,
    role: row.role as MembershipRole,
    joinedAt: row.joinedAt.getTime(),
  }
}
