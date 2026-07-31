import type { Server as HttpServer } from 'node:http'
import type { Match, MatchEvent } from '@datos-futbol/domain'
import { Server as SocketServer } from 'socket.io'
import type { Socket } from 'socket.io'
import { verifySession } from '../auth/jwt.js'
import type { Dependencies } from '../../application/dependencies.js'
import type { Env } from '../../config/env.js'
import type { Segment } from '../../domain/segment.js'

function matchRoom(matchId: string): string {
  return `match:${matchId}`
}

/**
 * The write path stays REST — same validated, tested use cases as before.
 * Sockets exist purely to fan the result out to everyone else already looking
 * at the match, which is the one thing REST cannot do on its own: without
 * this, "cargando en simultáneo" would mean refreshing to see what somebody
 * else just counted. See PLAN.md §6 for the fuller ACK-based contract this
 * simplifies from.
 */
export interface RealtimeGateway {
  broadcastEventAdded(
    matchId: string,
    payload: { event: MatchEvent; possibleDuplicateOf: string | null },
  ): void
  broadcastEventRemoved(matchId: string, eventId: string): void
  broadcastMatchUpdated(matchId: string, match: Match): void
  broadcastSegmentsUpdated(matchId: string, segments: Segment[]): void
}

interface PresenceEntry {
  userId: string
  name: string
  videoMs: number
}

export function createRealtimeGateway(
  httpServer: HttpServer,
  env: Env,
  deps: Pick<Dependencies, 'memberships' | 'users'>,
): RealtimeGateway {
  const io = new SocketServer(httpServer, {
    cors: { origin: env.webOrigin, credentials: true },
  })

  const presenceByRoom = new Map<string, Map<string, PresenceEntry>>()

  io.use(async (socket, next) => {
    const userId = await authenticate(socket, env)

    if (!userId) {
      next(new Error('No autenticado'))
      return
    }

    socket.data.userId = userId
    next()
  })

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string

    socket.on('join', async ({ matchId }: { matchId: string }) => {
      const membership = await deps.memberships.find(matchId, userId)
      if (!membership) {
        return
      }

      await socket.join(matchRoom(matchId))
      socket.data.matchId = matchId

      const room = presenceByRoom.get(matchId)
      if (room) {
        socket.emit('presence:roster', [...room.values()])
      }
    })

    socket.on(
      'presence:position',
      async ({ matchId, videoMs }: { matchId: string; videoMs: number }) => {
        if (socket.data.matchId !== matchId) {
          return
        }

        const user = await deps.users.findById(userId)
        if (!user) {
          return
        }

        const room = presenceByRoom.get(matchId) ?? new Map<string, PresenceEntry>()
        room.set(userId, { userId, name: user.name, videoMs })
        presenceByRoom.set(matchId, room)

        socket.to(matchRoom(matchId)).emit('presence:update', { userId, name: user.name, videoMs })
      },
    )

    socket.on('disconnect', () => {
      const matchId = socket.data.matchId as string | undefined
      if (!matchId) {
        return
      }

      const room = presenceByRoom.get(matchId)
      room?.delete(userId)

      socket.to(matchRoom(matchId)).emit('presence:left', { userId })
    })
  })

  return {
    broadcastEventAdded(matchId, payload) {
      io.to(matchRoom(matchId)).emit('event:added', payload)
    },
    broadcastEventRemoved(matchId, eventId) {
      io.to(matchRoom(matchId)).emit('event:removed', { eventId })
    },
    broadcastMatchUpdated(matchId, match) {
      io.to(matchRoom(matchId)).emit('match:updated', { match })
    },
    broadcastSegmentsUpdated(matchId, segments) {
      io.to(matchRoom(matchId)).emit('segments:updated', { segments })
    },
  }
}

async function authenticate(socket: Socket, env: Env): Promise<string | null> {
  const cookieHeader = socket.handshake.headers.cookie

  if (!cookieHeader) {
    return null
  }

  const token = parseCookie(cookieHeader, 'df_session')
  if (!token) {
    return null
  }

  const session = await verifySession(env.jwtSecret, token)
  return session?.userId ?? null
}

function parseCookie(header: string, name: string): string | null {
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) {
      return decodeURIComponent(rest.join('='))
    }
  }
  return null
}
