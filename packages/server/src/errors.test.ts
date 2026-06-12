import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AppError, serializeError } from './errors.js'

test('serializes AppError with public status, name, and message', () => {
  const result = serializeError(new AppError(404, 'not_found', 'Email not found'))

  assert.deepEqual(result, {
    statusCode: 404,
    name: 'not_found',
    message: 'Email not found',
  })
})

test('hides unknown internal errors from public responses', () => {
  const result = serializeError(new Error('database password leaked'))

  assert.deepEqual(result, {
    statusCode: 500,
    name: 'application_error',
    message: 'Internal server error',
  })
})
