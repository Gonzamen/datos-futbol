import type { Person } from '@datos-futbol/domain'

/**
 * The registry is shared by everybody, not scoped to one match or one owner:
 * the whole point is that the same "Pollo" resolves to the same person no
 * matter who is running the tagging screen that day.
 */
export interface PersonRepository {
  list(): Promise<Person[]>
  findByName(normalizedName: string): Promise<Person | null>
  create(person: Person): Promise<void>
  rename(personId: string, name: string): Promise<void>
}
