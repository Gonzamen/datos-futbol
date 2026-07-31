import type { User } from '../../domain/user.js'
import type { Dependencies } from '../dependencies.js'

export interface GoogleProfile {
  sub: string
  email: string
  name: string
  picture: string | null
}

/**
 * The Google account is the identity; nothing else about a person is required
 * to start using the app. First login creates the account, every later one
 * just resolves it — there is no separate "sign up" step to fall out of sync
 * with "log in".
 */
export async function findOrCreateUserFromGoogle(
  deps: Pick<Dependencies, 'users' | 'ids'>,
  profile: GoogleProfile,
): Promise<User> {
  const existing = await deps.users.findByGoogleSub(profile.sub)

  if (existing) {
    return existing
  }

  const user: User = {
    id: deps.ids.nextId(),
    googleSub: profile.sub,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.picture,
    createdAt: deps.ids.now(),
  }

  await deps.users.create(user)

  return user
}
