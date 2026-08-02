import type { FastifyInstance } from 'fastify'
import { getSeasonStats } from '../../../application/season/getSeasonStats.js'
import { requireAuth } from '../plugins/session.js'
import type { AppContext } from '../context.js'

export function registerSeasonRoutes(app: FastifyInstance, context: AppContext): void {
  const { deps } = context

  app.addHook('preHandler', requireAuth)

  app.get('/season', async (request) => {
    return { season: await getSeasonStats(deps, request.userId!) }
  })
}
