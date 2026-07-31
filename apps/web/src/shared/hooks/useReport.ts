import { buildAnalysis, buildReport } from '@datos-futbol/domain'
import type { MatchReport, Reading } from '@datos-futbol/domain'
import { useMemo } from 'react'
import { useMatchStore } from '../store/matchStore.js'

export interface DerivedMatch {
  report: MatchReport
  analysis: Reading[]
}

/**
 * Every number on screen, recomputed from the event log.
 *
 * Deriving the whole report on each change rather than keeping counters means
 * what is displayed can never drift from what was counted. At the scale of a
 * match this is a fraction of a millisecond, and memoising on the match object
 * keeps it off the render path while nothing changes.
 *
 * Only meant to be called once a match is loaded — `App` gates the tagging
 * screen behind that, so `match` being null here is a wiring bug, not a state
 * to render around.
 */
export function useReport(): DerivedMatch {
  const match = useMatchStore((state) => state.match)

  return useMemo(() => {
    if (!match) {
      throw new Error('useReport called before a match was loaded')
    }
    const report = buildReport(match)
    return { report, analysis: buildAnalysis(report) }
  }, [match])
}
