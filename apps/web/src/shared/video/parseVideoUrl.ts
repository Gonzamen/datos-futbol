import type { VideoReference } from '@datos-futbol/domain'

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
])

const BARE_ID = /^[\w-]{11}$/

/**
 * Accepts whatever people actually paste: a full watch URL, a share link, an
 * embed URL, a live URL, or the bare eleven character id.
 *
 * @returns The video reference, or null when nothing recognisable is in there.
 */
export function parseVideoUrl(input: string): VideoReference | null {
  const text = input.trim()

  if (!text) {
    return null
  }

  if (BARE_ID.test(text)) {
    return { provider: 'youtube', videoId: text }
  }

  const url = toUrl(text)

  if (!url || !YOUTUBE_HOSTS.has(url.hostname)) {
    return null
  }

  const videoId = url.hostname.endsWith('youtu.be')
    ? url.pathname.slice(1)
    : (url.searchParams.get('v') ?? lastPathSegment(url.pathname))

  return BARE_ID.test(videoId) ? { provider: 'youtube', videoId } : null
}

export function videoUrl(video: VideoReference): string {
  return `https://www.youtube.com/watch?v=${video.videoId}`
}

/** A link straight to the moment of a play, for sharing outside the app. */
export function videoUrlAt(video: VideoReference, milliseconds: number): string {
  return `${videoUrl(video)}&t=${Math.max(0, Math.floor(milliseconds / 1000))}`
}

function toUrl(text: string): URL | null {
  try {
    return new URL(text.startsWith('http') ? text : `https://${text}`)
  } catch {
    return null
  }
}

function lastPathSegment(pathname: string): string {
  return pathname.split('/').filter(Boolean).pop() ?? ''
}
