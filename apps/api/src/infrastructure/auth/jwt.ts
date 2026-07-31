import { SignJWT, jwtVerify } from 'jose'
import type { JWTPayload } from 'jose'

const ALGORITHM = 'HS256'
const SESSION_DURATION = '30d'

export interface SessionPayload extends JWTPayload {
  userId: string
}

export async function signSession(secret: string, payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(new TextEncoder().encode(secret))
}

/** @returns The session, or null when the token is missing, expired, or tampered with. */
export async function verifySession(secret: string, token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    return typeof payload.userId === 'string' ? { userId: payload.userId } : null
  } catch {
    return null
  }
}
