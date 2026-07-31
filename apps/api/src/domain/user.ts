export interface User {
  id: string
  googleSub: string
  email: string
  name: string
  avatarUrl: string | null
  createdAt: number
}

export type MembershipRole = 'owner' | 'tagger' | 'viewer'

export interface Membership {
  matchId: string
  userId: string
  role: MembershipRole
  joinedAt: number
}

/** What "my matches" shows: enough to render a row without loading every event. */
export interface MatchSummary {
  matchId: string
  name: string
  date: string
  hasVideo: boolean
  role: MembershipRole
  memberCount: number
  eventCount: number
  inviteCode: string
}
