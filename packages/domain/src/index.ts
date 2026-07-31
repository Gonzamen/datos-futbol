export {
  STAT_DEFINITIONS,
  DERIVED_SHOTS,
  findStat,
  findStatByKey,
  isStatId,
  statLabel,
} from './stats.js'
export type { StatDefinition, StatId, StatTone } from './stats.js'

export {
  activeEvents,
  addPlayer,
  applyEvent,
  cloneTeamsForNewMatch,
  countStat,
  createEvent,
  createMatch,
  createPlayer,
  createTeam,
  defaultEventFactory,
  defaultIdFactory,
  findPlayer,
  lastEventBy,
  matchTitle,
  removeEvent,
  removePlayer,
  roster,
} from './match.js'
export type { EventFactory, IdFactory, MatchDraft, PlayerLocation, StatChange } from './match.js'

export {
  ensurePerson,
  findPersonByName,
  normalizeName,
  renamePerson,
  suggestPeople,
} from './people.js'
export type { PersonFactory, RegistryChange } from './people.js'

export {
  SCORE_WEIGHTS,
  actionCount,
  comparePlayers,
  defensiveActions,
  dribbles,
  ratio,
  scoreOf,
  shots,
} from './scoring.js'

export { buildRanking, buildReport, emptyTotals, totalsByPlayer } from './projections.js'

export { DEDUPE_WINDOW_MS, findPossibleDuplicate } from './dedupe.js'
export type { DuplicateCandidate } from './dedupe.js'

export { buildAnalysis, formatPercent, formatScore } from './analysis.js'

export { CSV_BOM, buildCsv, buildJson, exportFileName } from './export.js'

export type {
  Highlight,
  Leader,
  Match,
  MatchEvent,
  MatchReport,
  Person,
  Player,
  PlayerMetrics,
  PlayerReport,
  RankedPlayer,
  Reading,
  StatTotals,
  Team,
  TeamMetrics,
  TeamReport,
  Totals,
  VideoProvider,
  VideoReference,
} from './types.js'
