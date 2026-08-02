import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import Fastify from 'fastify'
import type { AppContext, AppDependencies } from './context.js'
import { registerErrorHandler } from './errorHandler.js'
import { sessionPlugin } from './plugins/session.js'
import { registerAuthRoutes } from './routes/auth.routes.js'
import { registerMatchRoutes } from './routes/matches.routes.js'
import { registerPeopleRoutes } from './routes/people.routes.js'
import { registerSeasonRoutes } from './routes/season.routes.js'
import { registerSegmentRoutes } from './routes/segments.routes.js'
import { createRealtimeGateway } from '../realtime/gateway.js'

export async function buildApp(input: AppDependencies) {
  const app = Fastify({ logger: true })

  await app.register(cors, { origin: input.env.webOrigin, credentials: true })
  await app.register(cookie)
  await app.register(sessionPlugin, { env: input.env })

  registerErrorHandler(app)

  const realtime = createRealtimeGateway(app.server, input.env, input.deps)
  const context: AppContext = { ...input, realtime }

  app.get('/health', async () => ({ ok: true }))

  registerAuthRoutes(app, context)
  registerPeopleRoutes(app, context)

  // Encapsulated so the `requireAuth` hook added inside only applies to these
  // routes, not to every route on the shared instance — Fastify hooks added
  // straight on the root app are global regardless of registration order.
  await app.register(async (matchesScope) => {
    registerMatchRoutes(matchesScope, context)
    registerSegmentRoutes(matchesScope, context)
    registerSeasonRoutes(matchesScope, context)
  })

  return app
}
