import { describe, expect, it } from 'vitest'
import { findOrCreateUserFromGoogle } from '../../src/application/auth/findOrCreateUserFromGoogle.js'
import { addEvent } from '../../src/application/events/addEvent.js'
import { createMatch } from '../../src/application/matches/createMatch.js'
import { getSeasonStats } from '../../src/application/season/getSeasonStats.js'
import { addPlayer } from '../../src/application/teams/addPlayer.js'
import { testDeps } from '../testDeps.js'

async function makeUser(deps: ReturnType<typeof testDeps>, email: string) {
  return findOrCreateUserFromGoogle(deps, {
    sub: `google-${email}`,
    email,
    name: email,
    picture: null,
  })
}

describe('getSeasonStats', () => {
  it('agrega los goles de un mismo jugador cargados en dos partidos distintos', async () => {
    const deps = testDeps()
    const owner = await makeUser(deps, 'gonza@example.com')

    const matchOne = await createMatch(deps, { ownerId: owner.id, date: '2026-07-01' })
    const playerOne = await addPlayer(deps, owner.id, matchOne.id, matchOne.teams[0]!.id, 'Pollo')
    await addEvent(deps, owner.id, matchOne.id, {
      eventId: 'evt-1',
      playerId: playerOne.id,
      statId: 'goles',
      delta: 1,
      videoMs: null,
    })

    const matchTwo = await createMatch(deps, { ownerId: owner.id, date: '2026-07-08' })
    const playerTwo = await addPlayer(deps, owner.id, matchTwo.id, matchTwo.teams[0]!.id, 'Pollo')
    await addEvent(deps, owner.id, matchTwo.id, {
      eventId: 'evt-2',
      playerId: playerTwo.id,
      statId: 'goles',
      delta: 1,
      videoMs: null,
    })

    const season = await getSeasonStats(deps, owner.id)

    expect(season.matchesPlayed).toBe(2)
    expect(season.ranking).toHaveLength(1)
    expect(season.ranking[0]).toMatchObject({
      personId: playerOne.personId,
      matchesPlayed: 2,
    })
    expect(season.ranking[0]?.totals.goles).toBe(2)
  })

  it('devuelve un reporte vacío para quien no es miembro de ningún partido', async () => {
    const deps = testDeps()
    const stranger = await makeUser(deps, 'nadie@example.com')

    const season = await getSeasonStats(deps, stranger.id)

    expect(season.matchesPlayed).toBe(0)
    expect(season.ranking).toEqual([])
  })

  it('no incluye partidos de los que el usuario no es miembro', async () => {
    const deps = testDeps()
    const owner = await makeUser(deps, 'gonza@example.com')
    const stranger = await makeUser(deps, 'nadie@example.com')

    const match = await createMatch(deps, { ownerId: owner.id, date: '2026-07-01' })
    const player = await addPlayer(deps, owner.id, match.id, match.teams[0]!.id, 'Pollo')
    await addEvent(deps, owner.id, match.id, {
      eventId: 'evt-1',
      playerId: player.id,
      statId: 'goles',
      delta: 1,
      videoMs: null,
    })

    const season = await getSeasonStats(deps, stranger.id)

    expect(season.matchesPlayed).toBe(0)
    expect(season.ranking).toEqual([])
  })
})
