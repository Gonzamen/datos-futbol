import type { User } from '../user.js'

export interface UserRepository {
  findByGoogleSub(googleSub: string): Promise<User | null>
  findById(userId: string): Promise<User | null>
  create(user: User): Promise<void>
}
