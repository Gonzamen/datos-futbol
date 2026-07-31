import type { Person } from '@datos-futbol/domain'
import { create } from 'zustand'
import { ApiError } from '../api/client.js'
import { peopleApi } from '../api/matches.js'

/**
 * The group roster, independent of any open match — reachable from the
 * match list so people can be added ahead of a match, not just while
 * building teams.
 */
export interface RosterState {
  people: Person[]
  loading: boolean
  error: string | null

  load(): Promise<void>
  add(name: string): Promise<boolean>
  rename(personId: string, name: string): Promise<boolean>
}

export const useRosterStore = create<RosterState>((set, get) => ({
  people: [],
  loading: false,
  error: null,

  async load() {
    set({ loading: true, error: null })

    try {
      const people = await peopleApi.search('')
      set({ people: sortByName(people), loading: false })
    } catch (error) {
      set({ loading: false, error: describeError(error) })
    }
  },

  async add(name) {
    const clean = name.trim()
    if (!clean) return false

    try {
      const person = await peopleApi.create(clean)
      set((state) => ({
        people: state.people.some((existing) => existing.id === person.id)
          ? state.people
          : sortByName([...state.people, person]),
      }))
      return true
    } catch (error) {
      set({ error: describeError(error) })
      return false
    }
  },

  async rename(personId, name) {
    const clean = name.trim()
    if (!clean) return false

    const previous = get().people
    set({
      people: sortByName(
        previous.map((person) => (person.id === personId ? { ...person, name: clean } : person)),
      ),
    })

    try {
      await peopleApi.rename(personId, clean)
      return true
    } catch (error) {
      set({ people: previous, error: describeError(error) })
      return false
    }
  },
}))

function sortByName(people: Person[]): Person[] {
  return [...people].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Error desconocido'
}
