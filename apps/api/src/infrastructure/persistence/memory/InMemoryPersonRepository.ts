import { normalizeName } from '@datos-futbol/domain'
import type { Person } from '@datos-futbol/domain'
import type { PersonRepository } from '../../../domain/ports/PersonRepository.js'

export class InMemoryPersonRepository implements PersonRepository {
  private readonly people = new Map<string, Person>()

  async list(): Promise<Person[]> {
    return [...this.people.values()]
  }

  async findByName(normalizedName: string): Promise<Person | null> {
    return (
      [...this.people.values()].find((person) => normalizeName(person.name) === normalizedName) ??
      null
    )
  }

  async create(person: Person): Promise<void> {
    this.people.set(person.id, person)
  }

  async rename(personId: string, name: string): Promise<void> {
    const person = this.people.get(personId)
    if (person) {
      this.people.set(personId, { ...person, name })
    }
  }
}
