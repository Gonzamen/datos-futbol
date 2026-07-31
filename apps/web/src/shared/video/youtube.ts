import type { PlaybackState, VideoSource } from './VideoSource.js'

/**
 * VideoSource backed by the YouTube IFrame API.
 *
 * Two details that are easy to get wrong and expensive to debug:
 *
 * - The player is created with `disablekb: 1`. Without it the iframe swallows
 *   the number keys and the whole stat pad stops responding whenever the video
 *   has focus.
 * - Only public and unlisted videos can be embedded. Private ones fail to load
 *   here even for an account that can watch them on youtube.com, which is why
 *   {@link YouTubeSource.create} rejects on an error from the player instead of
 *   leaving the screen blank.
 */

interface YouTubePlayer {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  getPlaybackRate(): number
  setPlaybackRate(rate: number): void
  destroy(): void
}

interface YouTubeNamespace {
  Player: new (element: HTMLElement, options: PlayerOptions) => YouTubePlayer
}

interface PlayerOptions {
  videoId: string
  playerVars: Record<string, number | string>
  events: {
    onReady(): void
    onStateChange(event: { data: number }): void
    onError(event: { data: number }): void
  }
}

declare global {
  interface Window {
    YT?: YouTubeNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

const STATES: Record<number, PlaybackState> = {
  [-1]: 'unstarted',
  0: 'ended',
  1: 'playing',
  2: 'paused',
  3: 'buffering',
  5: 'unstarted',
}

const ERROR_MESSAGES: Record<number, string> = {
  2: 'El id del video no es válido.',
  5: 'El reproductor de YouTube no pudo abrir este video.',
  100: 'El video no existe o es privado. Tiene que ser público o no listado.',
  101: 'El dueño del video no permite reproducirlo fuera de YouTube.',
  150: 'El dueño del video no permite reproducirlo fuera de YouTube.',
}

/**
 * How long a requested position keeps overriding what the player reports.
 *
 * `getCurrentTime()` lags behind `seekTo` by a fraction of a second, so holding
 * an arrow key would otherwise compute every jump from the same stale position
 * and silently drop most of them.
 */
const SEEK_SETTLE_MS = 600

export class YouTubeSource implements VideoSource {
  private state: PlaybackState = 'unstarted'
  private readonly handlers = new Set<(state: PlaybackState) => void>()
  private pendingSeekMs: number | null = null
  private pendingSeekAt = 0

  private constructor(private readonly player: YouTubePlayer) {}

  static async create(container: HTMLElement, videoId: string): Promise<YouTubeSource> {
    const namespace = await loadApi()

    return new Promise((resolve, reject) => {
      let source: YouTubeSource | null = null

      const player = new namespace.Player(container, {
        videoId,
        playerVars: {
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            source = new YouTubeSource(player)
            resolve(source)
          },
          onStateChange: (event) => {
            source?.handleStateChange(event.data)
          },
          onError: (event) => {
            reject(new Error(ERROR_MESSAGES[event.data] ?? 'No se pudo cargar el video.'))
          },
        },
      })
    })
  }

  play(): void {
    this.player.playVideo()
  }

  pause(): void {
    this.player.pauseVideo()
  }

  togglePlay(): void {
    if (this.state === 'playing' || this.state === 'buffering') {
      this.pause()
      return
    }
    this.play()
  }

  seekTo(milliseconds: number): void {
    const duration = this.getDurationMs()
    const bounded = Math.max(0, duration > 0 ? Math.min(milliseconds, duration) : milliseconds)

    this.pendingSeekMs = bounded
    this.pendingSeekAt = Date.now()
    this.player.seekTo(bounded / 1000, true)
  }

  seekBy(deltaMilliseconds: number): void {
    this.seekTo(this.requestedMs() + deltaMilliseconds)
  }

  getCurrentMs(): number {
    return Math.round(this.player.getCurrentTime() * 1000)
  }

  /**
   * Where the video is heading: the last requested position while it settles,
   * and the reported one after that.
   */
  private requestedMs(): number {
    if (this.pendingSeekMs !== null && Date.now() - this.pendingSeekAt < SEEK_SETTLE_MS) {
      return this.pendingSeekMs
    }

    this.pendingSeekMs = null
    return this.getCurrentMs()
  }

  getDurationMs(): number {
    return Math.round(this.player.getDuration() * 1000)
  }

  getPlaybackRate(): number {
    return this.player.getPlaybackRate()
  }

  setPlaybackRate(rate: number): void {
    this.player.setPlaybackRate(rate)
  }

  getState(): PlaybackState {
    return this.state
  }

  onStateChange(handler: (state: PlaybackState) => void): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  destroy(): void {
    this.handlers.clear()
    this.player.destroy()
  }

  private handleStateChange(code: number): void {
    this.state = STATES[code] ?? 'unstarted'
    for (const handler of this.handlers) {
      handler(this.state)
    }
  }
}

let pending: Promise<YouTubeNamespace> | null = null

function loadApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT)
  }

  pending ??= new Promise<YouTubeNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady

    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT?.Player) {
        resolve(window.YT)
      } else {
        reject(new Error('La API de YouTube cargó incompleta.'))
      }
    }

    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.onerror = () => reject(new Error('No se pudo cargar la API de YouTube.'))
    document.head.appendChild(script)
  })

  return pending
}
