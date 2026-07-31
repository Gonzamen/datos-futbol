import { isStatId } from '@datos-futbol/domain'
import type { FastifyInstance } from 'fastify'
import { addEvent } from '../../../application/events/addEvent.js'
import { removeEvent } from '../../../application/events/removeEvent.js'
import { invalid } from '../../../application/errors.js'
import { createMatch } from '../../../application/matches/createMatch.js'
import { getMatch } from '../../../application/matches/getMatch.js'
import { joinMatchByCode } from '../../../application/matches/joinMatchByCode.js'
import { listMyMatches } from '../../../application/matches/listMyMatches.js'
import { updateMatchInfo } from '../../../application/matches/updateMatchInfo.js'
import { addPlayer } from '../../../application/teams/addPlayer.js'
import { removePlayer } from '../../../application/teams/removePlayer.js'
import { renamePlayer } from '../../../application/teams/renamePlayer.js'
import { updateTeam } from '../../../application/teams/updateTeam.js'
import { requireAuth } from '../plugins/session.js'
import type { AppContext } from '../context.js'

export function registerMatchRoutes(app: FastifyInstance, context: AppContext): void {
  const { deps, realtime } = context

  app.addHook('preHandler', requireAuth)

  /** Re-fetches the match and tells everyone else in the room what changed. */
  async function broadcastMatchChange(userId: string, matchId: string): Promise<void> {
    const match = await getMatch(deps, userId, matchId)
    realtime.broadcastMatchUpdated(matchId, match)
  }

  app.get('/matches', async (request) => {
    return { matches: await listMyMatches(deps, request.userId!) }
  })

  app.post<{ Body: { name?: string; date: string } }>('/matches', async (request) => {
    const { name, date } = request.body

    if (!date) {
      throw invalid('El partido necesita una fecha.')
    }

    const match = await createMatch(deps, { ownerId: request.userId!, name, date })
    return { match }
  })

  app.post<{ Body: { inviteCode: string } }>('/matches/join', async (request) => {
    const match = await joinMatchByCode(deps, request.userId!, request.body.inviteCode)
    return { match }
  })

  app.get<{ Params: { matchId: string } }>('/matches/:matchId', async (request) => {
    const match = await getMatch(deps, request.userId!, request.params.matchId)
    const duplicateFlags = await deps.matches.listDuplicateFlags(request.params.matchId)
    return { match, duplicateFlags }
  })

  app.patch<{
    Params: { matchId: string }
    Body: { name?: string; date?: string; video?: { provider: 'youtube'; videoId: string } | null }
  }>('/matches/:matchId', async (request) => {
    await updateMatchInfo(deps, request.userId!, request.params.matchId, request.body)
    const match = await getMatch(deps, request.userId!, request.params.matchId)
    realtime.broadcastMatchUpdated(request.params.matchId, match)
    return { match }
  })

  app.patch<{
    Params: { matchId: string; teamId: string }
    Body: { name?: string; color?: string }
  }>('/matches/:matchId/teams/:teamId', async (request) => {
    await updateTeam(
      deps,
      request.userId!,
      request.params.matchId,
      request.params.teamId,
      request.body,
    )
    await broadcastMatchChange(request.userId!, request.params.matchId)
    return { ok: true }
  })

  app.post<{
    Params: { matchId: string; teamId: string }
    Body: { name: string }
  }>('/matches/:matchId/teams/:teamId/players', async (request) => {
    const player = await addPlayer(
      deps,
      request.userId!,
      request.params.matchId,
      request.params.teamId,
      request.body.name,
    )
    await broadcastMatchChange(request.userId!, request.params.matchId)
    return { player }
  })

  app.patch<{
    Params: { matchId: string; playerId: string }
    Body: { name: string }
  }>('/matches/:matchId/players/:playerId', async (request) => {
    await renamePlayer(
      deps,
      request.userId!,
      request.params.matchId,
      request.params.playerId,
      request.body.name,
    )
    await broadcastMatchChange(request.userId!, request.params.matchId)
    return { ok: true }
  })

  app.delete<{ Params: { matchId: string; playerId: string } }>(
    '/matches/:matchId/players/:playerId',
    async (request) => {
      await removePlayer(deps, request.userId!, request.params.matchId, request.params.playerId)
      await broadcastMatchChange(request.userId!, request.params.matchId)
      return { ok: true }
    },
  )

  app.post<{
    Params: { matchId: string }
    Body: {
      eventId: string
      playerId: string
      statId: string
      delta: number
      videoMs: number | null
    }
  }>('/matches/:matchId/events', async (request) => {
    const { eventId, playerId, statId, delta, videoMs } = request.body

    if (!isStatId(statId)) {
      throw invalid(`Estadística desconocida: ${statId}.`)
    }

    const result = await addEvent(deps, request.userId!, request.params.matchId, {
      eventId,
      playerId,
      statId,
      delta,
      videoMs,
    })

    realtime.broadcastEventAdded(request.params.matchId, result)

    return result
  })

  app.delete<{ Params: { matchId: string; eventId: string } }>(
    '/matches/:matchId/events/:eventId',
    async (request) => {
      await removeEvent(deps, request.userId!, request.params.matchId, request.params.eventId)
      realtime.broadcastEventRemoved(request.params.matchId, request.params.eventId)
      return { ok: true }
    },
  )
}
