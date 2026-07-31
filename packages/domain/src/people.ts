import type { Person } from './types.js'

/**
 * The registry of everybody who plays with the group.
 *
 * Rosters change from one weekend to the next, so matches cannot be the place
 * where a player's identity lives. Matching by name would fall apart on the
 * first "Gonchi" / "gonchi" / "Gonchí": one person would show up as three in the
 * season table. The registry gives each person a stable id once, and every match
 * points at it.
 */

/**
 * Reduces a name to the form used for comparison: no surrounding blanks, no
 * repeated spaces, no case, no accents. Only for lookups — never store this,
 * people write their nicknames the way they want them shown.
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function findPersonByName(people: Person[], name: string): Person | null {
  const target = normalizeName(name)

  if (!target) {
    return null
  }

  return people.find((person) => normalizeName(person.name) === target) ?? null
}

export interface PersonFactory {
  nextId(): string
  now(): number
}

export interface RegistryChange {
  people: Person[]
  person: Person
  created: boolean
}

/**
 * Resolves a typed name to a person, adding them to the registry when it is
 * somebody new. This is what backs the autocomplete in the team editor: there is
 * no separate screen to manage people, they get registered as they are picked
 * for a match.
 *
 * @returns The updated registry and the resolved person, or null when the name
 *   is blank.
 */
export function ensurePerson(
  people: Person[],
  name: string,
  factory: PersonFactory,
): RegistryChange | null {
  const clean = name.trim().replace(/\s+/g, ' ')

  if (!clean) {
    return null
  }

  const existing = findPersonByName(people, clean)

  if (existing) {
    return { people, person: existing, created: false }
  }

  const person: Person = { id: factory.nextId(), name: clean, createdAt: factory.now() }

  return { people: [...people, person], person, created: true }
}

/**
 * Names offered while typing, best match first: the ones that start with what
 * was typed, then the ones that merely contain it.
 */
export function suggestPeople(people: Person[], query: string, limit = 8): Person[] {
  const target = normalizeName(query)

  if (!target) {
    return [...people].sort(byName).slice(0, limit)
  }

  const starts: Person[] = []
  const contains: Person[] = []

  for (const person of people) {
    const candidate = normalizeName(person.name)

    if (candidate.startsWith(target)) {
      starts.push(person)
    } else if (candidate.includes(target)) {
      contains.push(person)
    }
  }

  return [...starts.sort(byName), ...contains.sort(byName)].slice(0, limit)
}

export function renamePerson(people: Person[], personId: string, name: string): Person[] {
  const clean = name.trim().replace(/\s+/g, ' ')

  if (!clean) {
    return people
  }

  return people.map((person) => (person.id === personId ? { ...person, name: clean } : person))
}

function byName(first: Person, second: Person): number {
  return first.name.localeCompare(second.name)
}
