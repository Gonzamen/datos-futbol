import type { FastifyInstance } from 'fastify'
import { renamePerson } from '../../../application/people/renamePerson.js'
import { resolvePerson } from '../../../application/people/resolvePerson.js'
import { searchPeople } from '../../../application/people/searchPeople.js'
import { requireAuth } from '../plugins/session.js'
import type { AppContext } from '../context.js'

/**
 * The roster (`people`) is shared across the whole group, not scoped to a
 * match — anyone signed in can add or fix a name here, same as team edits.
 */
export function registerPeopleRoutes(app: FastifyInstance, context: AppContext): void {
  app.get<{ Querystring: { query?: string; limit?: string } }>(
    '/people',
    { preHandler: requireAuth },
    async (request) => {
      const limit = Number(request.query.limit ?? 8)
      const people = await searchPeople(
        context.deps,
        request.query.query ?? '',
        Number.isFinite(limit) && limit > 0 ? limit : 8,
      )
      return { people }
    },
  )

  app.post<{ Body: { name: string } }>('/people', { preHandler: requireAuth }, async (request) => {
    const person = await resolvePerson(context.deps, request.body.name)
    return { person }
  })

  app.patch<{ Params: { personId: string }; Body: { name: string } }>(
    '/people/:personId',
    { preHandler: requireAuth },
    async (request) => {
      await renamePerson(context.deps, request.params.personId, request.body.name)
      return { ok: true }
    },
  )
}
