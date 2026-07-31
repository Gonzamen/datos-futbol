# @datos-futbol/domain

Las reglas del partido, en TypeScript puro: sin DOM, sin Node, sin acceso a red ni a
disco. Lo usan tanto el frontend como el backend, así que el ranking se calcula con el
mismo código que lo muestra y no hay dos versiones de la verdad.

## Qué hay adentro

| Archivo          | Responsabilidad                                                          |
| ---------------- | ------------------------------------------------------------------------ |
| `stats.ts`       | Las 13 estadísticas, sus atajos de teclado y las búsquedas por id/tecla  |
| `types.ts`       | El modelo: partido, equipos, jugadores, eventos y las formas del reporte |
| `match.ts`       | Operaciones sobre el log: crear, aplicar, borrar y contar eventos        |
| `scoring.ts`     | Puntaje individual, desempates del ranking y métricas derivadas          |
| `projections.ts` | Totales, porcentajes, destacados y líderes                               |
| `analysis.ts`    | Las lecturas automáticas del "Análisis del partido"                      |

## Dos decisiones que conviene conocer antes de tocar esto

**Todo se deriva del log de eventos.** No se guardan totales: se recalculan enteros a
partir de `match.events` cada vez. A escala de un partido (~1000 eventos) recalcular todo
cuesta menos que mantener contadores incrementales, y hace imposible que lo que se muestra
se desincronice de lo que se cargó.

**Los eventos no se borran, se marcan.** `removeEvent` completa `deletedAt` y `deletedBy`
en lugar de sacar el evento del array. Como varias personas cargan el mismo partido a la
vez, siempre tiene que poder reconstruirse quién contó qué y quién lo dio de baja.

Y una consecuencia importante de la primera: `applyEvent` es **idempotente por id**.
Aplicar dos veces el mismo evento deja el partido igual. Eso es lo que permite que el
servidor reemita sin miedo y que un cliente reenvíe su cola pendiente después de una
reconexión sin duplicar nada.

## Comandos

```bash
npm test -w @datos-futbol/domain          # corre la suite
npm run test:watch -w @datos-futbol/domain
npm run typecheck -w @datos-futbol/domain
```

## Los tests de caracterización

`test/characterization.test.ts` compara la salida de este paquete contra la de la
implementación original en `assets/js`, grabada en `test/golden/*.json`. Los golden se
generaron corriendo el código viejo bajo Node:

```bash
npm run golden -w @datos-futbol/domain
```

Mientras esos tests pasen, la migración no cambió ni un número del ranking, ni un
porcentaje, ni una palabra de las lecturas del análisis.

**Regenerar los golden solo cuando el cambio de comportamiento sea deliberado.** Si un
test de caracterización falla, la primera hipótesis es que la refactorización rompió algo,
no que el golden esté viejo.

Las cuatro fixtures (`test/fixtures/matches.ts`) cubren, entre las cuatro, los caminos que
importan:

- `empty` — sin eventos: el análisis devuelve el mensaje de "sin datos".
- `typical` — 323 eventos generados con semilla fija, incluidas correcciones con delta
  negativo. Las 14 lecturas aparecen.
- `edge` — los bordes a mano: los mínimos de intentos exactos (8 pases, 3 remates, 3
  regates) contra candidatos con mejor porcentaje pero un intento menos, los tres
  desempates del ranking, empate en acciones defensivas, líderes compartidos, un jugador
  sin acciones y las lecturas que deben saltearse.
- `drawn` — empate en el marcador y en las cinco comparativas entre equipos.
