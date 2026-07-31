import { activeEvents, createEvent, findPossibleDuplicate } from '@datos-futbol/domain'
import type { MatchEvent, StatId } from '@datos-futbol/domain'
import { invalid, notFound } from '../errors.js'
import type { Dependencies } from '../dependencies.js'
import { assertCanWrite } from '../matches/assertMembership.js'

export interface AddEventInput {
  eventId: string
  playerId: string
  statId: StatId
  delta: number
  videoMs: number | null
}

export interface AddEventResult {
  event: MatchEvent
  possibleDuplicateOf: string | null
}

/**
 * Validation is the domain package's job, not this use case's: `createEvent`
 * already knows a statistic has to exist and a correction cannot push a total
 * below zero. The API's own responsibility is authorization (can this user
 * write to this match), honouring the client-generated id (what makes a
 * retried request harmless instead of a duplicate goal), and flagging — never
 * blocking — a play that looks like it was already counted by someone else.
 */
export async function addEvent(
  deps: Pick<Dependencies, 'matches' | 'memberships' | 'ids'>,
  userId: string,
  matchId: string,
  input: AddEventInput,
): Promise<AddEventResult> {
  await assertCanWrite(deps, matchId, userId)

  const match = await deps.matches.findById(matchId)

  if (!match) {
    throw notFound('El partido no existe.')
  }

  const existing = match.events.find((event) => event.id === input.eventId)

  if (existing) {
    return { event: existing, possibleDuplicateOf: null }
  }

  const event = createEvent(
    match,
    {
      playerId: input.playerId,
      statId: input.statId,
      delta: input.delta,
      videoMs: input.videoMs,
      createdBy: userId,
    },
    { nextId: () => input.eventId, now: deps.ids.now },
  )

  if (!event) {
    throw invalid('No se pudo registrar esa acción: jugador o estadística inválidos.')
  }

  const duplicate =
    event.delta > 0
      ? findPossibleDuplicate(activeEvents(match), {
          playerId: input.playerId,
          statId: input.statId,
          videoMs: input.videoMs,
        })
      : null

  await deps.matches.appendEvent(matchId, event, duplicate?.id ?? null)

  return { event, possibleDuplicateOf: duplicate?.id ?? null }
}
