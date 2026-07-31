import {
  applyEvent,
  createEvent,
  findPlayer,
  lastEventBy,
  removeEvent as domainRemoveEvent,
  roster,
} from '@datos-futbol/domain'
import type { Match, MatchEvent, Person, StatId, VideoReference } from '@datos-futbol/domain'
import { create } from 'zustand'
import type { Socket } from 'socket.io-client'
import { ApiError } from '../api/client.js'
import { matchesApi, peopleApi } from '../api/matches.js'
import { segmentsApi } from '../api/segments.js'
import type { Segment } from '../api/segments.js'
import { connectMatchSocket } from '../realtime/socket.js'

export interface PresenceEntry {
  userId: string
  name: string
  videoMs: number
}

/**
 * There is exactly one match open at a time — same as phase 1 — except now
 * "open" means loaded from the server instead of read from localStorage.
 * Counting a stat applies instantly (optimistic) and reconciles with the
 * server in the background; team and roster edits are rarer, so they just
 * await the request before updating anything, which is simpler and still
 * feels immediate at that frequency.
 *
 * Writes go over REST, same validated use cases as before; a socket joined to
 * the match's room is what turns "guardado" into "visto por todos al
 * instante" — see shared/realtime/socket.ts.
 */
export interface AppState {
  match: Match | null
  people: Person[]
  segments: Segment[]
  presence: Record<string, PresenceEntry>
  duplicateFlags: Record<string, string>
  selectedPlayerId: string | null
  currentUserId: string | null
  loading: boolean
  loadError: string | null
  toast: string | null

  openMatch(matchId: string, currentUserId: string): Promise<void>
  closeMatch(): void

  count(playerId: string, statId: StatId, delta: number, videoMs: number | null): void
  undo(): void
  deleteEvent(eventId: string): void

  selectPlayer(playerId: string): void
  moveSelection(step: number): void

  setMatchName(name: string): void
  setMatchDate(date: string): void
  setVideo(video: VideoReference | null): void

  addPlayerToTeam(teamId: string, name: string): Promise<boolean>
  renamePlayer(playerId: string, name: string): void
  dropPlayer(playerId: string): void
  setTeamName(teamId: string, name: string): void
  setTeamColor(teamId: string, color: string): void

  generateSegments(durationMs: number, count: number): Promise<void>
  claimSegment(segmentId: string): Promise<void>
  completeSegment(segmentId: string): Promise<void>
  releaseSegment(segmentId: string): Promise<void>

  reportPosition(videoMs: number): void

  showToast(message: string): void
  dismissToast(): void
}

let socket: Socket | null = null

export const useMatchStore = create<AppState>((set, get) => ({
  match: null,
  people: [],
  segments: [],
  presence: {},
  duplicateFlags: {},
  selectedPlayerId: null,
  currentUserId: null,
  loading: false,
  loadError: null,
  toast: null,

  async openMatch(matchId, currentUserId) {
    set({ loading: true, loadError: null, currentUserId })

    try {
      const [{ match, duplicateFlags }, people, segments] = await Promise.all([
        matchesApi.get(matchId),
        peopleApi.search(''),
        segmentsApi.list(matchId),
      ])

      set({
        match,
        people,
        segments,
        duplicateFlags,
        presence: {},
        selectedPlayerId: firstPlayerId(match),
        loading: false,
      })

      connectRealtime(matchId, set, get)
    } catch (error) {
      set({ loading: false, loadError: describeError(error) })
    }
  },

  closeMatch() {
    socket?.disconnect()
    socket = null
    set({
      match: null,
      people: [],
      segments: [],
      presence: {},
      duplicateFlags: {},
      selectedPlayerId: null,
      loadError: null,
    })
  },

  count(playerId, statId, delta, videoMs) {
    const { match, currentUserId, segments } = get()
    if (!match) return

    const eventId = crypto.randomUUID()
    const event = createEvent(
      match,
      { playerId, statId, delta, videoMs, createdBy: currentUserId },
      { nextId: () => eventId, now: () => Date.now() },
    )

    if (!event) return

    if (videoMs !== null && isOutsideOwnSegment(segments, currentUserId, videoMs)) {
      get().showToast('Estás cargando fuera de tu tramo asignado')
    }

    set({ match: applyEvent(match, event) })

    matchesApi
      .addEvent(match.id, { eventId, playerId, statId, delta, videoMs })
      .then((result) => {
        if (result.possibleDuplicateOf) {
          set((state) => ({
            duplicateFlags: { ...state.duplicateFlags, [eventId]: result.possibleDuplicateOf! },
          }))
        }
      })
      .catch((error: unknown) => {
        revertMatch(get, set, match)
        get().showToast(`No se pudo guardar: ${describeError(error)}`)
      })
  },

  undo() {
    const { match, currentUserId } = get()
    if (!match) return

    const target = lastEventBy(match, currentUserId)
    if (!target) {
      get().showToast('No hay nada para deshacer')
      return
    }

    const player = findPlayer(match, target.playerId)
    const removedAt = Date.now()

    set({ match: domainRemoveEvent(match, target.id, currentUserId, removedAt) })
    get().showToast(`Deshecho: ${player?.player.name ?? '?'}`)

    matchesApi.removeEvent(match.id, target.id).catch((error: unknown) => {
      revertMatch(get, set, match)
      get().showToast(`No se pudo deshacer: ${describeError(error)}`)
    })
  },

  deleteEvent(eventId) {
    const { match, currentUserId } = get()
    if (!match) return

    set({ match: domainRemoveEvent(match, eventId, currentUserId, Date.now()) })

    matchesApi.removeEvent(match.id, eventId).catch((error: unknown) => {
      revertMatch(get, set, match)
      get().showToast(`No se pudo borrar: ${describeError(error)}`)
    })
  },

  selectPlayer(playerId) {
    set({ selectedPlayerId: playerId })
  },

  moveSelection(step) {
    const { match, selectedPlayerId } = get()
    if (!match) return

    const ids = roster(match).map(({ player }) => player.id)
    if (!ids.length) return

    const index = ids.indexOf(selectedPlayerId ?? '')
    const next = (index + step + ids.length) % ids.length

    set({ selectedPlayerId: ids[next] ?? null })
  },

  setMatchName(name) {
    const { match } = get()
    if (!match) return

    set({ match: { ...match, name } })
    matchesApi.updateInfo(match.id, { name }).catch((error: unknown) => {
      get().showToast(`No se pudo guardar el nombre: ${describeError(error)}`)
    })
  },

  setMatchDate(date) {
    const { match } = get()
    if (!match) return

    set({ match: { ...match, date } })
    matchesApi.updateInfo(match.id, { date }).catch((error: unknown) => {
      get().showToast(`No se pudo guardar la fecha: ${describeError(error)}`)
    })
  },

  setVideo(video) {
    const { match } = get()
    if (!match) return

    set({ match: { ...match, video } })
    matchesApi.updateInfo(match.id, { video }).catch((error: unknown) => {
      get().showToast(`No se pudo guardar el video: ${describeError(error)}`)
    })
  },

  async addPlayerToTeam(teamId, name) {
    const { match } = get()
    if (!match || !name.trim()) return false

    try {
      const player = await matchesApi.addPlayer(match.id, teamId, name)
      const updatedMatch = {
        ...match,
        teams: match.teams.map((team) =>
          team.id === teamId ? { ...team, players: [...team.players, player] } : team,
        ),
      }
      const people = await peopleApi.search('')

      set({
        match: updatedMatch,
        people,
        selectedPlayerId: get().selectedPlayerId ?? player.id,
      })
      return true
    } catch (error) {
      get().showToast(`No se pudo sumar el jugador: ${describeError(error)}`)
      return false
    }
  },

  renamePlayer(playerId, name) {
    const { match } = get()
    const clean = name.trim()
    if (!match || !clean) return

    set({
      match: {
        ...match,
        teams: match.teams.map((team) => ({
          ...team,
          players: team.players.map((player) =>
            player.id === playerId ? { ...player, name: clean } : player,
          ),
        })),
      },
    })

    matchesApi.renamePlayer(match.id, playerId, clean).catch((error: unknown) => {
      get().showToast(`No se pudo renombrar: ${describeError(error)}`)
    })
  },

  dropPlayer(playerId) {
    const { match, selectedPlayerId } = get()
    if (!match) return

    const updated = {
      ...match,
      teams: match.teams.map((team) => ({
        ...team,
        players: team.players.filter((player) => player.id !== playerId),
      })),
      events: match.events.filter((event) => event.playerId !== playerId),
    }

    set({
      match: updated,
      selectedPlayerId: selectedPlayerId === playerId ? firstPlayerId(updated) : selectedPlayerId,
    })

    matchesApi.removePlayer(match.id, playerId).catch((error: unknown) => {
      get().showToast(`No se pudo quitar al jugador: ${describeError(error)}`)
    })
  },

  setTeamName(teamId, name) {
    const { match } = get()
    if (!match) return

    set({
      match: {
        ...match,
        teams: match.teams.map((team) => (team.id === teamId ? { ...team, name } : team)),
      },
    })
    matchesApi.updateTeam(match.id, teamId, { name }).catch(() => undefined)
  },

  setTeamColor(teamId, color) {
    const { match } = get()
    if (!match) return

    set({
      match: {
        ...match,
        teams: match.teams.map((team) => (team.id === teamId ? { ...team, color } : team)),
      },
    })
    matchesApi.updateTeam(match.id, teamId, { color }).catch(() => undefined)
  },

  async generateSegments(durationMs, count) {
    const { match } = get()
    if (!match) return

    try {
      const segments = await segmentsApi.generate(match.id, durationMs, count)
      set({ segments })
    } catch (error) {
      get().showToast(`No se pudieron crear los tramos: ${describeError(error)}`)
    }
  },

  async claimSegment(segmentId) {
    const { match } = get()
    if (!match) return

    try {
      await segmentsApi.claim(match.id, segmentId)
      set({ segments: await segmentsApi.list(match.id) })
    } catch (error) {
      get().showToast(`No se pudo agarrar el tramo: ${describeError(error)}`)
    }
  },

  async completeSegment(segmentId) {
    const { match } = get()
    if (!match) return

    try {
      await segmentsApi.complete(match.id, segmentId)
      set({ segments: await segmentsApi.list(match.id) })
    } catch (error) {
      get().showToast(`No se pudo completar el tramo: ${describeError(error)}`)
    }
  },

  async releaseSegment(segmentId) {
    const { match } = get()
    if (!match) return

    try {
      await segmentsApi.release(match.id, segmentId)
      set({ segments: await segmentsApi.list(match.id) })
    } catch (error) {
      get().showToast(`No se pudo liberar el tramo: ${describeError(error)}`)
    }
  },

  reportPosition(videoMs) {
    const { match } = get()
    if (!match || !socket) return
    socket.emit('presence:position', { matchId: match.id, videoMs })
  },

  showToast(message) {
    set({ toast: message })
  },

  dismissToast() {
    set({ toast: null })
  },
}))

/**
 * Joins the match's room and wires every broadcast to the same `set`/`get`
 * the REST-driven actions use, so a change from somebody else updates the
 * screen through the exact same state shape a local change would.
 */
function connectRealtime(
  matchId: string,
  set: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void,
  get: () => AppState,
): void {
  socket?.disconnect()
  socket = connectMatchSocket()
  socket.emit('join', { matchId })

  socket.on('event:added', (payload: { event: MatchEvent; possibleDuplicateOf: string | null }) => {
    const { match } = get()
    if (!match || match.id !== matchId) return

    set({ match: applyEvent(match, payload.event) })

    if (payload.possibleDuplicateOf) {
      set((state) => ({
        duplicateFlags: {
          ...state.duplicateFlags,
          [payload.event.id]: payload.possibleDuplicateOf!,
        },
      }))
    }
  })

  socket.on('event:removed', ({ eventId }: { eventId: string }) => {
    const { match } = get()
    if (!match || match.id !== matchId) return

    set({ match: domainRemoveEvent(match, eventId, null, Date.now()) })
    set((state) => {
      const flags = { ...state.duplicateFlags }
      delete flags[eventId]
      for (const key of Object.keys(flags)) {
        if (flags[key] === eventId) delete flags[key]
      }
      return { duplicateFlags: flags }
    })
  })

  socket.on('match:updated', ({ match: updated }: { match: Match }) => {
    if (get().match?.id === updated.id) {
      set({ match: updated })
    }
  })

  socket.on('segments:updated', ({ segments }: { segments: Segment[] }) => {
    set({ segments })
  })

  socket.on('presence:roster', (list: PresenceEntry[]) => {
    set({ presence: Object.fromEntries(list.map((entry) => [entry.userId, entry])) })
  })

  socket.on('presence:update', (entry: PresenceEntry) => {
    set((state) => ({ presence: { ...state.presence, [entry.userId]: entry } }))
  })

  socket.on('presence:left', ({ userId }: { userId: string }) => {
    set((state) => {
      const presence = { ...state.presence }
      delete presence[userId]
      return { presence }
    })
  })
}

/** Puts back the match as it was before an optimistic update that failed. */
function revertMatch(
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
  previous: Match,
) {
  if (get().match?.id === previous.id) {
    set({ match: previous })
  }
}

function firstPlayerId(match: Match): string | null {
  return roster(match)[0]?.player.id ?? null
}

/**
 * Warn-only check (see PLAN.md §4.3): if the current user has a segment of
 * their own still open, flag counting outside its range — but never block,
 * since redividing segments mid-match is normal and events land wherever the
 * video actually is.
 */
function isOutsideOwnSegment(
  segments: Segment[],
  currentUserId: string | null,
  videoMs: number,
): boolean {
  const own = segments.filter(
    (segment) => segment.assigneeUserId === currentUserId && segment.status !== 'done',
  )

  if (own.length === 0) return false

  return !own.some((segment) => videoMs >= segment.startMs && videoMs < segment.endMs)
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Error desconocido'
}
