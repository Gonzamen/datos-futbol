(function (global) {
  'use strict';

  var MIN_PASSES_FOR_ACCURACY = 8;
  var MIN_SHOTS_FOR_ACCURACY = 3;
  var MIN_DRIBBLES_FOR_ACCURACY = 3;

  /**
   * Turns the numeric report into the short readings shown under "Análisis del
   * partido". Every reading is skipped when there is not enough data to support
   * it, so the list never states conclusions the match does not back up.
   * @param {object} report Report produced by the stats calculator.
   * @returns {Array<{label: string, text: string}>} Readings in reading order.
   */
  function build(report) {
    if (!report.ranking.length) {
      return [{ label: 'Sin datos', text: 'Cargá algunas estadísticas y acá vas a ver el análisis del partido.' }];
    }

    return [
      resultReading(report.teams),
      figureReading(report.ranking),
      goalParticipationReading(report),
      passingTeamReading(report.teams),
      shootingTeamReading(report.teams),
      defensiveTeamReading(report.teams),
      safestPlayerReading(report.ranking),
      sharpestShooterReading(report.ranking),
      bestDribblerReading(report.ranking),
      ballWinnerReading(report.ranking),
      goalSaverReading(report.ranking),
      keeperReading(report.ranking),
      worstDribblerReading(report.ranking),
      blunderReading(report.ranking)
    ].filter(Boolean);
  }

  function resultReading(teams) {
    if (teams.length !== 2) {
      return null;
    }

    var home = teams[0];
    var away = teams[1];
    var score = home.totals.goles + ' a ' + away.totals.goles;

    if (home.totals.goles === away.totals.goles) {
      return reading('Resultado', 'Empataron ' + score + '.');
    }

    var winner = home.totals.goles > away.totals.goles ? home : away;
    var difference = Math.abs(home.totals.goles - away.totals.goles);

    return reading('Resultado', winner.name + ' ganó ' + score + ', por ' + difference + (difference === 1 ? ' gol.' : ' goles.'));
  }

  function figureReading(ranking) {
    var best = ranking[0];
    return reading('Figura del partido', best.name + ' (' + best.teamName + ') con ' + formatScore(best.score)
      + ' puntos: ' + describeContribution(best) + '.');
  }

  function describeContribution(player) {
    var parts = [
      countPart(player.totals.goles, 'gol', 'goles'),
      countPart(player.totals.asistencias, 'asistencia', 'asistencias'),
      countPart(player.totals.golesEvitados, 'gol evitado', 'goles evitados'),
      countPart(player.totals.robosDePelota, 'robo', 'robos'),
      countPart(player.totals.pasesCompletados, 'pase completado', 'pases completados')
    ].filter(Boolean);

    return parts.length ? joinWithAnd(parts) : player.metrics.accionesTotales + ' acciones';
  }

  function goalParticipationReading(report) {
    var best = maxBy(report.ranking, function (player) {
      return player.metrics.participacionesEnGol;
    });

    if (!best || best.metrics.participacionesEnGol === 0) {
      return null;
    }

    var team = report.teams.filter(function (candidate) {
      return candidate.id === best.teamId;
    })[0];

    if (!team || team.totals.goles === 0) {
      return null;
    }

    if (team.totals.goles === 1) {
      return reading('Peso en los goles', best.name + ' participó en el único gol de ' + team.name + '.');
    }

    return reading('Peso en los goles', best.name + ' participó en ' + best.metrics.participacionesEnGol
      + ' de los ' + team.totals.goles + ' goles de ' + team.name
      + ' (' + formatPercent(best.metrics.participacionesEnGol / team.totals.goles) + ').');
  }

  function passingTeamReading(teams) {
    var best = maxBy(teams, function (team) {
      return team.metrics.efectividadPases;
    });

    if (!best || passesOf(best) === 0) {
      return null;
    }

    return reading('Circulación', best.name + ' fue el equipo que mejor movió la pelota: '
      + formatPercent(best.metrics.efectividadPases) + ' de pases buenos ('
      + best.totals.pasesCompletados + ' de ' + passesOf(best) + ').');
  }

  function shootingTeamReading(teams) {
    var best = maxBy(teams, function (team) {
      return team.totals.disparos;
    });

    if (!best || best.totals.disparos === 0) {
      return null;
    }

    return reading('Puntería', best.name + ' remató ' + best.totals.disparos + ' veces, '
      + formatPercent(best.metrics.precisionDisparos) + ' al arco, y convirtió '
      + best.totals.goles + ' (' + formatPercent(best.metrics.conversionGoles) + ' de conversión).');
  }

  function defensiveTeamReading(teams) {
    if (teams.length !== 2) {
      return null;
    }

    var first = teams[0].metrics.accionesDefensivas;
    var second = teams[1].metrics.accionesDefensivas;

    if (first === 0 && second === 0) {
      return null;
    }

    if (first === second) {
      return reading('Trabajo defensivo', 'Parejo: los dos equipos cortaron ' + first + ' jugadas cada uno.');
    }

    var best = first > second ? teams[0] : teams[1];

    return reading('Trabajo defensivo', best.name + ' cortó más juego con ' + best.metrics.accionesDefensivas
      + ' acciones defensivas: ' + describeDefense(best.totals) + '.');
  }

  function describeDefense(totals) {
    var parts = [
      countPart(totals.intercepciones, 'intercepción', 'intercepciones'),
      countPart(totals.robosDePelota, 'robo', 'robos'),
      countPart(totals.golesEvitados, 'gol evitado', 'goles evitados'),
      countPart(totals.atajadas, 'atajada', 'atajadas')
    ].filter(Boolean);

    return joinWithAnd(parts);
  }

  function safestPlayerReading(ranking) {
    var best = bestRatioBy(ranking, 'pasesTotales', MIN_PASSES_FOR_ACCURACY, 'efectividadPases');

    if (!best) {
      return null;
    }

    return reading('Más seguro con la pelota', best.name + ' completó ' + formatPercent(best.metrics.efectividadPases)
      + ' de sus ' + best.metrics.pasesTotales + ' pases.');
  }

  function sharpestShooterReading(ranking) {
    var candidates = ranking.filter(function (player) {
      return player.totals.disparos >= MIN_SHOTS_FOR_ACCURACY;
    });

    var best = maxBy(candidates, function (player) {
      return player.metrics.precisionDisparos;
    });

    if (!best) {
      return null;
    }

    return reading('Mejor definidor', best.name + ' mandó al arco ' + formatPercent(best.metrics.precisionDisparos)
      + ' de sus ' + best.totals.disparos + ' remates.');
  }

  function bestDribblerReading(ranking) {
    var best = bestRatioBy(ranking, 'regatesTotales', MIN_DRIBBLES_FOR_ACCURACY, 'efectividadRegate');

    if (!best) {
      return null;
    }

    return reading('Mejor gambeta', best.name + ' ganó ' + best.totals.regatesExitosos + ' de sus '
      + best.metrics.regatesTotales + ' regates (' + formatPercent(best.metrics.efectividadRegate) + ').');
  }

  function ballWinnerReading(ranking) {
    var best = maxBy(ranking, function (player) {
      return player.totals.intercepciones + player.totals.robosDePelota;
    });

    if (!best || (best.totals.intercepciones + best.totals.robosDePelota) === 0) {
      return null;
    }

    return reading('Motor en la marca', best.name + ' cortó '
      + countPart(best.totals.intercepciones + best.totals.robosDePelota, 'jugada', 'jugadas') + ': '
      + joinWithAnd([
        countPart(best.totals.intercepciones, 'intercepción', 'intercepciones'),
        countPart(best.totals.robosDePelota, 'robo', 'robos')
      ].filter(Boolean)) + '.');
  }

  function goalSaverReading(ranking) {
    var best = maxBy(ranking, function (player) {
      return player.totals.golesEvitados;
    });

    if (!best || best.totals.golesEvitados === 0) {
      return null;
    }

    return reading('Salvador', best.name + ' evitó ' + best.totals.golesEvitados
      + (best.totals.golesEvitados === 1 ? ' gol.' : ' goles.'));
  }

  function keeperReading(ranking) {
    var best = maxBy(ranking, function (player) {
      return player.totals.atajadas;
    });

    if (!best || best.totals.atajadas === 0) {
      return null;
    }

    return reading('Bajo los tres palos', best.name + ' se quedó con '
      + countPart(best.totals.atajadas, 'atajada', 'atajadas') + '.');
  }

  function worstDribblerReading(ranking) {
    var worst = maxBy(ranking, function (player) {
      return player.totals.regatesFallidos;
    });

    if (!worst || worst.totals.regatesFallidos === 0) {
      return null;
    }

    return reading('Para mejorar', worst.name + ' perdió ' + worst.totals.regatesFallidos
      + (worst.totals.regatesFallidos === 1 ? ' regate.' : ' regates.'));
  }

  function blunderReading(ranking) {
    var worst = maxBy(ranking, function (player) {
      return player.totals.burradas;
    });

    if (!worst || worst.totals.burradas === 0) {
      return null;
    }

    return reading('Burrada del partido', worst.totals.burradas === 1
      ? 'La burrada del partido fue de ' + worst.name + '.'
      : worst.name + ' se mandó ' + worst.totals.burradas + ' burradas.');
  }

  function bestRatioBy(ranking, volumeMetric, minimum, ratioMetric) {
    var candidates = ranking.filter(function (player) {
      return player.metrics[volumeMetric] >= minimum;
    });

    return maxBy(candidates, function (player) {
      return player.metrics[ratioMetric];
    });
  }

  function passesOf(team) {
    return team.totals.pasesCompletados + team.totals.pasesErrados;
  }

  function maxBy(list, read) {
    return list.reduce(function (best, candidate) {
      return !best || read(candidate) > read(best) ? candidate : best;
    }, null);
  }

  function countPart(value, singular, plural) {
    return value > 0 ? value + ' ' + (value === 1 ? singular : plural) : null;
  }

  function joinWithAnd(parts) {
    if (parts.length === 1) {
      return parts[0];
    }
    return parts.slice(0, -1).join(', ') + ' y ' + parts[parts.length - 1];
  }

  function reading(label, text) {
    return { label: label, text: text };
  }

  function formatPercent(value) {
    return Math.round(value * 100) + '%';
  }

  function formatScore(value) {
    return value.toFixed(1).replace('.', ',');
  }

  global.DatosFutbol.matchAnalysis = {
    build: build,
    formatScore: formatScore
  };
}(window));
