import { normalizeName } from '@datos-futbol/domain'
import type { Person } from '@datos-futbol/domain'
import { invalid } from '../errors.js'
import type { Dependencies } from '../dependencies.js'

/**
 * Server-side counterpart of the domain's pure `ensurePerson`: same rule
 * — reuse the person if the name matches, register a new one otherwise —
 * but backed by the shared registry in Postgres instead of an array the
 * caller already had in memory.
 */
export async function resolvePerson(
  deps: Pick<Dependencies, 'people' | 'ids'>,
  name: string,
): Promise<Person> {
  const clean = name.trim().replace(/\s+/g, ' ')

  if (!clean) {
    throw invalid('El nombre no puede estar vacío.')
  }

  const existing = await deps.people.findByName(normalizeName(clean))

  if (existing) {
    return existing
  }

  const person: Person = { id: deps.ids.nextId(), name: clean, createdAt: deps.ids.now() }
  await deps.people.create(person)

  return person
}
