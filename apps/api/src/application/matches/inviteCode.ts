import { randomInt } from 'node:crypto'

/**
 * Six characters, read out loud over WhatsApp without confusion: no 0/O, no
 * 1/I/L. Collisions are handled by the caller retrying against the repository
 * — cheap enough at this scale not to need a reservation table.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const LENGTH = 6

export function generateInviteCode(): string {
  let code = ''

  for (let i = 0; i < LENGTH; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)]
  }

  return code
}
