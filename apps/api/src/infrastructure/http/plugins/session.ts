import fp from 'fastify-plugin'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { verifySession } from '../../auth/jwt.js'
import type { Env } from '../../../config/env.js'

export const SESSION_COOKIE = 'df_session'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string | null
  }
}

/**
 * Reads the session cookie on every request and decorates it onto the
 * request, so route handlers never touch JWTs directly. Missing or invalid
 * tokens just mean `userId` stays null — routes that need a session enforce
 * that themselves with {@link requireAuth}, so public endpoints stay usable
 * without one.
 */
export const sessionPlugin = fp(async (app, opts: { env: Env }) => {
  app.decorateRequest('userId', null)

  app.addHook('onRequest', async (request) => {
    const token = request.cookies[SESSION_COOKIE]
    request.userId = token
      ? ((await verifySession(opts.env.jwtSecret, token))?.userId ?? null)
      : null
  })
})

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.userId) {
    await reply.code(401).send({ error: 'No iniciaste sesión.' })
  }
}
