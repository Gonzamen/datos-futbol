# Plan de refactor — Datos Fútbol

De una página HTML local a una aplicación web con backend, usuarios y carga
colaborativa de estadísticas sobre el video del partido.

## 1. Qué cambia y qué no

### El cambio conceptual

Hoy la app es un **contador en vivo**: alguien al costado de la cancha toca botones
mientras se juega. La nueva es un **editor de anotaciones sobre un video**: cada uno
mira el partido grabado desde su casa y carga lo que ve, con la posibilidad de pausar,
retroceder y revisar.

Eso trae una propiedad que la versión en vivo no puede tener: **el tiempo es objetivo y
compartido**. Un evento no ocurre "al minuto 12 según mi reloj", ocurre en el segundo
743 del video, que es el mismo segundo 743 para todos. De ahí salen tres cosas gratis:

- Deduplicación confiable entre personas que cargan el mismo tramo.
- Cada estadística es verificable: clic en el evento y el video salta a la jugada.
- Corregir deja de ser a ciegas.

### Lo que se conserva tal cual

El modelo de dominio actual es sólido y se migra casi sin cambios:

- **El log de eventos** (`assets/js/domain.js:85`). Todo número visible se deriva de
  `match.events`. Es el modelo correcto para carga colaborativa: se sincronizan eventos
  chicos e inmutables, no estados completos.
- **Los ids generados en el cliente** (`assets/js/domain.js:273`). Dan idempotencia: el
  servidor deduplica por id y un reenvío nunca duplica nada. Se cambia el generador por
  UUID v4, pero la idea se mantiene.
- **La lógica pura**: `domain.js`, `stats-calculator.js` y `match-analysis.js` (~890
  líneas) no tocan el DOM. Pasan a un paquete compartido que usan front y back.

### Lo que se elimina

- **El cronómetro completo**: `currentClockMs`, `toggleClock`, `resetClock`
  (`assets/js/domain.js:215-243`) y su UI. El reproductor de video es la fuente del tiempo.
- **`event.clockMs`** pasa a **`event.videoMs`**.
- **`storage.js`** (localStorage como única fuente) pasa a API + caché.

### Lo que se reescribe

`ui.js` (604 líneas de DOM manual) y `app.js` (372 líneas de estado global) se
reemplazan por componentes React. Es el grueso del trabajo de UI.

## 2. Arquitectura

### Estructura del monorepo

```
datos-futbol/
├── package.json                 npm workspaces
├── packages/
│   └── domain/                  TypeScript puro: sin DOM, sin Node, sin I/O
│       ├── src/
│       │   ├── stats.ts         definiciones de estadísticas y atajos
│       │   ├── events.ts        tipos de evento y reducers
│       │   ├── projections.ts   totales, porcentajes, líderes
│       │   ├── scoring.ts       puntaje y ranking
│       │   ├── analysis.ts      lecturas automáticas del partido
│       │   └── dedupe.ts        detección de duplicados por timecode
│       └── test/
└── apps/
    ├── api/                     Node + Fastify + Socket.IO
    └── web/                     React + Vite
```

`packages/domain` es la pieza clave: el backend valida y proyecta con exactamente el
mismo código que la UI usa para mostrar. Un solo lugar donde vive la regla del ranking.

### Backend (`apps/api`)

```
src/
├── main.ts
├── application/                 casos de uso, un archivo por caso
│   ├── matches/                 crear, listar, invitar, cerrar
│   ├── events/                  agregar, borrar, listar
│   ├── segments/                crear, asignar, completar
│   └── auth/
├── domain/                      entidades propias del backend
│   ├── user.ts
│   ├── membership.ts
│   └── ports/                   interfaces de repositorio
├── infrastructure/
│   ├── http/                    rutas Fastify
│   ├── realtime/                gateway Socket.IO
│   ├── persistence/             repositorios Drizzle
│   └── auth/                    Google OAuth + emisión de JWT
└── config/
```

Los casos de uso dependen de las interfaces en `domain/ports`, no de Drizzle. Eso
permite testearlos con repositorios en memoria, sin base de datos ni Docker.

### Frontend (`apps/web`)

```
src/
├── app/                         router, providers, sesión
├── features/
│   ├── tagging/                 vista principal: video + pad de estadísticas
│   ├── table/                   planilla completa
│   ├── summary/                 marcador, ranking, análisis
│   ├── teams/                   equipos y jugadores
│   ├── segments/                reparto de tramos y progreso
│   └── history/                 partidos guardados
└── shared/
    ├── api/                     cliente REST tipado
    ├── realtime/                hook de socket
    ├── video/                   abstracción de reproductor
    └── ui/                      componentes base
```

### Stack

| Capa        | Elección           | Por qué                                                                   |
| ----------- | ------------------ | ------------------------------------------------------------------------- |
| Lenguaje    | TypeScript en todo | El dominio compartido lo necesita para valer la pena                      |
| Front       | React + Vite       | Rápido, sin la complejidad de un framework full-stack que acá no aporta   |
| Back        | Fastify            | Liviano, buen soporte de TS, integra bien con Socket.IO                   |
| Tiempo real | Socket.IO          | Reconexión y rooms resueltas; no hace falta nada más sofisticado          |
| DB          | Postgres en Neon   | Free tier suficiente; SQL relacional encaja con el modelo                 |
| ORM         | Drizzle            | Tipado real desde el esquema, sin capa de runtime pesada                  |
| Auth        | Google OAuth + JWT | Cero contraseñas que administrar ni filtrar                               |
| Tests       | Vitest             | Mismo runner en los tres paquetes                                         |
| Deploy web  | Vercel             | Estático, gratis                                                          |
| Deploy API  | Railway o Fly      | **Necesario**: las funciones serverless de Vercel no sostienen WebSockets |

## 3. Modelo de datos

```sql
users(id, google_sub, email, name, avatar_url, created_at)

people(id, name, created_at)

matches(id, name, played_on, video_provider, video_id,
        status, invite_code, created_by, created_at)

match_members(match_id, user_id, role, joined_at)
  role: owner | tagger | viewer

teams(id, match_id, name, color, position)
players(id, team_id, person_id, name, position)

segments(id, match_id, label, start_ms, end_ms,
         assignee_user_id, status, completed_at)
  status: pending | in_progress | done

events(id, match_id, player_id, team_id, stat_id, delta, video_ms,
       created_by, created_at,
       deleted_at, deleted_by,
       possible_duplicate_of)
```

Decisiones que importan:

- **`events.id` lo genera el cliente** (UUID v4). El insert es idempotente: reenviar el
  mismo evento no duplica nada.
- **`events` es append-only con borrado lógico.** Nada se borra físicamente. Deshacer es
  marcar `deleted_at`, y siempre se sabe quién cargó y quién borró qué.
- **Índices**: `(match_id, video_ms)` para la timeline, y
  `(match_id, player_id, stat_id, video_ms)` para el chequeo de duplicados.
- **`video_ms` admite null**: los partidos importados del historial viejo se cargaron en
  vivo y no tienen timecode.

### Por qué existe `people` aparte de `players`

Los que juegan cambian de una semana a la otra: son 14, pero no siempre los mismos 14. Si
cada partido guardara solamente una lista de nombres sueltos, la historia entre partidos
se armaría comparando strings, y ahí se cae todo: "Gonchi" y "gonchi", un apodo distinto,
un error de tipeo, y de golpe una persona figura como tres jugadores diferentes.

Entonces:

- **`people`** es el registro del grupo: todos los que alguna vez jugaron. Se escribe una
  sola vez por persona y crece solo.
- **`players`** es la participación de una persona en un partido puntual, dentro de un
  equipo. Apunta a `person_id`.

`players.name` queda **denormalizado a propósito**. Un partido es el registro de lo que
pasó ese día, y tiene que poder leerse y exportarse solo, sin depender del estado actual
del registro. Si alguien se cambia el apodo en marzo, los partidos de febrero siguen
mostrando cómo se llamaba entonces, y las estadísticas acumuladas de la temporada siguen
saliendo bien porque se agregan por `person_id`, no por nombre.

Al armar un partido escribís el nombre y la app autocompleta contra `people`: si ya está,
lo reusa; si es alguien nuevo, lo da de alta. Sin pantalla de administración de personas.

## 4. Carga entre varios

Un número variable de personas carga el mismo partido a la vez, cada una en un tramo
distinto, y todas ven cómo crecen los totales en vivo. **La cantidad se define por
partido**, no está fijada en el diseño: puede ser uno solo cargando todo o cinco
repartiéndose el video, según quién tenga ganas esa semana.

### 4.0 Por qué la carga simultánea no genera conflictos

Vale dejarlo explícito porque es lo que hace que todo lo demás sea simple.

Cuando vos anotás "Pollo, pase completado" en el minuto 5 y otro anota "Pollo, pase
completado" en el minuto 32, **no son el mismo dato en disputa**: son dos eventos
distintos, con timecodes distintos, que se suman al mismo total. No hay nada que
mergear ni ninguna versión que ganarle a otra. Todos están agregando a partes disjuntas
de la misma línea de tiempo.

El flujo es:

1. Cualquiera agrega un evento.
2. El servidor lo persiste y lo emite a la room del partido.
3. Cada cliente lo suma a su copia local del log y **vuelve a derivar todo**: totales,
   marcador, porcentajes, ranking y análisis.

El paso 3 es barato: un partido son del orden de 1000 eventos y las proyecciones de
`packages/domain` son funciones puras sobre un array. Recalcular entero en cada evento
cuesta menos que intentar actualizaciones incrementales, y no puede quedar inconsistente.

Esto ya funciona así hoy en la versión local (`assets/js/app.js` recalcula desde
`match.events`). Lo único que se agrega es el broadcast.

### 4.1 Deshacer

Hoy `undoLastEvent` hace `events.pop()` (`assets/js/domain.js:114`): saca el último
evento **global**. Con dos personas cargando, le deshacés la acción al otro.

Pasa a ser borrado por id, con dos alcances distintos en la UI:

- `Ctrl+Z` deshace **tu** último evento no borrado.
- En el feed y en la tabla, cualquiera con rol `tagger` puede borrar un evento
  específico, y queda registrado quién lo hizo.

### 4.2 Duplicados

Con tramos disjuntos el riesgo es bajo y se concentra en un solo lugar: **los bordes**.
Dos personas cargando la misma jugada porque cae justo en el límite entre un tramo y el
siguiente. Dentro de un tramo no hay riesgo, porque hay un solo dueño.

La regla es **avisar, nunca bloquear**, y con ventana distinta según la estadística:

| Estadísticas                                           | Ventana     | Razón                                                                      |
| ------------------------------------------------------ | ----------- | -------------------------------------------------------------------------- |
| Goles, asistencias, goles evitados, atajadas, burradas | 15 s        | Son raras; dos iguales tan cerca casi siempre es la misma jugada           |
| Disparos al arco, disparos errados                     | 5 s         | Poco frecuentes, pero puede haber rebote                                   |
| Pases, regates, robos, intercepciones                  | sin chequeo | Un jugador puede dar tres pases en cinco segundos; avisar sería solo ruido |

Al detectar una coincidencia el evento **se inserta igual**, marcado con
`possible_duplicate_of`. La UI muestra "el Profe ya cargó un gol de Pollo en 12:34 —
¿es la misma jugada?" con la opción de descartar uno de los dos. Bloquear la carga sería
peor: hay jugadas legítimamente repetidas.

### 4.3 Reparto por tramos

El partido se divide en tramos con dueño asignado. La cantidad la decide el dueño del
partido según quiénes se sumen esa vez.

- Al armar el partido se generan los tramos: por defecto, tantos como personas
  disponibles, repartidos parejo sobre la duración del video. También se pueden crear a
  mano si quieren cortar en momentos puntuales (entretiempo, un corte de luz, lo que sea).
- Cada uno reclama el suyo; queda en `in_progress` y después en `done`.
- **Se pueden redividir en cualquier momento**, que es lo que hace que la cantidad
  variable funcione en la práctica: si alguien se suma tarde, se parte un tramo pendiente
  en dos; si alguien abandona a mitad, su tramo vuelve a `pending` y otro lo agarra desde
  donde quedó. Los eventos ya cargados no se tocan nunca — los tramos son una capa de
  organización sobre la línea de tiempo, no un contenedor de datos.
- La vista de carga **filtra por tu tramo**: el video arranca en tu `start_ms` y la app
  te avisa si cargás fuera de rango, sin impedírtelo.
- Una barra de progreso muestra qué está cubierto, qué está en curso y qué falta.
- **Regla de borde**: la acción pertenece al tramo donde cae su timecode, no al tramo
  donde arrancó la jugada. Con esa regla y el aviso de duplicados, los límites dejan de
  ser un problema.

Este es el mecanismo que de verdad evita pisarse. El dedupe es la red de contención de
los bordes, no la solución principal.

### 4.3.1 Ranking parcial

Mientras haya tramos sin terminar, **el ranking y el análisis están sesgados**: el
jugador cuyo tramo ya se cargó entero aparece muy por encima de uno cuyo tramo todavía
no empezó, y no porque haya jugado mejor.

La vista de resumen muestra el estado de cobertura ("2 de 4 tramos completos", y qué
minutos faltan) y marca el ranking como parcial hasta que estén todos en `done`. Es un
cartel, no un bloqueo: mirar los números a mitad de camino está bien, siempre que quede
claro que faltan datos.

### 4.4 Presencia

Cada cliente informa en qué segundo del video está. La UI muestra los avatares sobre la
timeline. Sirve para lo obvio (ver que el otro está laburando) y para lo importante:
darte cuenta al toque de que están los dos en el mismo tramo.

## 5. La capa de video

### Abstracción

Toda la app habla contra una interfaz, no contra YouTube:

```ts
interface VideoSource {
  play(): void
  pause(): void
  seekTo(ms: number): void
  getCurrentMs(): number
  getDurationMs(): number
  setPlaybackRate(rate: number): void
  onStateChange(handler: (state: PlaybackState) => void): Unsubscribe
}
```

La implementación de YouTube usa la IFrame API. Si más adelante quieren archivos
locales, se agrega otra implementación sin tocar la vista de carga.

### Advertencias concretas de YouTube

1. **Video público**: no hay ningún problema de embebido, la IFrame API lo reproduce
   sin restricciones. Único detalle a tener en cuenta: público significa que aparece en
   búsquedas y en el canal, con la cara de todos los que juegan. Si en algún momento
   prefieren menos exposición, **"no listado"** funciona idéntico para la app (solo entra
   quien tiene el link). Lo que **no** sirve es "privado": esos videos no se pueden
   embeber en un sitio externo, aunque tengas permiso de verlos en youtube.com.
2. **El iframe se roba el teclado.** Hay que cargarlo con `disablekb=1` y manejar todos
   los atajos a nivel documento, o los números del pad se los come el reproductor.
3. **`getCurrentTime()` no es exacto al frame**, tiene unos ±0.3 s de margen. Para
   estadísticas de fútbol es irrelevante, y las ventanas de dedupe ya lo contemplan.
4. **Velocidad de reproducción**: cargar a 0.75x en las jugadas confusas y a 1.5x en los
   tramos muertos hace la diferencia. Vale atajos propios.

### Atajos de teclado

Se conservan los actuales (`1`-`9`, `0`, `E`, `A`, `B` para estadísticas, `↑` `↓` para
jugador) y se agregan los de video:

| Tecla             | Acción                                              |
| ----------------- | --------------------------------------------------- |
| `Espacio`         | Play / pausa (reemplaza el cronómetro, misma tecla) |
| `←` `→`           | Retroceder / adelantar 5 s                          |
| `Shift` + `←` `→` | Retroceder / adelantar 1 s                          |
| `,` `.`           | Bajar / subir velocidad                             |
| `Ctrl+Z`          | Deshacer tu último evento                           |

## 6. Contrato de tiempo real

Una room de Socket.IO por partido: `match:{matchId}`.

**Cliente → servidor** (todos con ACK, para confirmar persistencia):

| Mensaje             | Carga                                      |
| ------------------- | ------------------------------------------ |
| `event:add`         | evento completo con id generado en cliente |
| `event:remove`      | `{ eventId }`                              |
| `segment:claim`     | `{ segmentId }`                            |
| `segment:complete`  | `{ segmentId }`                            |
| `presence:position` | `{ videoMs }`, con throttle de 2 s         |

**Servidor → cliente**:

| Mensaje           | Cuándo                                               |
| ----------------- | ---------------------------------------------------- |
| `event:added`     | evento persistido, incluye flag de posible duplicado |
| `event:removed`   | borrado lógico aplicado                              |
| `segment:updated` | cambio de dueño o estado                             |
| `presence:update` | quiénes están y en qué minuto                        |
| `match:updated`   | cambios de equipos, jugadores o metadatos            |

La UI aplica el evento de forma optimista al tocar el botón y lo reconcilia con el ACK.
Si el ACK falla, revierte y avisa.

## 7. Fases

Cada fase termina en algo desplegable y usable. Nada de "esperá tres semanas a que ande".

### Fase 0 — Fundaciones

Sin cambios visibles para el usuario.

- Monorepo con npm workspaces, TypeScript en modo estricto, Vitest, ESLint y Prettier.
- **Primero, tests de caracterización**: se corre un partido de ejemplo por el código
  actual y se congela la salida del ranking, los porcentajes y el análisis. Esos tests son
  la garantía de que la migración no cambia ningún número.
- Migrar `domain.js`, `stats-calculator.js` y `match-analysis.js` a `packages/domain`
  con tipos y tests unitarios.

_Por qué vale la pena_: `stats-calculator.js` y `match-analysis.js` son la parte más
delicada (mínimos de intentos, desempates del ranking) y son funciones puras. Testearlas
cuesta poco y deja migrar el resto sin miedo a romper el ranking en silencio.

**Entregable**: `npm test` en verde. La app vieja sigue funcionando igual que hoy.

### Fase 1 — React + video, todavía sin backend ✅

- Vite + React + TypeScript.
- Abstracción `VideoSource` y la implementación de YouTube.
- Vista de carga nueva: video arriba, pad de estadísticas y feed con timecodes clicables.
- Migración del resto de las vistas (tabla, resumen, equipos, historial).
- Registro de personas del grupo con autocompletado al armar los equipos.
- Persistencia todavía en localStorage, ahora con `videoMs`.
- **Se borra `assets/` y el `index.html` original.** La app nueva lo reemplaza por
  completo: no queda código legacy conviviendo con el nuevo. Los partidos guardados en el
  navegador se migran al formato nuevo al abrir la app por primera vez.
- Deploy a Vercel.

**Entregable**: la app entera andando con video de YouTube, online, usable de a uno.
Ya sirve para cargar un partido de verdad.

### Fase 2 — Backend, auth y datos compartidos ✅

- Fastify + Postgres (Neon) + Drizzle, con migraciones.
- Google OAuth, JWT en cookie httpOnly.
- Partidos, miembros y código de invitación corto (6 caracteres, sin 0/O/1/I/L) para
  sumar a los demás. Quien crea el partido es `owner`; quien entra con el código es
  `tagger`.
- API REST de partidos, equipos, jugadores, eventos y del registro de personas.
- Arquitectura de puertos: los casos de uso (`apps/api/src/application/`) no dependen de
  Drizzle, solo de interfaces (`domain/ports/`). Se testean contra repositorios en
  memoria, sin necesitar Postgres corriendo.

**Cambio de alcance respecto de lo planeado**: se dejó de lado el modo local
(localStorage) en vez de mantenerlo en paralelo con el servidor. Sostener los dos modos a
la vez — con las mismas pantallas funcionando indistintamente contra datos locales o
contra la API — pedía una capa de indirección (un store intercambiable) que agregaba
complejidad real sin un caso de uso concreto: el objetivo del proyecto siempre fue cargar
en grupo, con cuenta. Se sacó el importador de localStorage y el historial local; la
lista "Mis partidos" del servidor cumple ese rol ahora. La app requiere login desde que
arranca.

**Entregable**: todos entran con su cuenta de Google y ven los mismos partidos desde
cualquier dispositivo. Todavía hace falta refrescar para ver lo que cargó el resto.

### Fase 3 — Tiempo real y tramos ✅

- Gateway Socket.IO, una room por partido (`match:{matchId}`).
- Tramos: generación automática en partes iguales, agarrar/completar/soltar, filtrado por
  clic (el video salta al inicio del tramo). El ranking se marca como parcial en la
  propia vista de tramos mientras falten completar.
- Presencia: lista de quién más está con el partido abierto y en qué minuto, actualizada
  cada 4 segundos mientras el video corre.
- Detección de duplicados con las ventanas por estadística de la sección 4.2, aplicada en
  el mismo caso de uso que valida y guarda el evento.

**Cambios de alcance respecto de lo planeado**:

- **Las escrituras siguen siendo por REST**, no por el contrato de sockets con ACK de la
  sección 6. El socket se usa solo para el _broadcast_: después de que la escritura REST
  se valida y persiste (los mismos casos de uso ya testeados de la Fase 2), el servidor
  avisa por el socket a todos los que tienen ese partido abierto. Es más simple que
  duplicar la validación en el gateway y da el mismo resultado percibido — nadie necesita
  refrescar — sin dos caminos de escritura que mantener sincronizados.
- **Redivisión de tramos**: la versión que se construyó reemplaza todos los tramos al
  regenerar, en vez de partir solo los pendientes preservando los que ya están en curso o
  completos. Alcanza para el uso real (repartir al arrancar, resetear si cambia quién
  juega) sin la complejidad de una redivisión incremental que, para un grupo de tres o
  cuatro personas, no se justificaba todavía.
- **Sin aviso de "estás cargando fuera de tu tramo"**: los tramos organizan y muestran
  progreso, pero la vista de carga no advierte si contás algo fuera del rango del tramo
  que tenés asignado. Queda pendiente si en la práctica hace falta.

**Entregable**: varios cargando el mismo partido a la vez, cada uno su tramo, viéndose en
vivo sin refrescar. Es el objetivo del refactor.

### Fase 4 — Temporada (opcional, pero es lo que van a querer después)

Estadísticas acumuladas entre partidos: tabla histórica del grupo, evolución del puntaje,
récords. Se agregan por `person_id`, así que funciona aunque cada fin de semana jueguen
distintos. El modelo ya lo soporta entero; es todo consultas y UI.

## 8. Testing

| Paquete           | Qué se testea                          | Cómo                                                                               |
| ----------------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| `packages/domain` | Ranking, porcentajes, análisis, dedupe | Vitest, cobertura alta. Es el camino crítico.                                      |
| `apps/api`        | Casos de uso                           | Repositorios en memoria contra las interfaces de `domain/ports`. Sin DB ni Docker. |
| `apps/api`        | Repositorios y rutas                   | Suite de integración aparte, contra Postgres.                                      |
| `apps/web`        | Lógica de carga y atajos               | Vitest + Testing Library. `VideoSource` mockeado.                                  |

## 9. Riesgos

| Riesgo                                   | Mitigación                                                                                                                                                                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Criterio distinto entre quienes cargan   | El riesgo más grande, y no es técnico: si uno cuenta como asistencia lo que otro cuenta como pase, los tramos no comparan entre sí. Empeora cuanta más gente se sume. Un panel de criterios visible en la app y acordarlos antes del primer partido. |
| Nadie agarra un tramo y queda sin cargar | La barra de cobertura muestra los huecos, y el ranking queda marcado como parcial mientras falte alguno. Un partido a medias es visible, no silencioso.                                                                                              |
| Video privado no embebible               | Usar público o no listado, nunca privado. Verificar antes de la fase 1.                                                                                                                                                                              |
| Serverless no sostiene WebSockets        | API en Railway o Fly desde la fase 2, no en Vercel.                                                                                                                                                                                                  |
| El refactor se estira y pierde impulso   | Fase 1 desplegada y usable sin backend. Si se frena ahí, igual quedó algo mejor que hoy.                                                                                                                                                             |
| Regresión silenciosa en el ranking       | Tests de caracterización antes de tocar nada (fase 0).                                                                                                                                                                                               |
| Costos                                   | Todo free tier: Neon, Vercel, y Railway o Fly con uso bajo.                                                                                                                                                                                          |

## 10. Decisiones ya tomadas

- Acceso: login con Google + código corto para entrar a un partido.
- Video: subido a YouTube como público.
- Modo de uso: carga diferida mirando el video, no en vivo durante el partido.
- Reparto de carga: por tramos de minutos, un tramo por persona. La cantidad de personas
  varía en cada partido según quién se prenda; los tramos se crean y redividen sobre la
  marcha.
- Los totales y el ranking se actualizan en vivo para todos a medida que cualquiera
  carga, aunque cada uno esté en un tramo distinto del video.
