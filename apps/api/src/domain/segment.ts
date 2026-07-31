export type SegmentStatus = 'pending' | 'in_progress' | 'done'

/**
 * A slice of the match video one person is responsible for tagging. Purely a
 * coordination device — it does not contain events, an event belongs to
 * whichever segment its `videoMs` currently falls in. That is what lets
 * segments be redivided at any point (someone joins late, someone drops out)
 * without ever touching already-recorded data.
 */
export interface Segment {
  id: string
  matchId: string
  label: string
  startMs: number
  endMs: number
  assigneeUserId: string | null
  status: SegmentStatus
  position: number
}
