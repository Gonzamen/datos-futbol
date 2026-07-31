import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { PlaybackState, VideoSource } from './VideoSource.js'

interface VideoContextValue {
  source: VideoSource | null
  error: string | null
}

const VideoContext = createContext<VideoContextValue>({ source: null, error: null })

export const VideoProvider = VideoContext.Provider

export function useVideo(): VideoContextValue {
  return useContext(VideoContext)
}

/**
 * The playhead, sampled for display only.
 *
 * The video position changes continuously, and putting it in shared state would
 * re-render the tagging screen several times a second for a clock nobody is
 * watching that closely. Components that need to show the time subscribe here at
 * a low rate; anything that needs the exact position at a point in time reads
 * `source.getCurrentMs()` on the spot instead.
 */
export function useVideoTime(hertz = 4): number {
  const { source } = useVideo()
  const [milliseconds, setMilliseconds] = useState(0)

  useEffect(() => {
    if (!source) {
      return
    }

    const timer = window.setInterval(() => {
      setMilliseconds(source.getCurrentMs())
    }, 1000 / hertz)

    return () => window.clearInterval(timer)
  }, [source, hertz])

  return milliseconds
}

export function usePlaybackState(): PlaybackState {
  const { source } = useVideo()
  const [state, setState] = useState<PlaybackState>('unstarted')

  useEffect(() => {
    if (!source) {
      return
    }

    setState(source.getState())
    return source.onStateChange(setState)
  }, [source])

  return state
}

/**
 * Reads the current position without subscribing to it, for the moment a
 * statistic is recorded.
 */
export function useCurrentMsReader(): () => number | null {
  const { source } = useVideo()
  const ref = useRef(source)
  ref.current = source

  return () => ref.current?.getCurrentMs() ?? null
}
