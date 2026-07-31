import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildAnalysis } from '../src/analysis.js'
import { buildCsv } from '../src/export.js'
import { buildReport } from '../src/projections.js'
import type { MatchReport, Reading } from '../src/types.js'
import { FIXTURES } from './fixtures/matches.js'
import type { FixtureName } from './fixtures/matches.js'

/**
 * Locks the TypeScript port to the numbers the original browser implementation
 * produced. The goldens were recorded by running assets/js under Node (see
 * tools/generate-golden.ts), so any drift in the ranking, the percentages or the
 * wording of a reading fails here instead of silently changing what the app
 * tells the players.
 */

const goldenDirectory = join(dirname(fileURLToPath(import.meta.url)), 'golden')

interface Golden {
  report: MatchReport
  analysis: Reading[]
  csv: string
}

function loadGolden(name: FixtureName): Golden {
  return JSON.parse(readFileSync(join(goldenDirectory, `${name}.json`), 'utf8')) as Golden
}

describe('paridad con la implementación original', () => {
  const names = Object.keys(FIXTURES) as FixtureName[]

  describe.each(names)('%s', (name) => {
    const match = FIXTURES[name]()
    const golden = loadGolden(name)
    const report = buildReport(match)

    it('produce los mismos totales por jugador', () => {
      expect(report.playerTotals).toEqual(golden.report.playerTotals)
    })

    it('produce los mismos totales por equipo', () => {
      expect(report.teams).toEqual(golden.report.teams)
    })

    it('produce el mismo ranking, en el mismo orden', () => {
      expect(report.ranking).toEqual(golden.report.ranking)
    })

    it('produce los mismos destacados y líderes', () => {
      expect(report.highlights).toEqual(golden.report.highlights)
      expect(report.leaders).toEqual(golden.report.leaders)
    })

    it('produce las mismas lecturas del análisis', () => {
      expect(buildAnalysis(report)).toEqual(golden.analysis)
    })

    it('exporta el mismo CSV, celda por celda', () => {
      expect(buildCsv(match)).toEqual(golden.csv)
    })
  })
})
