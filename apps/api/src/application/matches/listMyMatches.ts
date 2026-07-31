import type { MatchSummary } from '../../domain/user.js'
import type { Dependencies } from '../dependencies.js'

/**
 * Composes two repositories on purpose: membership (who can see what, and
 * their role) and match metadata are separate concerns with separate storage,
 * and this is the one place that joins them for the "Mis partidos" screen.
 */
export async function listMyMatches(
  deps: Pick<Dependencies, 'memberships' | 'matches'>,
  userId: string,
): Promise<MatchSummary[]> {
  const memberships = await deps.memberships.listForUser(userId)

  if (!memberships.length) {
    return []
  }

  const matchIds = memberships.map((membership) => membership.matchId)

  const [metas, memberCounts] = await Promise.all([
    deps.matches.listMeta(matchIds),
    countMembersPerMatch(deps, matchIds),
  ])

  const metaByMatchId = new Map(metas.map((meta) => [meta.matchId, meta]))

  return memberships.flatMap((membership) => {
    const meta = metaByMatchId.get(membership.matchId)

    if (!meta) {
      return []
    }

    return [
      {
        matchId: meta.matchId,
        name: meta.name,
        date: meta.date,
        hasVideo: meta.hasVideo,
        role: membership.role,
        memberCount: memberCounts.get(membership.matchId) ?? 1,
        eventCount: meta.eventCount,
        inviteCode: meta.inviteCode,
      },
    ]
  })
}

async function countMembersPerMatch(
  deps: Pick<Dependencies, 'memberships'>,
  matchIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()

  await Promise.all(
    matchIds.map(async (matchId) => {
      const members = await deps.memberships.listForMatch(matchId)
      counts.set(matchId, members.length)
    }),
  )

  return counts
}
