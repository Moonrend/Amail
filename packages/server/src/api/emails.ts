import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { authenticateApi } from '../auth/middleware.js'
import { processSendEmail, type SendEmailInput } from '../services/email-sender.js'
import { listSmtpConfigs } from '../smtp/manager.js'
import { getDb } from '../db/index.js'

const sendEmailSchema = z.object({
  from: z.string().optional(),
  to: z.union([z.string(), z.array(z.string()).max(50)]),
  subject: z.string().min(1),
  html: z.string().optional(),
  text: z.string().optional(),
  cc: z.union([z.string(), z.array(z.string())]).optional(),
  bcc: z.union([z.string(), z.array(z.string())]).optional(),
  reply_to: z.union([z.string(), z.array(z.string())]).optional(),
  headers: z.record(z.string()).optional(),
  tags: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  attachments: z.array(z.object({
    content: z.union([z.string(), z.instanceof(Buffer)]).optional(),
    filename: z.string().optional(),
    path: z.string().optional(),
    content_type: z.string().optional(),
    content_id: z.string().optional(),
  })).optional(),
  scheduled_at: z.string().optional(),
  provider: z.string().optional(),
})

const batchEmailSchema = z.array(sendEmailSchema).max(100)

export async function emailRoutes(app: FastifyInstance): Promise<void> {
  // POST /emails — Send a single email (Resend-compatible)
  app.post('/emails', async (request, reply) => {
    const apiKey = await authenticateApi(request, reply)
    if (!apiKey) return

    const parsed = sendEmailSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        statusCode: 422,
        name: 'validation_error',
        message: parsed.error.issues.map(i => i.message).join(', '),
      })
    }

    const idempotencyKey = request.headers['idempotency-key'] as string | undefined

    try {
      const result = await processSendEmail(parsed.data as SendEmailInput, apiKey.id, idempotencyKey)
      return reply.code(200).send({ id: result.id })
    } catch (err: any) {
      request.log.error(err, 'Failed to send email')
      return reply.code(500).send({
        statusCode: 500,
        name: 'application_error',
        message: err.message || 'Internal server error',
      })
    }
  })

  // POST /emails/batch — Send batch emails (Resend-compatible)
  app.post('/emails/batch', async (request, reply) => {
    const apiKey = await authenticateApi(request, reply)
    if (!apiKey) return

    const parsed = batchEmailSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        statusCode: 422,
        name: 'validation_error',
        message: parsed.error.issues.map(i => i.message).join(', '),
      })
    }

    const results: Array<{ id: string }> = []
    for (const emailInput of parsed.data) {
      try {
        const result = await processSendEmail(emailInput as SendEmailInput, apiKey.id)
        results.push({ id: result.id })
      } catch {
        // Continue with remaining emails
      }
    }

    return reply.code(200).send({ data: results })
  })

  // GET /emails/:id — Get email by ID
  app.get<{ Params: { id: string } }>('/emails/:id', async (request, reply) => {
    const apiKey = await authenticateApi(request, reply)
    if (!apiKey) return

    const db = getDb()
    const email = db.prepare(`
      SELECT id, from_address as "from", to_addresses as "to", subject,
        cc_addresses as cc, bcc_addresses as bcc, tags, headers, status,
        error_message as last_error, message_id, scheduled_at, created_at, sent_at
      FROM email_logs WHERE id = ?
    `).get(request.params.id) as any

    if (!email) {
      return reply.code(404).send({
        statusCode: 404,
        name: 'not_found',
        message: 'Email not found',
      })
    }

    // Parse JSON fields
    try { email.to = JSON.parse(email.to) } catch { /* keep as is */ }
    try { email.cc = JSON.parse(email.cc) } catch { /* keep as is */ }
    try { email.bcc = JSON.parse(email.bcc) } catch { /* keep as is */ }
    try { email.tags = JSON.parse(email.tags) } catch { /* keep as is */ }
    try { email.headers = JSON.parse(email.headers) } catch { /* keep as is */ }

    // Add last_event for Resend compatibility
    email.last_event = email.status === 'delivered' ? 'delivered'
      : email.status === 'failed' ? 'failed'
      : email.status === 'cancelled' ? 'canceled'
      : email.status === 'queued' ? 'queued'
      : email.status === 'sending' ? 'sent'
      : email.status

    return reply.send(email)
  })

  // POST /emails/:id/cancel — Cancel a scheduled email (Resend-compatible)
  app.post<{ Params: { id: string } }>('/emails/:id/cancel', async (request, reply) => {
    const apiKey = await authenticateApi(request, reply)
    if (!apiKey) return

    const db = getDb()
    const email = db.prepare('SELECT id, status FROM email_logs WHERE id = ?').get(request.params.id) as any

    if (!email) {
      return reply.code(404).send({
        statusCode: 404,
        name: 'not_found',
        message: 'Email not found',
      })
    }

    if (email.status !== 'queued' && email.status !== 'scheduled') {
      return reply.code(422).send({
        statusCode: 422,
        name: 'validation_error',
        message: 'Can only cancel queued or scheduled emails',
      })
    }

    db.prepare('UPDATE email_logs SET status = \'cancelled\' WHERE id = ?').run(request.params.id)
    return reply.send({ object: 'email', id: request.params.id, deleted: true })
  })

  // GET /emails — List emails (Resend-compatible, cursor-based pagination)
  app.get<{
    Querystring: { limit?: string; after?: string; before?: string }
  }>('/emails', async (request, reply) => {
    const apiKey = await authenticateApi(request, reply)
    if (!apiKey) return

    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '10', 10)))
    const after = request.query.after
    const before = request.query.before

    const db = getDb()
    let query: string
    let params: any[]

    if (after) {
      // Fetch items created after the given cursor
      query = `SELECT id, from_address as "from", to_addresses as "to", subject, status, created_at, sent_at
        FROM email_logs WHERE api_key_id = ? AND created_at > (SELECT created_at FROM email_logs WHERE id = ?)
        ORDER BY created_at ASC LIMIT ?`
      params = [apiKey.id, after, limit + 1]
    } else if (before) {
      // Fetch items created before the given cursor
      query = `SELECT id, from_address as "from", to_addresses as "to", subject, status, created_at, sent_at
        FROM email_logs WHERE api_key_id = ? AND created_at < (SELECT created_at FROM email_logs WHERE id = ?)
        ORDER BY created_at DESC LIMIT ?`
      params = [apiKey.id, before, limit + 1]
    } else {
      query = `SELECT id, from_address as "from", to_addresses as "to", subject, status, created_at, sent_at
        FROM email_logs WHERE api_key_id = ?
        ORDER BY created_at DESC LIMIT ?`
      params = [apiKey.id, limit + 1]
    }

    const rows = db.prepare(query).all(...params) as any[]
    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map((r: any) => {
      try { r.to = JSON.parse(r.to) } catch { /* keep */ }
      return r
    })

    // Reverse if we queried DESC for the "before" case
    if (before) data.reverse()

    return reply.send({
      data,
      ...(hasMore ? { has_more: true } : {}),
    })
  })

  // GET /emails/providers — List available SMTP providers (for client use)
  app.get('/emails/providers', async (request, reply) => {
    const apiKey = await authenticateApi(request, reply)
    if (!apiKey) return

    try {
      const configs = await listSmtpConfigs()
      return reply.send({
        data: configs.map(c => ({
          id: c.id,
          name: c.name,
          host: c.host,
          from_address: c.from_address,
        })),
      })
    } catch (err: any) {
      request.log.error(err, 'Failed to list providers')
      return reply.code(500).send({
        statusCode: 500,
        name: 'application_error',
        message: err.message || 'Internal server error',
      })
    }
  })

  // DELETE /emails/:id — Cancel a scheduled email (backward compat)
  app.delete<{ Params: { id: string } }>('/emails/:id', async (request, reply) => {
    const apiKey = await authenticateApi(request, reply)
    if (!apiKey) return

    const db = getDb()
    const email = db.prepare('SELECT id, status FROM email_logs WHERE id = ?').get(request.params.id) as any

    if (!email) {
      return reply.code(404).send({
        statusCode: 404,
        name: 'not_found',
        message: 'Email not found',
      })
    }

    if (email.status !== 'queued' && email.status !== 'scheduled') {
      return reply.code(422).send({
        statusCode: 422,
        name: 'validation_error',
        message: 'Can only cancel queued or scheduled emails',
      })
    }

    db.prepare('UPDATE email_logs SET status = \'cancelled\' WHERE id = ?').run(request.params.id)
    return reply.send({ object: 'email', id: request.params.id, deleted: true })
  })
}
