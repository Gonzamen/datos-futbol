import { createMatch as buildMatch, createTeam } from '@datos-futbol/domain'
import type { Match } from '@datos-futbol/domain'
import type { Dependencies } from '../dependencies.js'
import { generateInviteCode } from './inviteCode.js'

const TEAM_COLORS = ['#f0a52a', '#5cb85c']
const TEAM_NAMES = ['Equipo 1', 'Equipo 2']
const MAX_CODE_ATTEMPTS = 5

export interface CreateMatchInput {
  ownerId: string
  name?: string
  date: string
}

/**
 * A brand new match: two empty teams, ready for whoever creates it to start
 * typing in players, same shape {@link @datos-futbol/domain}'s
 * `createEmptyMatch` gives the offline app.
 */
export async function createMatch(deps: Dependencies, input: CreateMatchInput): Promise<Match> {
  const teams = TEAM_NAMES.map((name, index) =>
    createTeam(name, TEAM_COLORS[index] ?? '#4da3ff', [], deps.ids),
  )

  const match = buildMatch({ name: input.name, date: input.date, teams }, deps.ids)
  const inviteCode = await reserveInviteCode(deps)

  await deps.matches.create(match, inviteCode)
  await deps.memberships.add({
    matchId: match.id,
    userId: input.ownerId,
    role: 'owner',
    joinedAt: deps.ids.now(),
  })

  return match
}

async function reserveInviteCode(deps: Dependencies): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateInviteCode()

    if (!(await deps.matches.findByInviteCode(code))) {
      return code
    }
  }

  throw new Error('No se pudo generar un código de invitación único.')
}
