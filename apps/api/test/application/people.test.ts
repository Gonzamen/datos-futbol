import { describe, expect, it } from 'vitest'
import { findOrCreateUserFromGoogle } from '../../src/application/auth/findOrCreateUserFromGoogle.js'
import { createMatch } from '../../src/application/matches/createMatch.js'
import { renamePerson } from '../../src/application/people/renamePerson.js'
import { resolvePerson } from '../../src/application/people/resolvePerson.js'
import { searchPeople } from '../../src/application/people/searchPeople.js'
import { addPlayer } from '../../src/application/teams/addPlayer.js'
import { removePlayer } from '../../src/application/teams/removePlayer.js'
import { renamePlayer } from '../../src/application/teams/renamePlayer.js'
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

  return { deps, owner, match }
}

describe('addPlayer', () => {
  it('registra a la persona en el grupo la primera vez', async () => {
    const { deps, owner, match } = await setup()

    await addPlayer(deps, owner.id, match.id, match.teams[0]!.id, 'Pollo')

    expect((await deps.people.list()).map((p) => p.name)).toEqual(['Pollo'])
  })

  it('reusa a la misma persona en un partido distinto', async () => {
    const { deps, owner, match } = await setup()
    const other = await createMatch(deps, { ownerId: owner.id, date: '2026-08-06' })

    const first = await addPlayer(deps, owner.id, match.id, match.teams[0]!.id, 'Pollo')
    const second = await addPlayer(deps, owner.id, other.id, other.teams[0]!.id, 'pollo')

    expect(second.personId).toBe(first.personId)
    expect(await deps.people.list()).toHaveLength(1)
  })
})

describe('renamePlayer', () => {
  it('actualiza el nombre en el partido y en el registro', async () => {
    const { deps, owner, match } = await setup()
    const player = await addPlayer(deps, owner.id, match.id, match.teams[0]!.id, 'Pollo')

    await renamePlayer(deps, owner.id, match.id, player.id, 'Gonzalo')

    const stored = await deps.matches.findById(match.id)
    const storedPlayer = stored?.teams[0]?.players.find((p) => p.id === player.id)
    expect(storedPlayer?.name).toBe('Gonzalo')

    const person = await deps.people.findByName('gonzalo')
    expect(person?.id).toBe(player.personId)
  })
})

describe('removePlayer', () => {
  it('saca al jugador de este partido sin borrar a la persona del registro', async () => {
    const { deps, owner, match } = await setup()
    const player = await addPlayer(deps, owner.id, match.id, match.teams[0]!.id, 'Pollo')

    await removePlayer(deps, owner.id, match.id, player.id)

    const stored = await deps.matches.findById(match.id)
    expect(stored?.teams[0]?.players).toHaveLength(0)
    expect(await deps.people.list()).toHaveLength(1)
  })
})

describe('resolvePerson', () => {
  it('da de alta a alguien nuevo sin necesidad de un partido', async () => {
    const { deps } = await setup()

    const person = await resolvePerson(deps, 'Pollo')

    expect(await deps.people.list()).toEqual([person])
  })

  it('rechaza un nombre vacío', async () => {
    const { deps } = await setup()

    await expect(resolvePerson(deps, '   ')).rejects.toThrow('El nombre no puede estar vacío.')
  })
})

describe('renamePerson', () => {
  it('actualiza el nombre en el registro', async () => {
    const { deps } = await setup()
    const person = await resolvePerson(deps, 'Pollo')

    await renamePerson(deps, person.id, 'Gonzalo')

    expect(await deps.people.findByName('gonzalo')).toMatchObject({ id: person.id })
  })

  it('rechaza un nombre vacío', async () => {
    const { deps } = await setup()
    const person = await resolvePerson(deps, 'Pollo')

    await expect(renamePerson(deps, person.id, '  ')).rejects.toThrow(
      'El nombre no puede estar vacío.',
    )
  })
})

describe('searchPeople', () => {
  it('sugiere primero a quienes empiezan con lo escrito', async () => {
    const { deps, owner, match } = await setup()
    await addPlayer(deps, owner.id, match.id, match.teams[0]!.id, 'Gonchi')
    await addPlayer(deps, owner.id, match.id, match.teams[0]!.id, 'Gonza')
    await addPlayer(deps, owner.id, match.id, match.teams[1]!.id, 'Profe')

    expect((await searchPeople(deps, 'gon')).map((p) => p.name)).toEqual(['Gonchi', 'Gonza'])
  })
})
