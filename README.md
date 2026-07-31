# Datos Fútbol

Estadísticas de los partidos con amigos, cargadas mirando el video en YouTube — cada uno
desde su casa, en simultáneo, con los totales actualizándose para todos.

En vez de discutir de memoria quién jugó mejor, cada acción queda anclada al segundo del
video en el que pasó. Hacés clic en el dato y el video salta a la jugada.

## Arquitectura

```
packages/
  domain/     Las reglas del partido, en TypeScript puro. Sin DOM, sin Node, sin I/O.
apps/
  api/        Node + Fastify + Postgres (Drizzle). Auth con Google, partidos, eventos.
  web/        React + Vite.
```

`packages/domain` es la pieza central: el backend valida y proyecta con exactamente el
mismo código que la UI usa para mostrar. Hay un solo lugar donde vive la regla del
ranking. Ver [su README](packages/domain/README.md) para los detalles.

## Cómo correrlo

Hace falta una base de datos Postgres. Para desarrollo local, el `docker-compose.yml` de
la raíz levanta una:

```bash
docker compose up -d
```

También sirve cualquier otro Postgres, local o gestionado — [Neon](https://neon.tech)
tiene un free tier que alcanza de sobra si preferís no correr Docker.

### 1. Backend

```bash
cd apps/api
cp .env.example .env
```

Completá `.env`:

- **`DATABASE_URL`**: la cadena de conexión de tu Postgres.
- **`GOOGLE_CLIENT_ID`** / **`GOOGLE_CLIENT_SECRET`**: creados en
  [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services →
  Credentials → **Create OAuth client ID** → tipo _Web application_. En
  **Authorized redirect URIs** agregá exactamente el valor de `GOOGLE_REDIRECT_URI`
  (por defecto `http://localhost:3001/auth/google/callback`).
- **`JWT_SECRET`**: cualquier string largo al azar.

Con `.env` completo:

```bash
npm run db:generate -w @datos-futbol/api   # ya generado; solo hace falta si cambia el esquema
npm run db:migrate -w @datos-futbol/api    # crea las tablas
npm run dev -w @datos-futbol/api           # queda escuchando en :3001
```

### 2. Frontend

```bash
cd apps/web
cp .env.example .env   # VITE_API_URL, por defecto http://localhost:3001
npm run dev -w @datos-futbol/web           # queda escuchando en :5173
```

Abrí `http://localhost:5173`, iniciá sesión con Google y ya podés crear un partido.

## Cómo se usa

1. **Iniciás sesión con Google.** Es lo único que hace falta: no hay contraseñas propias
   que administrar.
2. **Mis partidos** — creás un partido nuevo, o te unís a uno existente con el código de
   6 caracteres que te pasa quien lo creó.
3. **Equipos** — escribí los nombres de quienes jugaron. La app autocompleta contra los
   que ya jugaron antes (con cualquiera, en cualquier partido) y da de alta a los nuevos
   sola.
4. **Partido** — pegá el link del video de YouTube, elegí al jugador y tocá lo que pasó.
   Cada acción se registra en el minuto en el que está el video, y la carga la puede
   hacer más de una persona a la vez: cada uno entra al mismo partido con su cuenta.
5. **Tabla** — la planilla completa, con `−` y `+` en cada celda para corregir.
6. **Resumen** — ranking, análisis automático, comparativa entre equipos y líderes.

El video tiene que ser **público o no listado**. Los privados no se pueden reproducir
fuera de YouTube, ni siquiera teniendo permiso para verlos.

Quien crea el partido es su dueño; quien se suma con el código puede cargar y corregir
estadísticas, pero no borrar el partido. Cualquiera puede deshacer su propia última
acción (`Ctrl+Z`); borrar una acción puntual del feed lo puede hacer cualquiera que esté
en el partido, y siempre queda registrado quién cargó y quién borró qué.

### Atajos de teclado

Cargar un partido es un trabajo a dos manos: una maneja el video, la otra anota.

| Tecla                            | Acción                              |
| -------------------------------- | ----------------------------------- |
| `1`…`9`, `0`, `E`, `A`, `B`, `F` | Suma la estadística al seleccionado |
| `↑` `↓`                          | Cambia de jugador                   |
| `Espacio`                        | Play / pausa                        |
| `←` `→`                          | Retrocede / adelanta 5 s            |
| `Shift` + `←` `→`                | Retrocede / adelanta 1 s            |
| `,` `.`                          | Baja / sube la velocidad            |
| `Ctrl` + `Z`                     | Deshace tu última acción            |

## Cómo se arma el ranking

Cada jugador suma un puntaje con las acciones del partido:

| Acción          | Puntos |
| --------------- | ------ |
| Gol             | +6     |
| Gol evitado     | +5     |
| Asistencia      | +4     |
| Atajada         | +2     |
| Disparo al arco | +1,5   |
| Robo de pelota  | +1     |
| Regate exitoso  | +1     |
| Intercepción    | +0,75  |
| Pase completado | +0,5   |
| Disparo errado  | −0,75  |
| Pase errado     | −0,75  |
| Regate fallido  | −0,75  |
| Falta           | −0,75  |
| Burrada         | −5     |

Los errores restan a propósito: alguien que toca mucho la pelota pero la regala no
debería subir en la tabla. Si empatan en puntaje, desempata por goles, después por
asistencias.

Solo entran al ranking los jugadores con alguna acción cargada. El **Análisis del
partido** se arma solo con esos números, y cada lectura aparece únicamente si hay datos
que la respalden: las que son porcentajes piden un mínimo de intentos (8 pases, 3
remates, 3 regates) para no coronar a alguien por un acierto suelto.

## Dónde se guardan los datos

En Postgres, del lado del servidor. Nada vive en el navegador: abrís sesión en cualquier
dispositivo y ves los mismos partidos.

Cada partido tiene un dueño (quien lo crea) y miembros que se suman con el código de
invitación. El registro de personas del grupo es compartido entre todos los partidos, así
que aunque cada fin de semana jueguen 14 distintos de un universo más grande, las
estadísticas de cada uno se acumulan correctamente entre partidos.

**La carga es en vivo.** Cuando alguien cuenta una acción, se guarda por REST (la misma
validación de siempre) y al toque se avisa por WebSocket a todos los que tienen ese
partido abierto — nadie necesita refrescar para ver lo que cargó el resto.

- **Tramos** — en la pestaña Partido, "Repartir en tramos" divide el video en partes
  iguales para que cada uno cubra la suya. Se puede agarrar, completar o soltar un tramo,
  y volver a repartir en cualquier momento (no borra estadísticas ya cargadas: un evento
  pertenece al tramo en el que cae su minuto, no a un tramo que lo "contenga").
- **Quién está ahí** — mientras el video está abierto, se ve quién más está mirando el
  partido y en qué minuto.
- **Posibles duplicados** — si dos personas cargan un gol, una atajada o una burrada con
  pocos segundos de diferencia, la acción se guarda igual pero queda marcada como
  "¿es la misma jugada?" para que alguien la resuelva. Pases, robos e intercepciones no
  se chequean: son demasiado frecuentes para que la cercanía en el tiempo signifique algo.

## Desarrollo

```bash
npm test          # dominio + backend + frontend
npm run typecheck
npm run lint
npm run format
```

El dominio tiene **tests de caracterización**: comparan su salida contra la de la
implementación original de la app (una versión de un solo archivo HTML que esta
reemplazó), grabada en `packages/domain/test/golden/`. Mientras pasen, ningún cambio
posterior alteró un número del ranking, un porcentaje, ni una palabra del análisis.

Los casos de uso del backend (`apps/api/test/application/`) se testean contra
repositorios en memoria, sin necesitar Postgres corriendo.

`packages/domain` se compila a `dist/` (el `postinstall` de la raíz lo hace solo). El
backend en desarrollo consume esa compilación, así que si tocás el dominio corré
`npm run build -w @datos-futbol/domain`. Los tests y el frontend leen el código fuente
directamente, no la compilación.

## Deploy

La API necesita un proceso que viva: las funciones serverless no sostienen WebSockets.
Por eso van separados — el frontend estático en **Vercel**, la API en **Railway** y la
base en **Neon**.

### 1. Base de datos (Neon)

Creá un proyecto en [Neon](https://neon.tech) y guardá la connection string. Las
migraciones se aplican solas en cada deploy de Railway, antes de arrancar el servidor.

### 2. API (Railway)

Un proyecto nuevo apuntando a este repo. `railway.json` ya define el build, el arranque y
el health check contra `/health`; solo hay que cargar las variables:

| Variable                                    | Valor                                               |
| ------------------------------------------- | --------------------------------------------------- |
| `DATABASE_URL`                              | la de Neon, con `?sslmode=require`                  |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | los mismos que en desarrollo                        |
| `GOOGLE_REDIRECT_URI`                       | `https://<api>.up.railway.app/auth/google/callback` |
| `JWT_SECRET`                                | un string largo al azar, distinto al de local       |
| `WEB_ORIGIN`                                | `https://<web>.vercel.app`                          |
| `COOKIE_SECURE`                             | `true`                                              |
| `COOKIE_SAMESITE`                           | `none`                                              |

`PORT` lo inyecta Railway. Las dos últimas no son opcionales: web y API quedan en dominios
distintos, así que la cookie de sesión es cross-site y sin `SameSite=None; Secure` el
navegador no la manda — ni en las llamadas a la API ni en el handshake del WebSocket, que
autentica leyendo esa misma cookie. Si ponés `none` sin `secure`, el servidor se niega a
arrancar en vez de dejarte un login que nunca pega.

### 3. Frontend (Vercel)

El mismo repo; `vercel.json` ya dice qué compilar y de dónde sale. Una sola variable:

```
VITE_API_URL=https://<api>.up.railway.app
```

### 4. Google OAuth

En la consola de Google, al cliente OAuth que ya usás agregale en **Authorized redirect
URIs** el `GOOGLE_REDIRECT_URI` de producción. Los de desarrollo pueden quedar: acepta
varios.

El orden importa solo por las URLs: hasta que Vercel y Railway no te dan sus dominios no
podés completar `WEB_ORIGIN` ni `VITE_API_URL`. Deployá los dos, anotá las URLs, cargá las
variables y volvé a deployar.
