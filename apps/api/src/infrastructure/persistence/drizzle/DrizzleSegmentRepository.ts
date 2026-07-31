import { asc, eq } from 'drizzle-orm'
import type { Segment, SegmentStatus } from '../../../domain/segment.js'
import type { SegmentRepository } from '../../../domain/ports/SegmentRepository.js'
import type { Database } from './client.js'
import { segments } from './schema.js'

export class DrizzleSegmentRepository implements SegmentRepository {
  constructor(private readonly db: Database) {}

  async listForMatch(matchId: string): Promise<Segment[]> {
    const rows = await this.db
      .select()
      .from(segments)
      .where(eq(segments.matchId, matchId))
      .orderBy(asc(segments.position))

    return rows.map(toSegment)
  }

  async replaceAll(matchId: string, replacement: Segment[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(segments).where(eq(segments.matchId, matchId))

      if (replacement.length) {
        await tx.insert(segments).values(
          replacement.map((segment) => ({
            id: segment.id,
            matchId: segment.matchId,
            label: segment.label,
            startMs: segment.startMs,
            endMs: segment.endMs,
            assigneeUserId: segment.assigneeUserId,
            status: segment.status,
            position: segment.position,
          })),
        )
      }
    })
  }

  async claim(segmentId: string, userId: string): Promise<Segment | null> {
    const [row] = await this.db
      .update(segments)
      .set({ assigneeUserId: userId, status: 'in_progress' })
      .where(eq(segments.id, segmentId))
      .returning()

    return row ? toSegment(row) : null
  }

  async complete(segmentId: string): Promise<void> {
    await this.db.update(segments).set({ status: 'done' }).where(eq(segments.id, segmentId))
  }

  async release(segmentId: string): Promise<void> {
    await this.db
      .update(segments)
      .set({ assigneeUserId: null, status: 'pending' })
      .where(eq(segments.id, segmentId))
  }
}

function toSegment(row: typeof segments.$inferSelect): Segment {
  return {
    id: row.id,
    matchId: row.matchId,
    label: row.label,
    startMs: row.startMs,
    endMs: row.endMs,
    assigneeUserId: row.assigneeUserId,
    status: row.status as SegmentStatus,
    position: row.position,
  }
}
