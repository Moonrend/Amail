import type { FastifyInstance } from 'fastify'
import { authenticateAdmin } from '../auth/middleware.js'
import { getOverview, getDailyStats, getSmtpUsage } from '../services/analytics.js'
import { getDb } from '../db/index.js'

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/analytics/overview
  app.get('/api/analytics/overview', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return
    return reply.send(getOverview())
  })

  // GET /api/analytics/daily
  app.get<{ Querystring: { days?: string } }>('/api/analytics/daily', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return
    const days = parseInt(request.query.days || '30', 10)
    return reply.send(getDailyStats(days))
  })

  // GET /api/analytics/smtp-usage
  app.get('/api/analytics/smtp-usage', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return
    return reply.send(getSmtpUsage())
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
      where += ' AND status = ?'
      params.push(status)
    }
    if (apiKeyId) {
      where += ' AND api_key_id = ?'
      params.push(apiKeyId)
    }

    const total = (db.prepare(`SELECT COUNT(*) as count FROM email_logs WHERE ${where}`).get(...params) as any).count
    const rows = db.prepare(`
      SELECT id, api_key_id, smtp_config_id, from_address, to_addresses, subject,
        status, error_message, message_id, created_at, sent_at
      FROM email_logs WHERE ${where}
      ORDER BY created_at DESC LIMIT ? OFFSET ?
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
