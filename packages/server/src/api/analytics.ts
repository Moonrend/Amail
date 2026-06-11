import type { FastifyInstance } from 'fastify'
import { eq, and, desc, sql } from 'drizzle-orm'
import { authenticateAdmin } from '../auth/middleware.js'
import { getOverview, getDailyStats, getSmtpUsage, clearLogs, getProviderDistribution, getKeyUsage, getRecipientStats } from '../services/analytics.js'
import { getDb } from '../db/index.js'
import { emailLogs, apiKeys, smtpConfigs } from '../db/schema.js'

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/analytics/overview
  app.get('/api/analytics/overview', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return
    return reply.send(getOverview())
  })

  // GET /api/analytics/daily
  app.get<{ Querystring: { days?: string; api_key_id?: string; smtp_config_id?: string } }>('/api/analytics/daily', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return
    const days = parseInt(request.query.days || '30', 10)
    const filters: { api_key_id?: string; smtp_config_id?: string } = {}
    if (request.query.api_key_id) filters.api_key_id = request.query.api_key_id
    if (request.query.smtp_config_id) filters.smtp_config_id = request.query.smtp_config_id
    return reply.send(getDailyStats(days, filters))
  })

  // GET /api/analytics/smtp-usage
  app.get('/api/analytics/smtp-usage', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return
    return reply.send(getSmtpUsage())
  })

  // GET /api/analytics/provider-distribution
  app.get('/api/analytics/provider-distribution', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return
    return reply.send(getProviderDistribution())
  })

  // GET /api/analytics/key-usage
  app.get('/api/analytics/key-usage', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return
    return reply.send(getKeyUsage())
  })

  // GET /api/analytics/recipient-stats
  app.get<{ Querystring: { limit?: string } }>('/api/analytics/recipient-stats', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '20', 10)))
    return reply.send(getRecipientStats(limit))
  })

  // DELETE /api/analytics/logs — Clear all email logs
  app.delete('/api/analytics/logs', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return
    clearLogs()
    return reply.send({ success: true })
  })

  // GET /api/emails — Email logs (management)
  app.get<{
    Querystring: { page?: string; limit?: string; status?: string; api_key_id?: string }
  }>('/api/emails', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return

    const page = Math.max(1, parseInt(request.query.page || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '20', 10)))
    const offset = (page - 1) * limit
    const status = request.query.status
    const apiKeyId = request.query.api_key_id

    const db = getDb()

    // Build conditions
    const conditions = []
    if (status) conditions.push(eq(emailLogs.status, status))
    if (apiKeyId) conditions.push(eq(emailLogs.apiKeyId, apiKeyId))
    const where = conditions.length ? and(...conditions) : undefined

    const totalRow = db.select({ count: sql<number>`count(*)` })
      .from(emailLogs)
      .where(where)
      .get()!
    const total = totalRow.count

    const rows = db.select({
      id: emailLogs.id,
      api_key_id: emailLogs.apiKeyId,
      smtp_config_id: emailLogs.smtpConfigId,
      from_address: emailLogs.fromAddress,
      to_addresses: emailLogs.toAddresses,
      subject: emailLogs.subject,
      has_html: emailLogs.hasHtml,
      has_text: emailLogs.hasText,
      has_attachments: emailLogs.hasAttachments,
      attachment_count: emailLogs.attachmentCount,
      status: emailLogs.status,
      error_message: emailLogs.errorMessage,
      message_id: emailLogs.messageId,
      created_at: emailLogs.createdAt,
      sent_at: emailLogs.sentAt,
      key_name: apiKeys.name,
      key_prefix: apiKeys.keyPrefix,
      provider_name: smtpConfigs.name,
    })
      .from(emailLogs)
      .leftJoin(apiKeys, eq(apiKeys.id, emailLogs.apiKeyId))
      .leftJoin(smtpConfigs, eq(smtpConfigs.id, emailLogs.smtpConfigId))
      .where(where)
      .orderBy(desc(emailLogs.createdAt))
      .limit(limit)
      .offset(offset)
      .all()

    return reply.send({
      data: rows.map((r: any) => {
        try { r.to_addresses = JSON.parse(r.to_addresses) } catch { /* keep */ }
        return r
      }),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  })
}
