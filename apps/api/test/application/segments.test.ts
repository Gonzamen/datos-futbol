import { describe, expect, it } from 'vitest'
import { findOrCreateUserFromGoogle } from '../../src/application/auth/findOrCreateUserFromGoogle.js'
import { AppError } from '../../src/application/errors.js'
import { createMatch } from '../../src/application/matches/createMatch.js'
import { joinMatchByCode } from '../../src/application/matches/joinMatchByCode.js'
import { claimSegment } from '../../src/application/segments/claimSegment.js'
import { generateSegments } from '../../src/application/segments/generateSegments.js'
import { updateSegmentStatus } from '../../src/application/segments/updateSegmentStatus.js'
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
  const friend = await findOrCreateUserFromGoogle(deps, {
    sub: 'g-friend',
    email: 'profe@example.com',
    name: 'Profe',
    picture: null,
  })
  const inviteCode = (await deps.matches.listMeta([match.id]))[0]!.inviteCode
  await joinMatchByCode(deps, friend.id, inviteCode)

  return { deps, owner, friend, match }
}

describe('generateSegments', () => {
  it('divide el video en partes iguales', async () => {
    const { deps, owner, match } = await setup()

    const segments = await generateSegments(deps, owner.id, match.id, {
      durationMs: 900_000,
      count: 3,
    })

    expect(segments).toHaveLength(3)
    expect(segments[0]?.startMs).toBe(0)
    expect(segments[0]?.endMs).toBe(300_000)
    expect(segments[2]?.endMs).toBe(900_000)
    expect(segments.every((segment) => segment.status === 'pending')).toBe(true)
  })

  it('reemplaza los tramos anteriores', async () => {
    const { deps, owner, match } = await setup()

    await generateSegments(deps, owner.id, match.id, { durationMs: 600_000, count: 2 })
    const second = await generateSegments(deps, owner.id, match.id, {
      durationMs: 600_000,
      count: 4,
    })

    expect(await deps.segments.listForMatch(match.id)).toHaveLength(4)
    expect(second).toHaveLength(4)
  })

  it('rechaza una cantidad inválida de tramos', async () => {
    const { deps, owner, match } = await setup()

    await expect(
      generateSegments(deps, owner.id, match.id, { durationMs: 600_000, count: 0 }),
    ).rejects.toThrow(AppError)
  })
})

describe('claimSegment', () => {
  it('asigna el tramo a quien lo reclama', async () => {
    const { deps, owner, friend, match } = await setup()
    const [segment] = await generateSegments(deps, owner.id, match.id, {
      durationMs: 600_000,
      count: 2,
    })

    const claimed = await claimSegment(deps, friend.id, match.id, segment!.id)

    expect(claimed.assigneeUserId).toBe(friend.id)
    expect(claimed.status).toBe('in_progress')
  })

  it('rechaza reclamar un tramo que ya tiene dueño', async () => {
    const { deps, owner, friend, match } = await setup()
    const [segment] = await generateSegments(deps, owner.id, match.id, {
      durationMs: 600_000,
      count: 2,
    })

    await claimSegment(deps, owner.id, match.id, segment!.id)

    await expect(claimSegment(deps, friend.id, match.id, segment!.id)).rejects.toThrow(AppError)
  })

  it('reclamar el propio tramo de nuevo no es un error', async () => {
    const { deps, owner, match } = await setup()
    const [segment] = await generateSegments(deps, owner.id, match.id, {
      durationMs: 600_000,
      count: 2,
    })

    await claimSegment(deps, owner.id, match.id, segment!.id)

    await expect(claimSegment(deps, owner.id, match.id, segment!.id)).resolves.toMatchObject({
      assigneeUserId: owner.id,
    })
  })
})

describe('updateSegmentStatus', () => {
  it('marca completo un tramo propio', async () => {
    const { deps, owner, match } = await setup()
    const [segment] = await generateSegments(deps, owner.id, match.id, {
      durationMs: 600_000,
      count: 1,
    })
    await claimSegment(deps, owner.id, match.id, segment!.id)

    await updateSegmentStatus(deps, owner.id, match.id, segment!.id, 'done')

    const [stored] = await deps.segments.listForMatch(match.id)
    expect(stored?.status).toBe('done')
  })

  it('no deja marcar completo el tramo de otro', async () => {
    const { deps, owner, friend, match } = await setup()
    const [segment] = await generateSegments(deps, owner.id, match.id, {
      durationMs: 600_000,
      count: 1,
    })
    await claimSegment(deps, owner.id, match.id, segment!.id)

    await expect(
      updateSegmentStatus(deps, friend.id, match.id, segment!.id, 'done'),
    ).rejects.toThrow(AppError)
  })

  it('libera un tramo para que lo agarre otro', async () => {
    const { deps, owner, friend, match } = await setup()
    const [segment] = await generateSegments(deps, owner.id, match.id, {
      durationMs: 600_000,
      count: 1,
    })
    await claimSegment(deps, owner.id, match.id, segment!.id)

    await updateSegmentStatus(deps, owner.id, match.id, segment!.id, 'pending')

    const [stored] = await deps.segments.listForMatch(match.id)
    expect(stored?.assigneeUserId).toBeNull()
    expect(stored?.status).toBe('pending')

    await expect(claimSegment(deps, friend.id, match.id, segment!.id)).resolves.toMatchObject({
      assigneeUserId: friend.id,
    })
  })
})
