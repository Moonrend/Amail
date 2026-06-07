import type { FastifyInstance } from 'fastify'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { authenticateAdmin } from '../auth/middleware.js'
import { getDb } from '../db/index.js'
import { hashKey, generateApiKey } from '../crypto.js'

const apiKeySchema = z.object({
  name: z.string().min(1),
})

export async function apiKeyRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/api-keys — List all API keys
  app.get('/api/api-keys', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return

    const db = getDb()
    const rows = db.prepare(`
      SELECT id, name, key_prefix, is_active, last_used_at, created_at
      FROM api_keys ORDER BY created_at DESC
    `).all()
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
    db.prepare(`
      INSERT INTO api_keys (id, name, key_hash, key_prefix)
      VALUES (?, ?, ?, ?)
    `).run(id, parsed.data.name, keyHash, keyPrefix)

    return reply.code(201).send({
      id,
      name: parsed.data.name,
      key: fullKey, // Only returned on creation
      key_prefix: keyPrefix,
    })
  })

  // GET /api/api-keys/:id
  app.get<{ Params: { id: string } }>('/api/api-keys/:id', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return

    const db = getDb()
    const row = db.prepare(`
      SELECT id, name, key_prefix, is_active, last_used_at, created_at
      FROM api_keys WHERE id = ?
    `).get(request.params.id)
    if (!row) return reply.code(404).send({ error: 'Not found' })
    return reply.send(row)
  })

  // DELETE /api/api-keys/:id
  app.delete<{ Params: { id: string } }>('/api/api-keys/:id', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return

    const db = getDb()
    db.prepare('DELETE FROM api_keys WHERE id = ?').run(request.params.id)
    return reply.send({ deleted: true })
  })

  // PATCH /api/api-keys/:id/toggle — Enable/disable
  app.patch<{ Params: { id: string } }>('/api/api-keys/:id/toggle', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return

    const db = getDb()
    const row = db.prepare('SELECT id, is_active FROM api_keys WHERE id = ?').get(request.params.id) as any
    if (!row) return reply.code(404).send({ error: 'Not found' })

    db.prepare('UPDATE api_keys SET is_active = ? WHERE id = ?').run(row.is_active ? 0 : 1, request.params.id)
    return reply.send({ id: row.id, is_active: !row.is_active })
  })
}
