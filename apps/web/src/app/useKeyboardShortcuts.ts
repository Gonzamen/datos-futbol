import { findStatByKey } from '@datos-futbol/domain'
import { useEffect } from 'react'
import { useVideo } from '../shared/video/VideoContext.js'
import { nextPlaybackRate } from '../shared/video/VideoSource.js'
import { useMatchStore } from '../shared/store/matchStore.js'

const SEEK_STEP_MS = 5000
const FINE_SEEK_STEP_MS = 1000

/**
 * Counting a match is a two-handed job: one hand drives the video, the other
 * records what just happened. Everything is on the keyboard so neither hand has
 * to go looking for the mouse.
 *
 * Space, the arrows and the speed keys drive the player; the stat keys count for
 * the selected player. Nothing fires while the focus is in a text field, so
 * typing a name never counts a goal.
 */
export function useKeyboardShortcuts(): void {
  const { source } = useVideo()

  useEffect(() => {
    function handle(event: KeyboardEvent): void {
      if (isTyping(event.target)) {
        return
      }

      const store = useMatchStore.getState()

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        store.undo()
        return
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return
      }

      switch (event.key) {
        case ' ':
          event.preventDefault()
          source?.togglePlay()
          return
        case 'ArrowLeft':
          event.preventDefault()
          source?.seekBy(event.shiftKey ? -FINE_SEEK_STEP_MS : -SEEK_STEP_MS)
          return
        case 'ArrowRight':
          event.preventDefault()
          source?.seekBy(event.shiftKey ? FINE_SEEK_STEP_MS : SEEK_STEP_MS)
          return
        case 'ArrowUp':
          event.preventDefault()
          store.moveSelection(-1)
          return
        case 'ArrowDown':
          event.preventDefault()
          store.moveSelection(1)
          return
        case ',':
          event.preventDefault()
          source?.setPlaybackRate(nextPlaybackRate(source.getPlaybackRate(), -1))
          return
        case '.':
          event.preventDefault()
          source?.setPlaybackRate(nextPlaybackRate(source.getPlaybackRate(), 1))
          return
        default:
          break
      }

      const stat = findStatByKey(event.key)

      if (stat && store.selectedPlayerId) {
        event.preventDefault()
        store.count(store.selectedPlayerId, stat.id, 1, source?.getCurrentMs() ?? null)
      }
    }

    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [source])
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}
