import { describe, expect, it } from 'vitest'
import { comparePlayers, ratio, scoreOf } from '../src/scoring.js'
import { emptyTotals } from '../src/projections.js'
import { findStatByKey, statLabel } from '../src/stats.js'
import type { PlayerReport, Totals } from '../src/types.js'

function totals(overrides: Partial<Totals> = {}): Totals {
  return { ...emptyTotals(), ...overrides }
}

function player(name: string, score: number, goals = 0, assists = 0): PlayerReport {
  return {
    id: name,
    name,
    teamId: 'team-a',
    teamName: 'Caramelo de Polla',
    color: '#f0a52a',
    score,
    totals: totals({ goles: goals, asistencias: assists }),
    metrics: {
      participacionesEnGol: goals + assists,
      pasesTotales: 0,
      regatesTotales: 0,
      accionesTotales: goals + assists,
      efectividadPases: 0,
      precisionDisparos: 0,
      conversionGoles: 0,
      efectividadRegate: 0,
      accionesDefensivas: 0,
    },
  }
}

describe('scoreOf', () => {
  it('suma los aciertos y descuenta los errores', () => {
    expect(scoreOf(totals({ goles: 1, asistencias: 1 }))).toBe(10)
    expect(scoreOf(totals({ burradas: 1 }))).toBe(-5)
  })

  it('deja en negativo a quien toca mucho la pelota y la regala', () => {
    const sloppy = totals({ pasesCompletados: 4, pasesErrados: 6, regatesFallidos: 3 })

    expect(scoreOf(sloppy)).toBeLessThan(0)
  })

  it('vale cero cuando no se cargó nada', () => {
    expect(scoreOf(emptyTotals())).toBe(0)
  })
})

describe('comparePlayers', () => {
  it('ordena por puntaje de mayor a menor', () => {
    expect(comparePlayers(player('Pollo', 12), player('Brn', 8))).toBeLessThan(0)
  })

  it('desempata por goles', () => {
    const order = [player('Facu', 6, 0, 1), player('Lea', 6, 1)].sort(comparePlayers)

    expect(order.map((entry) => entry.name)).toEqual(['Lea', 'Facu'])
  })

  it('desempata por asistencias cuando los goles son iguales', () => {
    const order = [player('Verde', 6, 1), player('Kuki', 6, 1, 2)].sort(comparePlayers)

    expect(order.map((entry) => entry.name)).toEqual(['Kuki', 'Verde'])
  })

  it('cae en el nombre cuando todo lo demás empata', () => {
    const order = [player('Puya', 3), player('Joaco', 3)].sort(comparePlayers)

    expect(order.map((entry) => entry.name)).toEqual(['Joaco', 'Puya'])
  })
})

describe('ratio', () => {
  it('no divide por cero', () => {
    expect(ratio(0, 0)).toBe(0)
    expect(ratio(5, 0)).toBe(0)
  })

  it('devuelve la proporción', () => {
    expect(ratio(7, 8)).toBeCloseTo(0.875)
  })
})

describe('estadísticas', () => {
  it('encuentra la estadística por su atajado de teclado, sin importar mayúsculas', () => {
    expect(findStatByKey('b')?.id).toBe('burradas')
    expect(findStatByKey('B')?.id).toBe('burradas')
    expect(findStatByKey('ñ')).toBeUndefined()
  })

  it('mantiene legible un partido con estadísticas que ya no existen', () => {
    expect(statLabel('corners')).toBe('Estadística eliminada')
    expect(statLabel('goles')).toBe('Goles')
  })
})
