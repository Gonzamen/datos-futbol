import type { Env } from '../../config/env.js'
import type { GoogleProfile } from '../../application/auth/findOrCreateUserFromGoogle.js'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
const SCOPES = ['openid', 'email', 'profile']

export function buildGoogleAuthorizationUrl(env: Env, state: string): string {
  const url = new URL(AUTH_URL)

  url.searchParams.set('client_id', env.googleClientId)
  url.searchParams.set('redirect_uri', env.googleRedirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES.join(' '))
  url.searchParams.set('state', state)
  url.searchParams.set('access_type', 'online')
  url.searchParams.set('prompt', 'select_account')

  return url.toString()
}

interface TokenResponse {
  access_token: string
}

interface UserInfoResponse {
  sub: string
  email: string
  name: string
  picture?: string
}

/**
 * Trades the one-time authorization code for a profile. Two network calls,
 * both to Google, both required by the OAuth authorization-code flow: there is
 * no way to skip the token exchange and go straight to the profile.
 */
export async function exchangeCodeForProfile(env: Env, code: string): Promise<GoogleProfile> {
  const tokenResponse = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: env.googleRedirectUri,
    }),
  })

  if (!tokenResponse.ok) {
    throw new Error(`Google rechazó el intercambio de código (${tokenResponse.status}).`)
  }

  const { access_token: accessToken } = (await tokenResponse.json()) as TokenResponse

  const profileResponse = await fetch(USERINFO_URL, {
    headers: { authorization: `Bearer ${accessToken}` },
  })

  if (!profileResponse.ok) {
    throw new Error(`Google rechazó la consulta de perfil (${profileResponse.status}).`)
  }

  const profile = (await profileResponse.json()) as UserInfoResponse

  return {
    sub: profile.sub,
    email: profile.email,
    name: profile.name,
    picture: profile.picture ?? null,
  }
}
