import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'

export type ErrorCode =
  | 'validation_error'
  | 'missing_api_key'
  | 'invalid_api_key'
  | 'not_found'
  | 'configuration_error'
  | 'application_error'

export interface ErrorResponse {
  statusCode: number
  name: ErrorCode
  message: string
}

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly name: ErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.cause = cause
  }
}

export function validationError(message: string, cause?: unknown): AppError {
  return new AppError(422, 'validation_error', message, cause)
}

export function notFound(message: string): AppError {
  return new AppError(404, 'not_found', message)
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

export function serializeError(error: unknown): ErrorResponse {
  if (isAppError(error)) {
    return {
      statusCode: error.statusCode,
      name: error.name,
      message: error.message,
    }
  }

  if (error instanceof ZodError) {
    return {
      statusCode: 422,
      name: 'validation_error',
      message: error.issues.map((issue) => issue.message).join(', '),
    }
  }

  return {
    statusCode: 500,
    name: 'application_error',
    message: 'Internal server error',
  }
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const body = serializeError(error)
    if (body.statusCode >= 500) {
      request.log.error(error, 'Request failed')
    } else {
      request.log.warn({ err: error }, 'Request rejected')
    }
    reply.code(body.statusCode).send(body)
  })
}
