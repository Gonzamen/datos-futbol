(function (global) {
  'use strict';

  /**
   * Statistics tracked per player. Order defines the on-screen layout, and each
   * entry carries the keyboard shortcut that counts it.
   */
  var STAT_DEFINITIONS = [
    { id: 'pasesCompletados', label: 'Pases Completados', short: 'Pase OK', icon: '🎯', tone: 'positive', key: '1' },
    { id: 'pasesErrados', label: 'Pases Errados', short: 'Pase errado', icon: '✖', tone: 'negative', key: '2' },
    { id: 'disparosAlArco', label: 'Disparos al Arco', short: 'Al arco', icon: '🥅', tone: 'positive', key: '3' },
    { id: 'disparosErrados', label: 'Disparos Errados', short: 'Disparo afuera', icon: '📉', tone: 'negative', key: '4' },
    { id: 'goles', label: 'Goles', short: 'Gol', icon: '⚽', tone: 'highlight', key: '5' },
    { id: 'asistencias', label: 'Asistencias', short: 'Asistencia', icon: '🅰', tone: 'highlight', key: '6' },
    { id: 'intercepciones', label: 'Intercepción de Pase', short: 'Intercepción', icon: '✋', tone: 'positive', key: '7' },
    { id: 'robosDePelota', label: 'Robo de Pelota', short: 'Robo', icon: '🥷', tone: 'positive', key: '8' },
    { id: 'regatesExitosos', label: 'Regate Exitoso', short: 'Regate OK', icon: '🌀', tone: 'positive', key: '9' },
    { id: 'regatesFallidos', label: 'Regate Fallido', short: 'Regate errado', icon: '🚧', tone: 'negative', key: '0' },
    { id: 'golesEvitados', label: 'Goles Evitados', short: 'Gol evitado', icon: '🧱', tone: 'highlight', key: 'E' },
    { id: 'atajadas', label: 'Atajadas', short: 'Atajada', icon: '🧤', tone: 'positive', key: 'A' },
    { id: 'burradas', label: 'Burradas', short: 'Burrada', icon: '🤦', tone: 'negative', key: 'B' }
  ];

  var DEFAULT_TEAMS = [
    {
      name: 'Caramelo de Polla',
      color: '#f0a52a',
      players: ['Pollo', 'Brn', 'Manu', 'Lanza', 'Joaco', 'Axel', 'Gonchi']
    },
    {
      name: 'Caramelo de Embutido',
      color: '#5cb85c',
      players: ['Profe', 'Verde', 'Kuki', 'Lea', 'Facu', 'Puya', 'Ale']
    }
  ];

  /**
   * Creates a match with the default rosters, ready to be counted.
   * @returns {object} A new match aggregate.
   */
  function createMatch() {
    return {
      id: createId('match'),
      name: '',
      date: today(),
      createdAt: Date.now(),
      clock: { elapsedMs: 0, running: false, startedAt: null },
      teams: DEFAULT_TEAMS.map(function (team) {
        return createTeam(team.name, team.color, team.players);
      }),
      events: []
    };
  }

  /**
   * @param {string} name Team name.
   * @param {string} color Hex color used across the UI.
   * @param {string[]} playerNames Initial roster.
   * @returns {object} A new team.
   */
  function createTeam(name, color, playerNames) {
    return {
      id: createId('team'),
      name: name,
      color: color,
      players: (playerNames || []).map(createPlayer)
    };
  }

  /**
   * @param {string} name Player name.
   * @returns {object} A new player.
   */
  function createPlayer(name) {
    return { id: createId('player'), name: name };
  }

  /**
   * Records a statistic change. Every count in the app is derived from this
   * event log, so corrections are just events with a negative delta.
   * @param {object} match Match aggregate (mutated).
   * @param {{playerId: string, statId: string, delta: number}} change
   * @returns {object|null} The stored event, or null when the change is invalid.
   */
  function addEvent(match, change) {
    var player = findPlayer(match, change.playerId);
    if (!player || !findStat(change.statId)) {
      return null;
    }

    var totals = countStat(match, change.playerId, change.statId);
    if (totals + change.delta < 0) {
      return null;
    }

    var event = {
      id: createId('event'),
      playerId: change.playerId,
      teamId: player.team.id,
      statId: change.statId,
      delta: change.delta,
      clockMs: currentClockMs(match),
      at: Date.now()
    };
    match.events.push(event);
    return event;
  }

  /**
   * Removes the most recent event.
   * @param {object} match Match aggregate (mutated).
   * @returns {object|null} The discarded event.
   */
  function undoLastEvent(match) {
    return match.events.pop() || null;
  }

  /**
   * @param {object} match Match aggregate.
   * @param {string} playerId
   * @param {string} statId
   * @returns {number} Current value for that player and statistic.
   */
  function countStat(match, playerId, statId) {
    return match.events.reduce(function (total, event) {
      var matches = event.playerId === playerId && event.statId === statId;
      return matches ? total + event.delta : total;
    }, 0);
  }

  /**
   * @param {object} match Match aggregate.
   * @param {string} playerId
   * @returns {{id: string, name: string, team: object}|null}
   */
  function findPlayer(match, playerId) {
    for (var i = 0; i < match.teams.length; i += 1) {
      var team = match.teams[i];
      for (var j = 0; j < team.players.length; j += 1) {
        if (team.players[j].id === playerId) {
          return { id: team.players[j].id, name: team.players[j].name, team: team };
        }
      }
    }
    return null;
  }

  /**
   * @param {string} statId
   * @returns {object|undefined} The statistic definition.
   */
  function findStat(statId) {
    return STAT_DEFINITIONS.filter(function (stat) {
      return stat.id === statId;
    })[0];
  }

  /**
   * Names a statistic for display. Matches counted before a statistic was
   * retired keep their events, so the fallback has to stay readable.
   * @param {string} statId
   * @returns {string} Label shown to the user.
   */
  function statLabel(statId) {
    var stat = findStat(statId);
    return stat ? stat.label : 'Estadística eliminada';
  }

  /**
   * @param {string} key Pressed key.
   * @returns {object|undefined} The statistic bound to that keyboard shortcut.
   */
  function findStatByKey(key) {
    return STAT_DEFINITIONS.filter(function (stat) {
      return stat.key.toLowerCase() === key.toLowerCase();
    })[0];
  }

  /**
   * Adds a player to a team.
   * @param {object} team Team (mutated).
   * @param {string} name Player name.
   * @returns {object|null} The created player.
   */
  function addPlayer(team, name) {
    var clean = (name || '').trim();
    if (!clean) {
      return null;
    }
    var player = createPlayer(clean);
    team.players.push(player);
    return player;
  }

  /**
   * Removes a player and every event attached to them.
   * @param {object} match Match aggregate (mutated).
   * @param {string} playerId
   */
  function removePlayer(match, playerId) {
    match.teams.forEach(function (team) {
      team.players = team.players.filter(function (player) {
        return player.id !== playerId;
      });
    });
    match.events = match.events.filter(function (event) {
      return event.playerId !== playerId;
    });
  }

  /**
   * @param {object} match Match aggregate.
   * @returns {number} Elapsed milliseconds including the running segment.
   */
  function currentClockMs(match) {
    var clock = match.clock;
    if (!clock.running || !clock.startedAt) {
      return clock.elapsedMs;
    }
    return clock.elapsedMs + (Date.now() - clock.startedAt);
  }

  /**
   * Starts or pauses the match clock.
   * @param {object} match Match aggregate (mutated).
   */
  function toggleClock(match) {
    if (match.clock.running) {
      match.clock.elapsedMs = currentClockMs(match);
      match.clock.running = false;
      match.clock.startedAt = null;
      return;
    }
    match.clock.running = true;
    match.clock.startedAt = Date.now();
  }

  /**
   * @param {object} match Match aggregate (mutated).
   */
  function resetClock(match) {
    match.clock = { elapsedMs: 0, running: false, startedAt: null };
  }

  /**
   * @param {number} milliseconds
   * @returns {string} mm:ss representation.
   */
  function formatClock(milliseconds) {
    var totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return pad(minutes) + ':' + pad(seconds);
  }

  /**
   * @param {object} match Match aggregate.
   * @returns {string} Display name, falling back to the date.
   */
  function matchTitle(match) {
    return (match.name || '').trim() || ('Partido del ' + match.date);
  }

  function pad(value) {
    return value < 10 ? '0' + value : String(value);
  }

  function today() {
    var now = new Date();
    return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  }

  function createId(prefix) {
    return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  global.DatosFutbol = global.DatosFutbol || {};
  global.DatosFutbol.domain = {
    STAT_DEFINITIONS: STAT_DEFINITIONS,
    createMatch: createMatch,
    createTeam: createTeam,
    createPlayer: createPlayer,
    addEvent: addEvent,
    undoLastEvent: undoLastEvent,
    countStat: countStat,
    findPlayer: findPlayer,
    findStat: findStat,
    findStatByKey: findStatByKey,
    statLabel: statLabel,
    addPlayer: addPlayer,
    removePlayer: removePlayer,
    currentClockMs: currentClockMs,
    toggleClock: toggleClock,
    resetClock: resetClock,
    formatClock: formatClock,
    matchTitle: matchTitle
  };
}(window));
