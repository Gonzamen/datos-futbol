/**
 * Failures a use case can produce for a reason the caller should react to
 * differently — as opposed to a thrown bug, which should just 500. The HTTP
 * layer maps each `code` to a status; nothing outside `application/` needs to
 * know that mapping.
 */
export class AppError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID' | 'CONFLICT',
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function notFound(message: string): AppError {
  return new AppError('NOT_FOUND', message)
}

export function forbidden(message: string): AppError {
  return new AppError('FORBIDDEN', message)
}

export function invalid(message: string): AppError {
  return new AppError('INVALID', message)
}

export function conflict(message: string): AppError {
  return new AppError('CONFLICT', message)
}
