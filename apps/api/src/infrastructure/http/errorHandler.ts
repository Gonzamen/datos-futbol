import type { FastifyError, FastifyInstance } from 'fastify'
import { AppError } from '../../application/errors.js'

const STATUS_BY_CODE: Record<AppError['code'], number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  INVALID: 400,
  CONFLICT: 409,
}

/**
 * Use cases throw {@link AppError} for anything a client should see a clear
 * message for; routes never catch it themselves. Anything else is a bug and
 * gets logged with a stack trace instead of leaked to the response.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      reply.code(STATUS_BY_CODE[error.code]).send({ error: error.message })
      return
    }

    if (error.validation) {
      reply.code(400).send({ error: 'Los datos enviados no tienen el formato esperado.' })
      return
    }

    request.log.error(error)
    reply.code(500).send({ error: 'Error interno.' })
  })
}
