import type { FastifyInstance } from 'fastify'
import { authenticateAdmin } from '../auth/middleware.js'
import { getOverview, getDailyStats, getSmtpUsage, clearLogs, getProviderDistribution, getKeyUsage, getRecipientStats } from '../services/analytics.js'
import { getDb } from '../db/index.js'

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
    let where = '1=1'
    const params: any[] = []

    if (status) {
      where += ' AND e.status = ?'
      params.push(status)
    }
    if (apiKeyId) {
      where += ' AND e.api_key_id = ?'
      params.push(apiKeyId)
    }

    const total = (db.prepare(`SELECT COUNT(*) as count FROM email_logs e WHERE ${where}`).get(...params) as any).count
    const rows = db.prepare(`
      SELECT e.id, e.api_key_id, e.smtp_config_id, e.from_address, e.to_addresses, e.subject,
        e.has_html, e.has_text, e.has_attachments, e.attachment_count,
        e.status, e.error_message, e.message_id, e.created_at, e.sent_at,
        k.name as key_name, k.key_prefix,
        s.name as provider_name
      FROM email_logs e
      LEFT JOIN api_keys k ON k.id = e.api_key_id
      LEFT JOIN smtp_configs s ON s.id = e.smtp_config_id
      WHERE ${where}
      ORDER BY e.created_at DESC LIMIT ? OFFSET ?
    `).all(...params, limit, offset)

    return reply.send({
      data: rows.map((r: any) => {
        try { r.to_addresses = JSON.parse(r.to_addresses) } catch { /* keep */ }
        return r
      }),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  })
}
