import { eq } from 'drizzle-orm'
import type { Person } from '@datos-futbol/domain'
import { normalizeName } from '@datos-futbol/domain'
import type { PersonRepository } from '../../../domain/ports/PersonRepository.js'
import type { Database } from './client.js'
import { people } from './schema.js'

export class DrizzlePersonRepository implements PersonRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<Person[]> {
    const rows = await this.db.select().from(people)
    return rows.map(toPerson)
  }

  /**
   * Normalization (accents, case, spacing) happens in the domain package, not
   * in SQL: matching it in Postgres would mean duplicating that rule with
   * `unaccent`/`lower`, and the two would eventually disagree. The registry is
   * small enough that comparing in application code costs nothing that
   * matters.
   */
  async findByName(normalizedName: string): Promise<Person | null> {
    const rows = await this.db.select().from(people)
    return (
      rows.map(toPerson).find((person) => normalizeName(person.name) === normalizedName) ?? null
    )
  }

  async create(person: Person): Promise<void> {
    await this.db.insert(people).values({
      id: person.id,
      name: person.name,
      createdAt: new Date(person.createdAt),
    })
  }

  async rename(personId: string, name: string): Promise<void> {
    await this.db.update(people).set({ name }).where(eq(people.id, personId))
  }
}

function toPerson(row: typeof people.$inferSelect): Person {
  return { id: row.id, name: row.name, createdAt: row.createdAt.getTime() }
}
