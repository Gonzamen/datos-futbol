import { beforeEach, describe, expect, it } from 'vitest'
import {
  ensurePerson,
  findPersonByName,
  normalizeName,
  renamePerson,
  suggestPeople,
} from '../src/people.js'
import type { PersonFactory } from '../src/people.js'
import type { Person } from '../src/types.js'

function sequentialFactory(): PersonFactory {
  let sequence = 0
  return {
    nextId: () => `person-${(sequence += 1)}`,
    now: () => 1_700_000_000_000 + sequence,
  }
}

function registry(...names: string[]): Person[] {
  return names.map((name, index) => ({
    id: `person-${index + 1}`,
    name,
    createdAt: 1_700_000_000_000 + index,
  }))
}

describe('normalizeName', () => {
  it('ignora mayúsculas, acentos y espacios de más', () => {
    expect(normalizeName('  Gonchí   Pérez ')).toBe('gonchi perez')
    expect(normalizeName('GONCHI')).toBe(normalizeName('gonchi'))
  })
})

describe('findPersonByName', () => {
  const people = registry('Gonchi', 'Profe')

  it('encuentra a la persona aunque esté escrita distinto', () => {
    expect(findPersonByName(people, 'gonchi')?.id).toBe('person-1')
    expect(findPersonByName(people, ' GONCHÍ ')?.id).toBe('person-1')
  })

  it('no inventa coincidencias', () => {
    expect(findPersonByName(people, 'Tincho')).toBeNull()
    expect(findPersonByName(people, '   ')).toBeNull()
  })
})

describe('ensurePerson', () => {
  let factory: PersonFactory

  beforeEach(() => {
    factory = sequentialFactory()
  })

  it('da de alta a alguien que nunca jugó', () => {
    const change = ensurePerson([], 'Tincho', factory)

    expect(change?.created).toBe(true)
    expect(change?.person.name).toBe('Tincho')
    expect(change?.people).toHaveLength(1)
  })

  it('reusa a la persona cuando ya está en el registro', () => {
    const people = registry('Gonchi')
    const change = ensurePerson(people, 'gonchi', factory)

    expect(change?.created).toBe(false)
    expect(change?.person.id).toBe('person-1')
    expect(change?.people).toBe(people)
  })

  it('conserva el nombre como lo escribieron, no como se compara', () => {
    const change = ensurePerson([], '  Juan   Cruz  ', factory)

    expect(change?.person.name).toBe('Juan Cruz')
  })

  it('no da de alta un nombre vacío', () => {
    expect(ensurePerson([], '   ', factory)).toBeNull()
  })

  it('no muta el registro que recibe', () => {
    const people = registry('Gonchi')
    ensurePerson(people, 'Tincho', factory)

    expect(people).toHaveLength(1)
  })
})

describe('suggestPeople', () => {
  const people = registry('Gonchi', 'Gonza', 'Profe', 'Facundo')

  it('prioriza los que empiezan con lo escrito', () => {
    expect(suggestPeople(people, 'gon').map((person) => person.name)).toEqual(['Gonchi', 'Gonza'])
  })

  it('después ofrece los que lo contienen', () => {
    expect(suggestPeople(people, 'cu').map((person) => person.name)).toEqual(['Facundo'])
  })

  it('sin nada escrito ofrece a todos por orden alfabético', () => {
    expect(suggestPeople(people, '').map((person) => person.name)).toEqual([
      'Facundo',
      'Gonchi',
      'Gonza',
      'Profe',
    ])
  })

  it('respeta el límite', () => {
    expect(suggestPeople(people, '', 2)).toHaveLength(2)
  })
})

describe('renamePerson', () => {
  it('cambia el nombre en el registro', () => {
    const people = renamePerson(registry('Gonchi'), 'person-1', 'Gonzalo')

    expect(people[0]?.name).toBe('Gonzalo')
  })

  it('ignora un nombre en blanco', () => {
    const people = registry('Gonchi')

    expect(renamePerson(people, 'person-1', '  ')).toBe(people)
  })
})
