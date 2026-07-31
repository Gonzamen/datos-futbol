import { EventFeed } from './EventFeed.js'
import { PresencePanel } from './PresencePanel.js'
import { RosterPicker } from './RosterPicker.js'
import { Scoreboard } from './Scoreboard.js'
import { SegmentsPanel } from './SegmentsPanel.js'
import { StatPad } from './StatPad.js'
import { usePresenceBroadcast } from './usePresenceBroadcast.js'
import { VideoPanel } from './VideoPanel.js'
import type { VideoSource } from '../../shared/video/VideoSource.js'

interface TaggingViewProps {
  onSourceChange(value: { source: VideoSource | null; error: string | null }): void
}

export function TaggingView({ onSourceChange }: TaggingViewProps) {
  usePresenceBroadcast()

  return (
    <>
      <Scoreboard />
      <PresencePanel />

      <div className="tagging-layout">
        <div className="tagging-column">
          <VideoPanel onSourceChange={onSourceChange} />

          <div className="panel">
            <h2 className="panel__title">Últimos eventos</h2>
            <EventFeed />
          </div>
        </div>

        <div className="tagging-column">
          <div className="panel">
            <h2 className="panel__title">1. Elegí al jugador</h2>
            <RosterPicker />
          </div>

          <div className="panel">
            <h2 className="panel__title">2. Tocá lo que pasó</h2>
            <StatPad />
          </div>

          <div className="panel">
            <h2 className="panel__title">Tramos del video</h2>
            <SegmentsPanel />
          </div>
        </div>
      </div>
    </>
  )
}
