import { randomBytes } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { findOrCreateUserFromGoogle } from '../../../application/auth/findOrCreateUserFromGoogle.js'
import { buildGoogleAuthorizationUrl, exchangeCodeForProfile } from '../../auth/google.js'
import { signSession } from '../../auth/jwt.js'
import { SESSION_COOKIE } from '../plugins/session.js'
import type { AppContext } from '../context.js'

const STATE_COOKIE = 'df_oauth_state'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export function registerAuthRoutes(app: FastifyInstance, context: AppContext): void {
  const { env, deps } = context

  app.get('/auth/google', async (_request, reply) => {
    const state = randomBytes(16).toString('hex')

    reply.setCookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: env.cookieSameSite,
      secure: env.cookieSecure,
      maxAge: 300,
      path: '/',
    })

    return reply.redirect(buildGoogleAuthorizationUrl(env, state))
  })

  app.get<{ Querystring: { code?: string; state?: string } }>(
    '/auth/google/callback',
    async (request, reply) => {
      const { code, state } = request.query
      const expectedState = request.cookies[STATE_COOKIE]

      reply.clearCookie(STATE_COOKIE, { path: '/' })

      if (!code || !state || !expectedState || state !== expectedState) {
        return reply.code(400).send({ error: 'El intento de login no es válido. Probá de nuevo.' })
      }

      const profile = await exchangeCodeForProfile(env, code)
      const user = await findOrCreateUserFromGoogle(deps, profile)
      const token = await signSession(env.jwtSecret, { userId: user.id })

      reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: env.cookieSameSite,
        secure: env.cookieSecure,
        maxAge: SESSION_MAX_AGE_SECONDS,
        path: '/',
      })

      return reply.redirect(env.webOrigin)
    },
  )

  app.post('/auth/logout', async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return reply.code(204).send()
  })

  app.get('/auth/me', async (request, reply) => {
    if (!request.userId) {
      return reply.code(401).send({ error: 'No iniciaste sesión.' })
    }

    const user = await deps.users.findById(request.userId)

    if (!user) {
      reply.clearCookie(SESSION_COOKIE, { path: '/' })
      return reply.code(401).send({ error: 'La sesión ya no es válida.' })
    }

    return { user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl } }
  })
}
