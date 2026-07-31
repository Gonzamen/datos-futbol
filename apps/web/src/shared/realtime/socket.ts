import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

/**
 * One connection per open match, not one for the whole app session: switching
 * matches disconnects and reconnects rather than juggling multiple room
 * memberships on a shared socket, which would risk a stale match's events
 * leaking into the one currently open.
 */
export function connectMatchSocket(): Socket {
  return io(SOCKET_URL, { withCredentials: true })
}
