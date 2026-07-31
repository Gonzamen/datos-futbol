import { api } from './client.js'

export type SegmentStatus = 'pending' | 'in_progress' | 'done'

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

export const segmentsApi = {
  list: (matchId: string) =>
    api.get<{ segments: Segment[] }>(`/matches/${matchId}/segments`).then((r) => r.segments),

  generate: (matchId: string, durationMs: number, count: number) =>
    api
      .post<{ segments: Segment[] }>(`/matches/${matchId}/segments/generate`, {
        durationMs,
        count,
      })
      .then((r) => r.segments),

  claim: (matchId: string, segmentId: string) =>
    api.post(`/matches/${matchId}/segments/${segmentId}/claim`),

  complete: (matchId: string, segmentId: string) =>
    api.post(`/matches/${matchId}/segments/${segmentId}/complete`),

  release: (matchId: string, segmentId: string) =>
    api.post(`/matches/${matchId}/segments/${segmentId}/release`),
}
