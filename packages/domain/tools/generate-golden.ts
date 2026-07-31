import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FIXTURES } from '../test/fixtures/matches.js'
import type { FixtureName } from '../test/fixtures/matches.js'
import type { Match, MatchReport, Reading } from '../src/types.js'

/**
 * Runs the original browser implementation under Node and records what it
 * produces for each fixture. Those recordings are the contract the TypeScript
 * port has to meet: the refactor is only safe if the ranking, the percentages
 * and the readings come out identical, and eyeballing them is not enough.
 *
 * The sources in `test/legacy/` are a frozen copy of the app this project
 * replaced. They are a test fixture, not code that runs anywhere: nothing
 * imports them except this script. They stay until the backend work is done and
 * the domain stops changing, then they and this script go too — the goldens
 * they produced can outlive them.
 *
 * Re-run with `npm run golden -w @datos-futbol/domain` only when the old
 * behaviour is intentionally superseded.
 */

interface LegacyNamespace {
  statsCalculator: { buildReport(match: Match): MatchReport }
  matchAnalysis: { build(report: MatchReport): Reading[] }
  exporter: { buildCsv(match: Match): string }
}

const here = dirname(fileURLToPath(import.meta.url))
const legacyDirectory = join(here, '..', 'test', 'legacy')
const goldenDirectory = join(here, '..', 'test', 'golden')

const LEGACY_FILES = ['domain.js', 'stats-calculator.js', 'match-analysis.js', 'exporter.js']

function loadLegacy(): LegacyNamespace {
  const windowStub: Record<string, unknown> = { console }

  for (const file of LEGACY_FILES) {
    const source = readFileSync(join(legacyDirectory, file), 'utf8')
    new Function('window', source)(windowStub)
  }

  const namespace = windowStub['DatosFutbol'] as LegacyNamespace | undefined

  if (!namespace?.statsCalculator || !namespace.matchAnalysis || !namespace.exporter) {
    throw new Error('No se pudo cargar la implementación original desde assets/js')
  }

  return namespace
}

function main(): void {
  const legacy = loadLegacy()
  mkdirSync(goldenDirectory, { recursive: true })

  for (const [name, buildMatch] of Object.entries(FIXTURES) as Array<[FixtureName, () => Match]>) {
    const match = buildMatch()
    const report = legacy.statsCalculator.buildReport(match)
    const analysis = legacy.matchAnalysis.build(report)
    const csv = legacy.exporter.buildCsv(match)

    writeFileSync(
      join(goldenDirectory, `${name}.json`),
      `${JSON.stringify({ report, analysis, csv }, null, 2)}\n`,
      'utf8',
    )

    console.log(
      `${name}: ${match.events.length} eventos, ${report.ranking.length} en el ranking, ${analysis.length} lecturas, ${csv.split('\r\n').length} filas de CSV`,
    )
  }
}

main()
