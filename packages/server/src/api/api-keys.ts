import type { FastifyInstance } from 'fastify'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { authenticateAdmin } from '../auth/middleware.js'
import { getDb } from '../db/index.js'
import { apiKeys } from '../db/schema.js'
import { now } from '../db/timestamp.js'
import { hashKey, generateApiKey } from '../crypto.js'

const apiKeySchema = z.object({
  name: z.string().min(1),
})

export async function apiKeyRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/api-keys — List all API keys
  app.get('/api/api-keys', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return

    const db = getDb()
    const rows = db.select({
      id: apiKeys.id,
      name: apiKeys.name,
      key_prefix: apiKeys.keyPrefix,
      is_active: apiKeys.isActive,
      last_used_at: apiKeys.lastUsedAt,
      created_at: apiKeys.createdAt,
    })
      .from(apiKeys)
      .orderBy(desc(apiKeys.createdAt))
      .all()
    return reply.send(rows)
  })

  // POST /api/api-keys — Create API key (returns full key only once)
  app.post('/api/api-keys', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return

    const parsed = apiKeySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues })
    }

    const id = nanoid()
    const fullKey = generateApiKey()
    const keyHash = hashKey(fullKey)
    const keyPrefix = fullKey.slice(0, 10) + '...'

    const db = getDb()
    db.insert(apiKeys).values({
      id,
      name: parsed.data.name,
      keyHash,
      keyPrefix,
      createdAt: now(),
    }).run()

    return reply.code(201).send({
      id,
      name: parsed.data.name,
      key: fullKey,
      key_prefix: keyPrefix,
    })
  })

  // GET /api/api-keys/:id
  app.get<{ Params: { id: string } }>('/api/api-keys/:id', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return

    const db = getDb()
    const row = db.select({
      id: apiKeys.id,
      name: apiKeys.name,
      key_prefix: apiKeys.keyPrefix,
      is_active: apiKeys.isActive,
      last_used_at: apiKeys.lastUsedAt,
      created_at: apiKeys.createdAt,
    })
      .from(apiKeys)
      .where(eq(apiKeys.id, request.params.id))
      .get()
    if (!row) return reply.code(404).send({ error: 'Not found' })
    return reply.send(row)
  })

  // DELETE /api/api-keys/:id
  app.delete<{ Params: { id: string } }>('/api/api-keys/:id', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return

    const db = getDb()
    db.delete(apiKeys).where(eq(apiKeys.id, request.params.id)).run()
    return reply.send({ deleted: true })
  })

  // PATCH /api/api-keys/:id/toggle — Enable/disable
  app.patch<{ Params: { id: string } }>('/api/api-keys/:id/toggle', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return

    const db = getDb()
    const row = db.select({ id: apiKeys.id, isActive: apiKeys.isActive })
      .from(apiKeys)
      .where(eq(apiKeys.id, request.params.id))
      .get()
    if (!row) return reply.code(404).send({ error: 'Not found' })

    db.update(apiKeys)
      .set({ isActive: row.isActive ? 0 : 1 })
      .where(eq(apiKeys.id, request.params.id))
      .run()
    return reply.send({ id: row.id, is_active: !row.isActive })
  })
}
