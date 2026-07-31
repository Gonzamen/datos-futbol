import type { UserRepository } from '../../../domain/ports/UserRepository.js'
import type { User } from '../../../domain/user.js'

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>()

  async findByGoogleSub(googleSub: string): Promise<User | null> {
    return [...this.users.values()].find((user) => user.googleSub === googleSub) ?? null
  }

  async findById(userId: string): Promise<User | null> {
    return this.users.get(userId) ?? null
  }

  async create(user: User): Promise<void> {
    this.users.set(user.id, user)
  }
}
