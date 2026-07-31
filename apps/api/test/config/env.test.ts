import { describe, expect, it } from 'vitest'
import { loadEnv } from '../../src/config/env.js'

const complete = {
  DATABASE_URL: 'postgres://localhost:5432/df',
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3001/auth/google/callback',
  JWT_SECRET: 'secret',
}

describe('loadEnv', () => {
  it('falla nombrando la variable que falta', () => {
    expect(() => loadEnv({ ...complete, DATABASE_URL: undefined })).toThrow(/DATABASE_URL/)
  })

  it('usa cookies lax y no seguras por defecto, para desarrollo sobre http', () => {
    const env = loadEnv({ ...complete })

    expect(env.cookieSameSite).toBe('lax')
    expect(env.cookieSecure).toBe(false)
  })

  it('acepta cookies cross-site cuando además son seguras', () => {
    const env = loadEnv({ ...complete, COOKIE_SAMESITE: 'none', COOKIE_SECURE: 'true' })

    expect(env.cookieSameSite).toBe('none')
  })

  it('rechaza cookies cross-site sin secure, porque el navegador las descarta', () => {
    expect(() => loadEnv({ ...complete, COOKIE_SAMESITE: 'none' })).toThrow(/COOKIE_SECURE/)
  })

  it('rechaza un sameSite que no existe', () => {
    expect(() => loadEnv({ ...complete, COOKIE_SAMESITE: 'strict' })).toThrow(/COOKIE_SAMESITE/)
  })
})
