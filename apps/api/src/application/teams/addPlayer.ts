import { createPlayer } from '@datos-futbol/domain'
import type { Player } from '@datos-futbol/domain'
import type { Dependencies } from '../dependencies.js'
import { resolvePerson } from '../people/resolvePerson.js'
import { assertCanWrite } from '../matches/assertMembership.js'

export async function addPlayer(
  deps: Pick<Dependencies, 'matches' | 'memberships' | 'people' | 'ids'>,
  userId: string,
  matchId: string,
  teamId: string,
  name: string,
): Promise<Player> {
  await assertCanWrite(deps, matchId, userId)

  const person = await resolvePerson(deps, name)
  const player = createPlayer(person.id, person.name, deps.ids)

  await deps.matches.addPlayer(matchId, teamId, player)

  return player
}
