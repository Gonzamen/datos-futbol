import { config } from 'dotenv'

config()

/**
 * Reads and validates the environment once at boot, so a missing variable
 * fails immediately with a clear message instead of surfacing as a confusing
 * error the first time a request touches it.
 */
export type CookieSameSite = 'lax' | 'none'

export interface Env {
  databaseUrl: string
  googleClientId: string
  googleClientSecret: string
  googleRedirectUri: string
  jwtSecret: string
  webOrigin: string
  port: number
  cookieSecure: boolean
  cookieSameSite: CookieSameSite
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const cookieSecure = source.COOKIE_SECURE === 'true'

  return {
    databaseUrl: required(source, 'DATABASE_URL'),
    googleClientId: required(source, 'GOOGLE_CLIENT_ID'),
    googleClientSecret: required(source, 'GOOGLE_CLIENT_SECRET'),
    googleRedirectUri: required(source, 'GOOGLE_REDIRECT_URI'),
    jwtSecret: required(source, 'JWT_SECRET'),
    webOrigin: source.WEB_ORIGIN ?? 'http://localhost:5173',
    port: Number(source.PORT ?? 3001),
    cookieSecure,
    cookieSameSite: cookieSameSite(source, cookieSecure),
  }
}

/**
 * With the web and the API on different domains — Vercel and Railway — the
 * session cookie only travels if it is `SameSite=None`, and browsers reject
 * that without `Secure`. Failing at boot beats deploying something where
 * login silently never sticks.
 */
function cookieSameSite(source: NodeJS.ProcessEnv, cookieSecure: boolean): CookieSameSite {
  const value = source.COOKIE_SAMESITE ?? 'lax'

  if (value !== 'lax' && value !== 'none') {
    throw new Error(`COOKIE_SAMESITE tiene que ser "lax" o "none", no "${value}".`)
  }

  if (value === 'none' && !cookieSecure) {
    throw new Error('COOKIE_SAMESITE=none necesita COOKIE_SECURE=true: el navegador la rechaza.')
  }

  return value
}

function required(source: NodeJS.ProcessEnv, key: string): string {
  const value = source[key]

  if (!value) {
    throw new Error(`Falta la variable de entorno ${key}. Copiá .env.example a .env y completala.`)
  }

  return value
}
