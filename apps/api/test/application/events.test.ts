import { describe, expect, it } from 'vitest'
import { findOrCreateUserFromGoogle } from '../../src/application/auth/findOrCreateUserFromGoogle.js'
import { addEvent } from '../../src/application/events/addEvent.js'
import { removeEvent } from '../../src/application/events/removeEvent.js'
import { AppError } from '../../src/application/errors.js'
import { createMatch } from '../../src/application/matches/createMatch.js'
import { joinMatchByCode } from '../../src/application/matches/joinMatchByCode.js'
import { addPlayer } from '../../src/application/teams/addPlayer.js'
import { testDeps } from '../testDeps.js'

async function setup() {
  const deps = testDeps()
  const owner = await findOrCreateUserFromGoogle(deps, {
    sub: 'g-owner',
    email: 'gonza@example.com',
    name: 'Gonza',
    picture: null,
  })
  const match = await createMatch(deps, { ownerId: owner.id, date: '2026-07-30' })
  const player = await addPlayer(deps, owner.id, match.id, match.teams[0]!.id, 'Pollo')

  return { deps, owner, match, player }
}

describe('addEvent', () => {
  it('registra la acción con el timecode del video', async () => {
    const { deps, owner, match, player } = await setup()

    const { event, possibleDuplicateOf } = await addEvent(deps, owner.id, match.id, {
      eventId: 'evt-1',
      playerId: player.id,
      statId: 'goles',
      delta: 1,
      videoMs: 743_000,
    })

    expect(event.videoMs).toBe(743_000)
    expect(event.createdBy).toBe(owner.id)
    expect(possibleDuplicateOf).toBeNull()

    const stored = await deps.matches.findById(match.id)
    expect(stored?.events).toHaveLength(1)
  })

  it('reenviar el mismo id no duplica el evento', async () => {
    const { deps, owner, match, player } = await setup()
    const input = {
      eventId: 'evt-1',
      playerId: player.id,
      statId: 'goles' as const,
      delta: 1,
      videoMs: 1000,
    }

    const first = await addEvent(deps, owner.id, match.id, input)
    const second = await addEvent(deps, owner.id, match.id, input)

    expect(second).toEqual(first)
    expect((await deps.matches.findById(match.id))?.events).toHaveLength(1)
  })

  it('rechaza una corrección que dejaría el total en negativo', async () => {
    const { deps, owner, match, player } = await setup()

    await expect(
      addEvent(deps, owner.id, match.id, {
        eventId: 'evt-1',
        playerId: player.id,
        statId: 'goles',
        delta: -1,
        videoMs: 0,
      }),
    ).rejects.toThrow(AppError)
  })

  it('bloquea a quien no es miembro del partido', async () => {
    const { deps, match, player } = await setup()
    const stranger = await findOrCreateUserFromGoogle(deps, {
      sub: 'g-stranger',
      email: 'nadie@example.com',
      name: 'Nadie',
      picture: null,
    })

    await expect(
      addEvent(deps, stranger.id, match.id, {
        eventId: 'evt-1',
        playerId: player.id,
        statId: 'goles',
        delta: 1,
        videoMs: 0,
      }),
    ).rejects.toThrow(AppError)
  })

  it('marca un gol cargado dos veces cerca en el video como posible duplicado', async () => {
    const { deps, owner, match, player } = await setup()

    const first = await addEvent(deps, owner.id, match.id, {
      eventId: 'evt-1',
      playerId: player.id,
      statId: 'goles',
      delta: 1,
      videoMs: 100_000,
    })
    const second = await addEvent(deps, owner.id, match.id, {
      eventId: 'evt-2',
      playerId: player.id,
      statId: 'goles',
      delta: 1,
      videoMs: 104_000,
    })

    expect(first.possibleDuplicateOf).toBeNull()
    expect(second.possibleDuplicateOf).toBe('evt-1')

    const flags = await deps.matches.listDuplicateFlags(match.id)
    expect(flags).toEqual({ 'evt-2': 'evt-1' })
  })

  it('no marca duplicado un pase cargado a los pocos segundos del anterior', async () => {
    const { deps, owner, match, player } = await setup()

    await addEvent(deps, owner.id, match.id, {
      eventId: 'evt-1',
      playerId: player.id,
      statId: 'pasesCompletados',
      delta: 1,
      videoMs: 100_000,
    })
    const { possibleDuplicateOf } = await addEvent(deps, owner.id, match.id, {
      eventId: 'evt-2',
      playerId: player.id,
      statId: 'pasesCompletados',
      delta: 1,
      videoMs: 100_500,
    })

    expect(possibleDuplicateOf).toBeNull()
  })

  it('no marca duplicada una corrección', async () => {
    const { deps, owner, match, player } = await setup()

    await addEvent(deps, owner.id, match.id, {
      eventId: 'evt-1',
      playerId: player.id,
      statId: 'goles',
      delta: 1,
      videoMs: 100_000,
    })
    const { possibleDuplicateOf } = await addEvent(deps, owner.id, match.id, {
      eventId: 'evt-2',
      playerId: player.id,
      statId: 'goles',
      delta: -1,
      videoMs: 100_500,
    })

    expect(possibleDuplicateOf).toBeNull()
  })

  it('permite que dos personas carguen al mismo jugador en el mismo partido', async () => {
    const { deps, owner, match, player } = await setup()
    const friend = await findOrCreateUserFromGoogle(deps, {
      sub: 'g-friend',
      email: 'profe@example.com',
      name: 'Profe',
      picture: null,
    })
    const inviteCode = (await deps.matches.listMeta([match.id]))[0]!.inviteCode
    await joinMatchByCode(deps, friend.id, inviteCode)

    await addEvent(deps, owner.id, match.id, {
      eventId: 'evt-1',
      playerId: player.id,
      statId: 'pasesCompletados',
      delta: 1,
      videoMs: 5000,
    })
    await addEvent(deps, friend.id, match.id, {
      eventId: 'evt-2',
      playerId: player.id,
      statId: 'pasesCompletados',
      delta: 1,
      videoMs: 300_000,
    })

    const stored = await deps.matches.findById(match.id)
    expect(stored?.events).toHaveLength(2)
    expect(stored?.events.map((event) => event.createdBy).sort()).toEqual(
      [owner.id, friend.id].sort(),
    )
  })
})

describe('removeEvent', () => {
  it('marca el evento como borrado con quién lo borró', async () => {
    const { deps, owner, match, player } = await setup()
    await addEvent(deps, owner.id, match.id, {
      eventId: 'evt-1',
      playerId: player.id,
      statId: 'goles',
      delta: 1,
      videoMs: 0,
    })

    await removeEvent(deps, owner.id, match.id, 'evt-1')

    const stored = await deps.matches.findById(match.id)
    const event = stored?.events.find((e) => e.id === 'evt-1')
    expect(event?.deletedAt).not.toBeNull()
    expect(event?.deletedBy).toBe(owner.id)
  })

  it('cualquier tagger puede borrar el evento de otro', async () => {
    const { deps, owner, match, player } = await setup()
    const friend = await findOrCreateUserFromGoogle(deps, {
      sub: 'g-friend',
      email: 'profe@example.com',
      name: 'Profe',
      picture: null,
    })
    const inviteCode = (await deps.matches.listMeta([match.id]))[0]!.inviteCode
    await joinMatchByCode(deps, friend.id, inviteCode)

    await addEvent(deps, owner.id, match.id, {
      eventId: 'evt-1',
      playerId: player.id,
      statId: 'goles',
      delta: 1,
      videoMs: 0,
    })

    await removeEvent(deps, friend.id, match.id, 'evt-1')

    const stored = await deps.matches.findById(match.id)
    expect(stored?.events.find((e) => e.id === 'evt-1')?.deletedBy).toBe(friend.id)
  })
})
