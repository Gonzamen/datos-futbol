export type PlaybackState = 'unstarted' | 'playing' | 'paused' | 'buffering' | 'ended'

/**
 * The video player, as the rest of the app sees it.
 *
 * Everything talks to this interface and never to YouTube directly, so swapping
 * in local files or another host later is one new implementation and no changes
 * anywhere else. It is deliberately imperative: the playhead moves many times a
 * second and pushing that through React state would re-render the whole tagging
 * screen for nothing. Components that display the time poll it; the ones that
 * record a statistic just ask for the position at the instant of the tap.
 */
export interface VideoSource {
  play(): void
  pause(): void
  togglePlay(): void
  seekTo(milliseconds: number): void
  seekBy(deltaMilliseconds: number): void
  getCurrentMs(): number
  getDurationMs(): number
  getPlaybackRate(): number
  setPlaybackRate(rate: number): void
  getState(): PlaybackState
  onStateChange(handler: (state: PlaybackState) => void): () => void
  destroy(): void
}

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const

/**
 * Steps the playhead one notch along {@link PLAYBACK_RATES}, staying inside the
 * range. Used by the speed shortcuts.
 */
export function nextPlaybackRate(current: number, direction: 1 | -1): number {
  const index = PLAYBACK_RATES.indexOf(current as (typeof PLAYBACK_RATES)[number])
  const from = index === -1 ? PLAYBACK_RATES.indexOf(1) : index
  const target = Math.min(Math.max(from + direction, 0), PLAYBACK_RATES.length - 1)

  return PLAYBACK_RATES[target] ?? 1
}

/**
 * mm:ss, or h:mm:ss once the video runs past an hour.
 */
export function formatVideoTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`
  }

  return `${pad(minutes)}:${pad(seconds)}`
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}
