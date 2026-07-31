import { suggestPeople } from '@datos-futbol/domain'
import type { Person } from '@datos-futbol/domain'
import type { Dependencies } from '../dependencies.js'

export async function searchPeople(
  deps: Pick<Dependencies, 'people'>,
  query: string,
  limit = 8,
): Promise<Person[]> {
  return suggestPeople(await deps.people.list(), query, limit)
}
