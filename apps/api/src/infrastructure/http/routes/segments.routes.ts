import type { FastifyInstance } from 'fastify'
import { claimSegment } from '../../../application/segments/claimSegment.js'
import { generateSegments } from '../../../application/segments/generateSegments.js'
import { updateSegmentStatus } from '../../../application/segments/updateSegmentStatus.js'
import type { AppContext } from '../context.js'

/**
 * Registered inside the same encapsulated scope as `registerMatchRoutes`, so
 * it inherits that scope's `requireAuth` hook rather than adding its own.
 */
export function registerSegmentRoutes(app: FastifyInstance, context: AppContext): void {
  const { deps, realtime } = context

  async function broadcast(matchId: string): Promise<void> {
    realtime.broadcastSegmentsUpdated(matchId, await deps.segments.listForMatch(matchId))
  }

  app.get<{ Params: { matchId: string } }>('/matches/:matchId/segments', async (request) => {
    return { segments: await deps.segments.listForMatch(request.params.matchId) }
  })

  app.post<{
    Params: { matchId: string }
    Body: { durationMs: number; count: number }
  }>('/matches/:matchId/segments/generate', async (request) => {
    const segments = await generateSegments(
      deps,
      request.userId!,
      request.params.matchId,
      request.body,
    )
    realtime.broadcastSegmentsUpdated(request.params.matchId, segments)
    return { segments }
  })

  app.post<{ Params: { matchId: string; segmentId: string } }>(
    '/matches/:matchId/segments/:segmentId/claim',
    async (request) => {
      const segment = await claimSegment(
        deps,
        request.userId!,
        request.params.matchId,
        request.params.segmentId,
      )
      await broadcast(request.params.matchId)
      return { segment }
    },
  )

  app.post<{ Params: { matchId: string; segmentId: string } }>(
    '/matches/:matchId/segments/:segmentId/complete',
    async (request) => {
      await updateSegmentStatus(
        deps,
        request.userId!,
        request.params.matchId,
        request.params.segmentId,
        'done',
      )
      await broadcast(request.params.matchId)
      return { ok: true }
    },
  )

  app.post<{ Params: { matchId: string; segmentId: string } }>(
    '/matches/:matchId/segments/:segmentId/release',
    async (request) => {
      await updateSegmentStatus(
        deps,
        request.userId!,
        request.params.matchId,
        request.params.segmentId,
        'pending',
      )
      await broadcast(request.params.matchId)
      return { ok: true }
    },
  )
}
