(function (global) {
  'use strict';

  var domain = global.DatosFutbol.domain;
  var statsCalculator = global.DatosFutbol.statsCalculator;
  var SEPARATOR = ';';

  /**
   * Downloads the match as a CSV that Excel opens with the same layout as the
   * original spreadsheet: players, team totals and effectiveness.
   * @param {object} match Match aggregate.
   */
  function downloadCsv(match) {
    download(fileName(match, 'csv'), '﻿' + buildCsv(match), 'text/csv;charset=utf-8');
  }

  /**
   * Downloads the raw match, event log included, for backup or re-import.
   * @param {object} match Match aggregate.
   */
  function downloadJson(match) {
    download(fileName(match, 'json'), JSON.stringify(match, null, 2), 'application/json');
  }

  function buildCsv(match) {
    var report = statsCalculator.buildReport(match);
    var statLabels = domain.STAT_DEFINITIONS.map(function (stat) {
      return stat.label;
    });

    var rows = [
      [domain.matchTitle(match)],
      ['Fecha', match.date],
      [],
      ['Equipo', 'Jugador'].concat(statLabels, ['Disparos'])
    ];

    match.teams.forEach(function (team) {
      team.players.forEach(function (player) {
        var totals = report.playerTotals[player.id];
        rows.push([team.name, player.name].concat(statValues(totals), [totals.disparos]));
      });
    });

    rows.push([]);
    rows.push(['TOTALES POR EQUIPO']);
    rows.push(['Equipo', 'Jugadores'].concat(statLabels, ['Disparos']));
    report.teams.forEach(function (team) {
      rows.push([team.name, team.playerCount].concat(statValues(team.totals), [team.totals.disparos]));
    });

    rows.push([]);
    rows.push(['EFECTIVIDAD POR EQUIPO']);
    rows.push(['Equipo', '% Efectividad Pases', '% Disparos al Arco', '% Conversión Goles', '% Regates', 'Acciones Defensivas']);
    report.teams.forEach(function (team) {
      rows.push([
        team.name,
        percent(team.metrics.efectividadPases),
        percent(team.metrics.precisionDisparos),
        percent(team.metrics.conversionGoles),
        percent(team.metrics.efectividadRegate),
        team.metrics.accionesDefensivas
      ]);
    });

    rows.push([]);
    rows.push(['RANKING DE JUGADORES']);
    rows.push(['#', 'Jugador', 'Equipo', 'Puntaje', 'Goles', 'Asistencias', 'G+A', 'Pases Completados',
      'Pases Errados', '% Pases', 'Disparos', 'Al Arco', '% Al Arco', 'Regates Exitosos', 'Regates Fallidos',
      '% Regate', 'Intercepciones', 'Robos', 'Goles Evitados', 'Atajadas', 'Acciones Defensivas', 'Burradas']);
    report.ranking.forEach(function (player) {
      rows.push([
        player.position,
        player.name,
        player.teamName,
        player.score.toFixed(1).replace('.', ','),
        player.totals.goles,
        player.totals.asistencias,
        player.metrics.participacionesEnGol,
        player.totals.pasesCompletados,
        player.totals.pasesErrados,
        percent(player.metrics.efectividadPases),
        player.totals.disparos,
        player.totals.disparosAlArco,
        percent(player.metrics.precisionDisparos),
        player.totals.regatesExitosos,
        player.totals.regatesFallidos,
        percent(player.metrics.efectividadRegate),
        player.totals.intercepciones,
        player.totals.robosDePelota,
        player.totals.golesEvitados,
        player.totals.atajadas,
        player.metrics.accionesDefensivas,
        player.totals.burradas
      ]);
    });

    rows.push([]);
    rows.push(['ANÁLISIS DEL PARTIDO']);
    global.DatosFutbol.matchAnalysis.build(report).forEach(function (item) {
      rows.push([item.label, item.text]);
    });

    rows.push([]);
    rows.push(['LÍDERES INDIVIDUALES']);
    rows.push(['Categoría', 'Jugador', 'Cantidad']);
    report.leaders.forEach(function (leader) {
      rows.push([leader.label, leader.names, leader.value]);
    });

    return rows.map(toCsvRow).join('\r\n');
  }

  function statValues(totals) {
    return domain.STAT_DEFINITIONS.map(function (stat) {
      return totals[stat.id];
    });
  }

  function toCsvRow(cells) {
    return cells.map(escapeCell).join(SEPARATOR);
  }

  function escapeCell(value) {
    var text = value === null || value === undefined ? '' : String(value);
    return /["\n;]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function percent(value) {
    return Math.round(value * 100) + '%';
  }

  function fileName(match, extension) {
    var name = domain.matchTitle(match).replace(/[^\wáéíóúñÁÉÍÓÚÑ -]/g, '').trim();
    return (match.date + ' - ' + name).slice(0, 80) + '.' + extension;
  }

  function download(name, content, mimeType) {
    var blob = new global.Blob([content], { type: mimeType });
    var url = global.URL.createObjectURL(blob);
    var link = global.document.createElement('a');

    link.href = url;
    link.download = name;
    global.document.body.appendChild(link);
    link.click();
    global.document.body.removeChild(link);
    global.URL.revokeObjectURL(url);
  }

  global.DatosFutbol.exporter = {
    downloadCsv: downloadCsv,
    downloadJson: downloadJson,
    buildCsv: buildCsv
  };
}(window));
