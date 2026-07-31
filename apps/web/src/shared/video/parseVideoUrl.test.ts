import { describe, expect, it } from 'vitest'
import { parseVideoUrl, videoUrlAt } from './parseVideoUrl.js'

describe('parseVideoUrl', () => {
  const id = 'dQw4w9WgXcQ'

  it.each([
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=120`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://youtu.be/${id}?t=90`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/live/${id}`,
    `www.youtube.com/watch?v=${id}`,
    `  https://www.youtube.com/watch?v=${id}  `,
    id,
  ])('reconoce %s', (input) => {
    expect(parseVideoUrl(input)).toEqual({ provider: 'youtube', videoId: id })
  })

  it.each([
    '',
    '   ',
    'https://vimeo.com/12345',
    'https://www.youtube.com/watch?v=corto',
    'cualquier cosa',
  ])('rechaza %s', (input) => {
    expect(parseVideoUrl(input)).toBeNull()
  })
})

describe('videoUrlAt', () => {
  it('arma un link al segundo de la jugada', () => {
    const video = { provider: 'youtube', videoId: 'dQw4w9WgXcQ' } as const

    expect(videoUrlAt(video, 743_400)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=743')
  })

  it('no genera segundos negativos', () => {
    const video = { provider: 'youtube', videoId: 'dQw4w9WgXcQ' } as const

    expect(videoUrlAt(video, -5000)).toContain('&t=0')
  })
})
