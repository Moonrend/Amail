import type { FastifyRequest, FastifyReply } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { apiKeys } from '../db/schema.js'
import { now } from '../db/timestamp.js'
import { hashKey } from '../crypto.js'
import { config } from '../config.js'

/**
 * Authenticate API requests using Bearer token.
 * Compatible with Resend's `Authorization: Bearer re_xxxxx` format.
 * Our tokens use `am_` prefix.
 */
export async function authenticateApi(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({
      statusCode: 401,
      name: 'missing_api_key',
      message: 'Missing API key in Authorization header',
    })
    return null
  }

  const token = authHeader.slice(7).trim()
  const keyHash = hashKey(token)

  const db = getDb()
  const apiKey = db.select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, 1)))
    .get()

  if (!apiKey) {
    reply.code(403).send({
      statusCode: 403,
      name: 'invalid_api_key',
      message: 'API key is not valid',
    })
    return null
  }

  // Update last used
  db.update(apiKeys)
    .set({ lastUsedAt: now() })
    .where(eq(apiKeys.id, apiKey.id))
    .run()

  return apiKey
}

/**
 * Authenticate admin management API requests.
 * Uses a static admin token from environment.
 */
export async function authenticateAdmin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  if (!config.adminToken) {
    reply.code(500).send({
      statusCode: 500,
      name: 'configuration_error',
      message: 'ADMIN_TOKEN not configured',
    })
    return false
  }

  const authHeader = request.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({
      statusCode: 401,
      name: 'missing_api_key',
      message: 'Missing admin token',
    })
    return false
  }

  const token = authHeader.slice(7).trim()
  if (token !== config.adminToken) {
    reply.code(403).send({
      statusCode: 403,
      name: 'invalid_api_key',
      message: 'Invalid admin token',
    })
    return false
  }

  return true
}
