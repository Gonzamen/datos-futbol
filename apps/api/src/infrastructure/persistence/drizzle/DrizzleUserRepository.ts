import { eq } from 'drizzle-orm'
import type { UserRepository } from '../../../domain/ports/UserRepository.js'
import type { User } from '../../../domain/user.js'
import type { Database } from './client.js'
import { users } from './schema.js'

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async findByGoogleSub(googleSub: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.googleSub, googleSub)).limit(1)

    return row ? toUser(row) : null
  }

  async findById(userId: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1)
    return row ? toUser(row) : null
  }

  async create(user: User): Promise<void> {
    await this.db.insert(users).values({
      id: user.id,
      googleSub: user.googleSub,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: new Date(user.createdAt),
    })
  }
}

function toUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    googleSub: row.googleSub,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt.getTime(),
  }
}
