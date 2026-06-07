import type { FastifyRequest, FastifyReply } from 'fastify'
import { getDb } from '../db/index.js'
import { hashKey } from '../crypto.js'
import { config } from '../config.js'

interface ApiKeyRow {
  id: string
  name: string
  key_hash: string
  key_prefix: string
  is_active: number
}

/**
 * Authenticate API requests using Bearer token.
 * Compatible with Resend's `Authorization: Bearer re_xxxxx` format.
 * Our tokens use `am_` prefix.
 */
export async function authenticateApi(request: FastifyRequest, reply: FastifyReply): Promise<ApiKeyRow | null> {
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
  const apiKey = db.prepare('SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1').get(keyHash) as ApiKeyRow | undefined

  if (!apiKey) {
    reply.code(403).send({
      statusCode: 403,
      name: 'invalid_api_key',
      message: 'API key is not valid',
    })
    return null
  }

  // Update last used
  db.prepare('UPDATE api_keys SET last_used_at = datetime(\'now\') WHERE id = ?').run(apiKey.id)

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
