import type { Segment } from '../segment.js'

export interface SegmentRepository {
  listForMatch(matchId: string): Promise<Segment[]>
  /** Replaces every segment of a match in one go — see `generateSegments`'s use case doc. */
  replaceAll(matchId: string, segments: Segment[]): Promise<void>
  /** Assigns the segment to `userId` and marks it in progress. */
  claim(segmentId: string, userId: string): Promise<Segment | null>
  /** Marks the segment done, keeping its assignee. */
  complete(segmentId: string): Promise<void>
  /** Clears the assignee and returns the segment to pending. */
  release(segmentId: string): Promise<void>
}
