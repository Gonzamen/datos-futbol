import type { Segment } from '../../domain/segment.js'
import { invalid } from '../errors.js'
import type { Dependencies } from '../dependencies.js'
import { assertCanWrite } from '../matches/assertMembership.js'

export interface GenerateSegmentsInput {
  durationMs: number
  count: number
}

/**
 * Splits the video into `count` equal segments, replacing whatever segments
 * existed before.
 *
 * The plan's fuller vision lets a pending segment be split further when
 * somebody joins mid-match, without disturbing segments already claimed or
 * finished. That finer-grained redivision is left for later: what ships here
 * is the coordination people actually need on day one — see who owns which
 * stretch, claim one, mark it done — with a full reset as the escape hatch
 * when the group composition changes. Regenerating is a deliberate action the
 * owner takes, not something that happens silently underneath in-progress
 * work.
 */
export async function generateSegments(
  deps: Pick<Dependencies, 'matches' | 'memberships' | 'segments' | 'ids'>,
  userId: string,
  matchId: string,
  input: GenerateSegmentsInput,
): Promise<Segment[]> {
  await assertCanWrite(deps, matchId, userId)

  if (input.count < 1 || input.durationMs <= 0) {
    throw invalid('Hace falta la duración del video y al menos un tramo.')
  }

  const step = Math.floor(input.durationMs / input.count)
  const segments: Segment[] = []

  for (let index = 0; index < input.count; index += 1) {
    const startMs = index * step
    const endMs = index === input.count - 1 ? input.durationMs : startMs + step

    segments.push({
      id: deps.ids.nextId(),
      matchId,
      label: `${formatMs(startMs)}–${formatMs(endMs)}`,
      startMs,
      endMs,
      assigneeUserId: null,
      status: 'pending',
      position: index,
    })
  }

  await deps.segments.replaceAll(matchId, segments)

  return segments
}

function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
