import { useEffect } from 'react'
import { useMatchStore } from '../../shared/store/matchStore.js'
import { useVideo } from '../../shared/video/VideoContext.js'

const REPORT_INTERVAL_MS = 4000

/**
 * Tells the room where in the video this browser is, every few seconds — not
 * on every frame, since nobody needs sub-second precision to see "está en el
 * minuto 12" and polling that often would just be noise on the socket.
 */
export function usePresenceBroadcast(): void {
  const { source } = useVideo()
  const reportPosition = useMatchStore((state) => state.reportPosition)

  useEffect(() => {
    if (!source) return

    const timer = window.setInterval(() => {
      reportPosition(source.getCurrentMs())
    }, REPORT_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [source, reportPosition])
}
