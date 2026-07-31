(function (global) {
  'use strict';

  var domain = global.DatosFutbol.domain;

  /**
   * Points each action adds to the individual score. Positive actions build the
   * ranking, mistakes discount it, so a busy but sloppy player does not climb.
   */
  var SCORE_WEIGHTS = {
    goles: 6,
    golesEvitados: 5,
    asistencias: 4,
    atajadas: 2,
    disparosAlArco: 1.5,
    robosDePelota: 1,
    regatesExitosos: 1,
    intercepciones: 0.75,
    pasesCompletados: 0.5,
    disparosErrados: -0.75,
    pasesErrados: -0.75,
    regatesFallidos: -0.75,
    burradas: -5
  };

  /**
   * Builds every number shown in the app from the match event log.
   * @param {object} match Match aggregate.
   * @returns {object} Report with per player, per team and comparative figures.
   */
  function buildReport(match) {
    var playerTotals = totalsByPlayer(match);
    var teams = match.teams.map(function (team) {
      return buildTeamReport(team, playerTotals);
    });

    return {
      playerTotals: playerTotals,
      teams: teams,
      ranking: buildRanking(match, playerTotals),
      highlights: buildHighlights(teams),
      leaders: buildLeaders(match, playerTotals)
    };
  }

  /**
   * Orders every player that touched the ball by individual score.
   * @param {object} match Match aggregate.
   * @param {Object<string, object>} playerTotals Totals indexed by player id.
   * @returns {object[]} Players sorted from best to worst, position included.
   */
  function buildRanking(match, playerTotals) {
    var players = match.teams.reduce(function (list, team) {
      return list.concat(team.players.map(function (player) {
        return buildPlayerReport(player, team, playerTotals[player.id] || emptyTotals());
      }));
    }, []);

    return players
      .filter(function (player) {
        return player.metrics.accionesTotales > 0;
      })
      .sort(comparePlayers)
      .map(function (player, index) {
        return Object.assign({ position: index + 1 }, player);
      });
  }

  function buildPlayerReport(player, team, totals) {
    var passes = totals.pasesCompletados + totals.pasesErrados;

    return {
      id: player.id,
      name: player.name,
      teamId: team.id,
      teamName: team.name,
      color: team.color,
      score: scoreOf(totals),
      totals: totals,
      metrics: {
        participacionesEnGol: totals.goles + totals.asistencias,
        pasesTotales: passes,
        regatesTotales: dribbles(totals),
        accionesTotales: actionCount(totals),
        efectividadPases: ratio(totals.pasesCompletados, passes),
        precisionDisparos: ratio(totals.disparosAlArco, totals.disparos),
        conversionGoles: ratio(totals.goles, totals.disparos),
        efectividadRegate: ratio(totals.regatesExitosos, dribbles(totals)),
        accionesDefensivas: defensiveActions(totals)
      }
    };
  }

  function comparePlayers(first, second) {
    return (second.score - first.score)
      || (second.totals.goles - first.totals.goles)
      || (second.totals.asistencias - first.totals.asistencias)
      || first.name.localeCompare(second.name);
  }

  function scoreOf(totals) {
    return Object.keys(SCORE_WEIGHTS).reduce(function (points, statId) {
      return points + (totals[statId] * SCORE_WEIGHTS[statId]);
    }, 0);
  }

  function actionCount(totals) {
    return domain.STAT_DEFINITIONS.reduce(function (count, stat) {
      return count + totals[stat.id];
    }, 0);
  }

  /**
   * @param {object} match Match aggregate.
   * @returns {Object<string, object>} Totals indexed by player id.
   */
  function totalsByPlayer(match) {
    var totals = {};

    match.teams.forEach(function (team) {
      team.players.forEach(function (player) {
        totals[player.id] = emptyTotals();
      });
    });

    match.events.forEach(function (event) {
      var playerTotals = totals[event.playerId];
      if (playerTotals && domain.findStat(event.statId)) {
        playerTotals[event.statId] += event.delta;
      }
    });

    Object.keys(totals).forEach(function (playerId) {
      totals[playerId].disparos = shots(totals[playerId]);
    });

    return totals;
  }

  function buildTeamReport(team, playerTotals) {
    var totals = team.players.reduce(function (accumulated, player) {
      var stats = playerTotals[player.id] || emptyTotals();
      domain.STAT_DEFINITIONS.forEach(function (stat) {
        accumulated[stat.id] += stats[stat.id];
      });
      return accumulated;
    }, emptyTotals());

    totals.disparos = shots(totals);

    return {
      id: team.id,
      name: team.name,
      color: team.color,
      playerCount: team.players.length,
      totals: totals,
      metrics: {
        efectividadPases: ratio(totals.pasesCompletados, totals.pasesCompletados + totals.pasesErrados),
        precisionDisparos: ratio(totals.disparosAlArco, totals.disparos),
        conversionGoles: ratio(totals.goles, totals.disparos),
        efectividadRegate: ratio(totals.regatesExitosos, dribbles(totals)),
        accionesDefensivas: defensiveActions(totals)
      }
    };
  }

  function buildHighlights(teams) {
    if (teams.length !== 2) {
      return [];
    }

    var definitions = [
      { label: 'Más Goles', read: function (team) { return team.totals.goles; }, format: 'number' },
      { label: 'Más Disparos', read: function (team) { return team.totals.disparos; }, format: 'number' },
      { label: 'Mejor % Pases', read: function (team) { return team.metrics.efectividadPases; }, format: 'percent' },
      { label: 'Mejor % Regates', read: function (team) { return team.metrics.efectividadRegate; }, format: 'percent' },
      { label: 'Más Acciones Defensivas', read: function (team) { return team.metrics.accionesDefensivas; }, format: 'number' }
    ];

    return definitions.map(function (definition) {
      var first = definition.read(teams[0]);
      var second = definition.read(teams[1]);
      var winner = first === second ? null : (first > second ? teams[0] : teams[1]);

      return {
        label: definition.label,
        format: definition.format,
        winnerName: winner ? winner.name : 'Empate',
        winnerColor: winner ? winner.color : null,
        value: Math.max(first, second),
        difference: Math.abs(first - second)
      };
    });
  }

  function buildLeaders(match, playerTotals) {
    var definitions = [
      { label: 'Goleador', statId: 'goles' },
      { label: 'Máximo Asistidor', statId: 'asistencias' },
      { label: 'Más Disparos', statId: 'disparos' },
      { label: 'Mejor Pasador', statId: 'pasesCompletados' },
      { label: 'Más Intercepciones', statId: 'intercepciones' },
      { label: 'Más Robos', statId: 'robosDePelota' },
      { label: 'Más Regates Exitosos', statId: 'regatesExitosos' },
      { label: 'Más Goles Evitados', statId: 'golesEvitados' },
      { label: 'Más Atajadas', statId: 'atajadas' },
      { label: 'Más Burradas', statId: 'burradas' }
    ];

    var roster = match.teams.reduce(function (players, team) {
      return players.concat(team.players.map(function (player) {
        return { name: player.name, color: team.color, totals: playerTotals[player.id] || emptyTotals() };
      }));
    }, []);

    return definitions.map(function (definition) {
      return Object.assign({ label: definition.label }, topPlayers(roster, definition.statId));
    });
  }

  function topPlayers(roster, statId) {
    var best = roster.reduce(function (maximum, player) {
      return Math.max(maximum, player.totals[statId] || 0);
    }, 0);

    if (best === 0) {
      return { names: '—', color: null, value: 0 };
    }

    var winners = roster.filter(function (player) {
      return player.totals[statId] === best;
    });

    return {
      names: winners.map(function (player) { return player.name; }).join(', '),
      color: winners.length === 1 ? winners[0].color : null,
      value: best
    };
  }

  function shots(totals) {
    return totals.disparosAlArco + totals.disparosErrados;
  }

  function dribbles(totals) {
    return totals.regatesExitosos + totals.regatesFallidos;
  }

  function defensiveActions(totals) {
    return totals.intercepciones + totals.robosDePelota + totals.golesEvitados + totals.atajadas;
  }

  function ratio(part, whole) {
    return whole > 0 ? part / whole : 0;
  }

  function emptyTotals() {
    var totals = { disparos: 0 };
    domain.STAT_DEFINITIONS.forEach(function (stat) {
      totals[stat.id] = 0;
    });
    return totals;
  }

  global.DatosFutbol.statsCalculator = {
    SCORE_WEIGHTS: SCORE_WEIGHTS,
    buildReport: buildReport,
    totalsByPlayer: totalsByPlayer,
    emptyTotals: emptyTotals
  };
}(window));
