import { useEffect, useRef, useState } from 'react'
import { useMatchStore } from '../../shared/store/matchStore.js'
import { IconPause, IconPlay } from '../../shared/ui/icons.js'
import { parseVideoUrl } from '../../shared/video/parseVideoUrl.js'
import { usePlaybackState, useVideoTime } from '../../shared/video/VideoContext.js'
import { PLAYBACK_RATES, formatVideoTime } from '../../shared/video/VideoSource.js'
import type { VideoSource } from '../../shared/video/VideoSource.js'
import { YouTubeSource } from '../../shared/video/youtube.js'

interface VideoPanelProps {
  onSourceChange(value: { source: VideoSource | null; error: string | null }): void
}

export function VideoPanel({ onSourceChange }: VideoPanelProps) {
  const video = useMatchStore((state) => state.match!.video)
  const setVideo = useMatchStore((state) => state.setVideo)
  const [draft, setDraft] = useState('')
  const [inputError, setInputError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const videoId = video?.videoId ?? null

  useEffect(() => {
    const host = hostRef.current

    if (!videoId || !host) {
      return
    }

    let cancelled = false
    let created: VideoSource | null = null

    // The API replaces the element it is given, so it gets a throwaway child
    // instead of the container React owns.
    const mount = document.createElement('div')
    host.appendChild(mount)
    setLoadError(null)

    YouTubeSource.create(mount, videoId)
      .then((source) => {
        if (cancelled) {
          source.destroy()
          return
        }
        created = source
        onSourceChange({ source, error: null })
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setLoadError(error.message)
          onSourceChange({ source: null, error: error.message })
        }
      })

    return () => {
      cancelled = true
      created?.destroy()
      mount.remove()
      onSourceChange({ source: null, error: null })
    }
  }, [videoId, onSourceChange])

  function submit(event: React.FormEvent): void {
    event.preventDefault()
    const parsed = parseVideoUrl(draft)

    if (!parsed) {
      setInputError('No reconozco ese link. Pegá la URL del video de YouTube.')
      return
    }

    setInputError(null)
    setDraft('')
    setVideo(parsed)
  }

  if (!videoId) {
    return (
      <div className="panel video-panel video-panel--empty">
        <h2 className="panel__title">Cargá el video del partido</h2>
        <p className="panel__hint">
          Pegá el link de YouTube. Tiene que ser público o no listado: los videos privados no se
          pueden reproducir fuera de YouTube.
        </p>
        <form className="video-form" onSubmit={submit}>
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            aria-label="Link del video"
          />
          <button type="submit" className="btn btn--primary">
            Usar este video
          </button>
        </form>
        {inputError ? <p className="video-error">{inputError}</p> : null}
      </div>
    )
  }

  return (
    <div className="panel video-panel">
      <div className="video-frame" ref={hostRef} />
      <div className="video-panel__bar">
        {loadError ? <p className="video-error">{loadError}</p> : <VideoControls />}
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setVideo(null)}>
          Cambiar video
        </button>
      </div>
    </div>
  )
}

function VideoControls() {
  const currentMs = useVideoTime()
  const state = usePlaybackState()

  return (
    <div className="video-controls">
      <span className="video-time">{formatVideoTime(currentMs)}</span>
      <span className={`video-state video-state--${state}`}>
        {state === 'playing' ? <IconPlay /> : <IconPause />}
        {state === 'playing' ? 'Reproduciendo' : 'En pausa'}
      </span>
      <span className="video-hint">
        <kbd>Espacio</kbd> play · <kbd>←</kbd>
        <kbd>→</kbd> 5s · <kbd>Shift</kbd>+flechas 1s · <kbd>,</kbd>
        <kbd>.</kbd> velocidad ({PLAYBACK_RATES[0]}x–{PLAYBACK_RATES[PLAYBACK_RATES.length - 1]}x)
      </span>
    </div>
  )
}
