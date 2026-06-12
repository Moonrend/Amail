import type { FastifyInstance } from 'fastify'
import { eq, and, gt, lt, desc, asc } from 'drizzle-orm'
import { authenticateApi } from '../auth/middleware.js'
import { processSendEmail, type SendEmailInput } from '../services/email-sender.js'
import { listSmtpConfigs } from '../smtp/manager.js'
import { getDb } from '../db/index.js'
import { emailLogs } from '../db/schema.js'
import { assertParsed, parseBatchEmailBody, parseSendEmailBody } from './email-schema.js'

export async function emailRoutes(app: FastifyInstance): Promise<void> {
  // POST /emails — Send a single email (Resend-compatible)
  app.post('/emails', async (request, reply) => {
    const apiKey = await authenticateApi(request, reply)
    if (!apiKey) return

    const data = assertParsed(parseSendEmailBody(request.body))

    const idempotencyKey = request.headers['idempotency-key'] as string | undefined

    const result = await processSendEmail(data as SendEmailInput, apiKey.id, idempotencyKey)
    return reply.code(200).send({ id: result.id })
  })

  // POST /emails/batch — Send batch emails (Resend-compatible)
  app.post('/emails/batch', async (request, reply) => {
    const apiKey = await authenticateApi(request, reply)
    if (!apiKey) return

    const emails = assertParsed(parseBatchEmailBody(request.body))

    const results: Array<{ id: string }> = []
    for (const emailInput of emails) {
      try {
        const result = await processSendEmail(emailInput as SendEmailInput, apiKey.id)
        results.push({ id: result.id })
      } catch (err) {
        request.log.warn({ err }, 'Skipped failed batch email')
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
    const email = db.select({
      id: emailLogs.id,
      from: emailLogs.fromAddress,
      to: emailLogs.toAddresses,
      subject: emailLogs.subject,
      status: emailLogs.status,
      last_error: emailLogs.errorMessage,
      message_id: emailLogs.messageId,
      scheduled_at: emailLogs.scheduledAt,
      created_at: emailLogs.createdAt,
      sent_at: emailLogs.sentAt,
    })
      .from(emailLogs)
      .where(eq(emailLogs.id, request.params.id))
      .get()

    if (!email) {
      return reply.code(404).send({
        statusCode: 404,
        name: 'not_found',
        message: 'Email not found',
      })
    }

    try { email.to = JSON.parse(email.to) } catch { /* keep as is */ }

    const last_event = email.status === 'delivered' ? 'delivered'
      : email.status === 'failed' ? 'failed'
      : email.status === 'cancelled' ? 'canceled'
      : email.status === 'queued' ? 'queued'
      : email.status === 'sending' ? 'sent'
      : email.status

    return reply.send({ ...email, last_event })
  })

  // POST /emails/:id/cancel — Cancel a scheduled email (Resend-compatible)
  app.post<{ Params: { id: string } }>('/emails/:id/cancel', async (request, reply) => {
    const apiKey = await authenticateApi(request, reply)
    if (!apiKey) return

    const db = getDb()
    const email = db.select({ id: emailLogs.id, status: emailLogs.status })
      .from(emailLogs)
      .where(eq(emailLogs.id, request.params.id))
      .get()

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

    db.update(emailLogs).set({ status: 'cancelled' }).where(eq(emailLogs.id, request.params.id)).run()
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

    const selectFields = {
      id: emailLogs.id,
      from: emailLogs.fromAddress,
      to: emailLogs.toAddresses,
      subject: emailLogs.subject,
      status: emailLogs.status,
      created_at: emailLogs.createdAt,
      sent_at: emailLogs.sentAt,
    }

    let rows: any[]

    if (after) {
      // Fetch items created after the given cursor
      const cursor = db.select({ created_at: emailLogs.createdAt })
        .from(emailLogs)
        .where(eq(emailLogs.id, after))
        .get()
      if (!cursor) return reply.send({ data: [] })

      rows = db.select(selectFields)
        .from(emailLogs)
        .where(and(eq(emailLogs.apiKeyId, apiKey.id), gt(emailLogs.createdAt, cursor.created_at)))
        .orderBy(asc(emailLogs.createdAt))
        .limit(limit + 1)
        .all()
    } else if (before) {
      const cursor = db.select({ created_at: emailLogs.createdAt })
        .from(emailLogs)
        .where(eq(emailLogs.id, before))
        .get()
      if (!cursor) return reply.send({ data: [] })

      rows = db.select(selectFields)
        .from(emailLogs)
        .where(and(eq(emailLogs.apiKeyId, apiKey.id), lt(emailLogs.createdAt, cursor.created_at)))
        .orderBy(desc(emailLogs.createdAt))
        .limit(limit + 1)
        .all()
    } else {
      rows = db.select(selectFields)
        .from(emailLogs)
        .where(eq(emailLogs.apiKeyId, apiKey.id))
        .orderBy(desc(emailLogs.createdAt))
        .limit(limit + 1)
        .all()
    }

    const hasMore = rows.length > limit
    const data = rows.slice(0, limit).map((r: any) => {
      try { r.to = JSON.parse(r.to) } catch { /* keep */ }
      return r
    })

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
    const email = db.select({ id: emailLogs.id, status: emailLogs.status })
      .from(emailLogs)
      .where(eq(emailLogs.id, request.params.id))
      .get()

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

    db.update(emailLogs).set({ status: 'cancelled' }).where(eq(emailLogs.id, request.params.id)).run()
    return reply.send({ object: 'email', id: request.params.id, deleted: true })
  })
}
