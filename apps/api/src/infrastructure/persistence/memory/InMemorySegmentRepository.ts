import type { Segment } from '../../../domain/segment.js'
import type { SegmentRepository } from '../../../domain/ports/SegmentRepository.js'

export class InMemorySegmentRepository implements SegmentRepository {
  private readonly segments = new Map<string, Segment>()

  async listForMatch(matchId: string): Promise<Segment[]> {
    return [...this.segments.values()]
      .filter((segment) => segment.matchId === matchId)
      .sort((a, b) => a.position - b.position)
  }

  async replaceAll(matchId: string, segments: Segment[]): Promise<void> {
    for (const [id, segment] of this.segments) {
      if (segment.matchId === matchId) {
        this.segments.delete(id)
      }
    }
    for (const segment of segments) {
      this.segments.set(segment.id, segment)
    }
  }

  async claim(segmentId: string, userId: string): Promise<Segment | null> {
    const segment = this.segments.get(segmentId)
    if (!segment) {
      return null
    }
    const updated: Segment = { ...segment, assigneeUserId: userId, status: 'in_progress' }
    this.segments.set(segmentId, updated)
    return updated
  }

  async complete(segmentId: string): Promise<void> {
    const segment = this.segments.get(segmentId)
    if (segment) {
      this.segments.set(segmentId, { ...segment, status: 'done' })
    }
  }

  async release(segmentId: string): Promise<void> {
    const segment = this.segments.get(segmentId)
    if (segment) {
      this.segments.set(segmentId, { ...segment, assigneeUserId: null, status: 'pending' })
    }
  }
}
