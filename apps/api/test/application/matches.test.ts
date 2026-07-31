import { activeEvents } from '@datos-futbol/domain'
import { beforeEach, describe, expect, it } from 'vitest'
import { findOrCreateUserFromGoogle } from '../../src/application/auth/findOrCreateUserFromGoogle.js'
import { addEvent } from '../../src/application/events/addEvent.js'
import { createMatch } from '../../src/application/matches/createMatch.js'
import { getMatch } from '../../src/application/matches/getMatch.js'
import { joinMatchByCode } from '../../src/application/matches/joinMatchByCode.js'
import { listMyMatches } from '../../src/application/matches/listMyMatches.js'
import { updateMatchInfo } from '../../src/application/matches/updateMatchInfo.js'
import { AppError } from '../../src/application/errors.js'
import { addPlayer } from '../../src/application/teams/addPlayer.js'
import { sequentialIdFactory, testDeps } from '../testDeps.js'

async function makeUser(deps: ReturnType<typeof testDeps>, email: string) {
  return findOrCreateUserFromGoogle(deps, {
    sub: `google-${email}`,
    email,
    name: email,
    picture: null,
  })
}

describe('createMatch', () => {
  it('crea el partido con dos equipos vacíos y hace dueño a quien lo crea', async () => {
    const deps = testDeps()
    const owner = await makeUser(deps, 'gonza@example.com')

    const match = await createMatch(deps, { ownerId: owner.id, date: '2026-07-30' })

    expect(match.teams).toHaveLength(2)
    expect(match.teams.every((team) => team.players.length === 0)).toBe(true)

    const membership = await deps.memberships.find(match.id, owner.id)
    expect(membership?.role).toBe('owner')
  })

  it('genera un código de invitación que sirve para encontrar el partido', async () => {
    const deps = testDeps()
    const owner = await makeUser(deps, 'gonza@example.com')

    const match = await createMatch(deps, { ownerId: owner.id, date: '2026-07-30' })
    const [meta] = await deps.matches.listMeta([match.id])

    expect(meta?.inviteCode).toMatch(/^[A-Z0-9]{6}$/)

    const found = await deps.matches.findByInviteCode(meta!.inviteCode)
    expect(found?.id).toBe(match.id)
  })
})

describe('getMatch', () => {
  it('rechaza a quien no es miembro del partido', async () => {
    const deps = testDeps()
    const owner = await makeUser(deps, 'gonza@example.com')
    const stranger = await makeUser(deps, 'nadie@example.com')
    const match = await createMatch(deps, { ownerId: owner.id, date: '2026-07-30' })

    await expect(getMatch(deps, stranger.id, match.id)).rejects.toThrow(AppError)
  })

  it('deja pasar a un miembro', async () => {
    const deps = testDeps()
    const owner = await makeUser(deps, 'gonza@example.com')
    const match = await createMatch(deps, { ownerId: owner.id, date: '2026-07-30' })

    await expect(getMatch(deps, owner.id, match.id)).resolves.toMatchObject({ id: match.id })
  })
})

describe('joinMatchByCode', () => {
  let deps: ReturnType<typeof testDeps>
  let ownerId: string
  let matchId: string
  let inviteCode: string

  beforeEach(async () => {
    deps = testDeps()
    const owner = await makeUser(deps, 'gonza@example.com')
    ownerId = owner.id
    const match = await createMatch(deps, { ownerId, date: '2026-07-30' })
    matchId = match.id
    inviteCode = (await deps.matches.listMeta([matchId]))[0]!.inviteCode
  })

  it('suma al que se une como tagger, no como dueño', async () => {
    const friend = await makeUser(deps, 'profe@example.com')

    await joinMatchByCode(deps, friend.id, inviteCode)

    const membership = await deps.memberships.find(matchId, friend.id)
    expect(membership?.role).toBe('tagger')
  })

  it('acepta el código sin importar mayúsculas ni espacios', async () => {
    const friend = await makeUser(deps, 'profe@example.com')

    await expect(
      joinMatchByCode(deps, friend.id, `  ${inviteCode.toLowerCase()}  `),
    ).resolves.toMatchObject({ id: matchId })
  })

  it('rechaza un código que no existe', async () => {
    const friend = await makeUser(deps, 'profe@example.com')

    await expect(joinMatchByCode(deps, friend.id, 'ZZZZZZ')).rejects.toThrow(AppError)
  })

  it('unirse dos veces no duplica la membresía ni cambia el rol', async () => {
    const friend = await makeUser(deps, 'profe@example.com')

    await joinMatchByCode(deps, friend.id, inviteCode)
    await joinMatchByCode(deps, friend.id, inviteCode)

    const members = await deps.memberships.listForMatch(matchId)
    expect(members.filter((m) => m.userId === friend.id)).toHaveLength(1)
  })
})

describe('listMyMatches', () => {
  it('muestra el rol y la cantidad de miembros de cada partido', async () => {
    const deps = testDeps()
    const owner = await makeUser(deps, 'gonza@example.com')
    const friend = await makeUser(deps, 'profe@example.com')
    const match = await createMatch(deps, { ownerId: owner.id, date: '2026-07-30' })
    const inviteCode = (await deps.matches.listMeta([match.id]))[0]!.inviteCode

    await joinMatchByCode(deps, friend.id, inviteCode)

    const [summary] = await listMyMatches(deps, owner.id)

    expect(summary?.role).toBe('owner')
    expect(summary?.memberCount).toBe(2)
  })

  it('no muestra partidos de los que no se es miembro', async () => {
    const deps = testDeps()
    const owner = await makeUser(deps, 'gonza@example.com')
    const stranger = await makeUser(deps, 'nadie@example.com')
    await createMatch(deps, { ownerId: owner.id, date: '2026-07-30' })

    expect(await listMyMatches(deps, stranger.id)).toEqual([])
  })

  it('refleja los eventos cargados', async () => {
    const deps = testDeps(sequentialIdFactory())
    const owner = await makeUser(deps, 'gonza@example.com')
    const match = await createMatch(deps, { ownerId: owner.id, date: '2026-07-30' })
    const teamId = match.teams[0]!.id
    const player = await addPlayer(deps, owner.id, match.id, teamId, 'Pollo')

    await addEvent(deps, owner.id, match.id, {
      eventId: 'evt-1',
      playerId: player.id,
      statId: 'goles',
      delta: 1,
      videoMs: 1000,
    })

    const [summary] = await listMyMatches(deps, owner.id)
    expect(summary?.eventCount).toBe(1)
  })
})

describe('updateMatchInfo', () => {
  it('bloquea a un viewer', async () => {
    const deps = testDeps()
    const owner = await makeUser(deps, 'gonza@example.com')
    const viewer = await makeUser(deps, 'espectador@example.com')
    const match = await createMatch(deps, { ownerId: owner.id, date: '2026-07-30' })

    await deps.memberships.add({
      matchId: match.id,
      userId: viewer.id,
      role: 'viewer',
      joinedAt: deps.ids.now(),
    })

    await expect(
      updateMatchInfo(deps, viewer.id, match.id, { name: 'Nuevo nombre' }),
    ).rejects.toThrow(AppError)
  })

  it('permite a un tagger cambiar el video', async () => {
    const deps = testDeps()
    const owner = await makeUser(deps, 'gonza@example.com')
    const friend = await makeUser(deps, 'profe@example.com')
    const match = await createMatch(deps, { ownerId: owner.id, date: '2026-07-30' })
    const inviteCode = (await deps.matches.listMeta([match.id]))[0]!.inviteCode
    await joinMatchByCode(deps, friend.id, inviteCode)

    await updateMatchInfo(deps, friend.id, match.id, {
      video: { provider: 'youtube', videoId: 'dQw4w9WgXcQ' },
    })

    const updated = await getMatch(deps, owner.id, match.id)
    expect(updated.video).toEqual({ provider: 'youtube', videoId: 'dQw4w9WgXcQ' })
  })
})

describe('activeEvents tras borrar', () => {
  it('un evento borrado no cuenta pero sigue en el log', async () => {
    const deps = testDeps()
    const owner = await makeUser(deps, 'gonza@example.com')
    const match = await createMatch(deps, { ownerId: owner.id, date: '2026-07-30' })
    const teamId = match.teams[0]!.id
    const player = await addPlayer(deps, owner.id, match.id, teamId, 'Pollo')

    await addEvent(deps, owner.id, match.id, {
      eventId: 'evt-1',
      playerId: player.id,
      statId: 'goles',
      delta: 1,
      videoMs: 1000,
    })

    await deps.matches.markEventDeleted(match.id, 'evt-1', owner.id, deps.ids.now())

    const stored = await deps.matches.findById(match.id)
    expect(stored?.events).toHaveLength(1)
    expect(activeEvents(stored!)).toHaveLength(0)
  })
})
