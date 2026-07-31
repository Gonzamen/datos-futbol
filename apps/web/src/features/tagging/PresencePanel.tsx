import { useMatchStore } from '../../shared/store/matchStore.js'
import { useVideo } from '../../shared/video/VideoContext.js'
import { formatVideoTime } from '../../shared/video/VideoSource.js'

/**
 * Who else is here right now, and roughly where in the video — the thing that
 * makes it obvious you and a friend are both about to tag the same minute.
 */
export function PresencePanel() {
  const presence = useMatchStore((state) => state.presence)
  const currentUserId = useMatchStore((state) => state.currentUserId)
  const { source } = useVideo()
  const others = Object.values(presence).filter((entry) => entry.userId !== currentUserId)

  if (!source || !others.length) {
    return null
  }

  return (
    <ul className="presence">
      {others.map((entry) => (
        <li className="presence__item" key={entry.userId}>
          <span className="presence__dot" />
          {entry.name}
          <span className="presence__time">{formatVideoTime(entry.videoMs)}</span>
        </li>
      ))}
    </ul>
  )
}
