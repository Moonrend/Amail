import type { FastifyInstance } from 'fastify'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { eq, desc } from 'drizzle-orm'
import { authenticateAdmin } from '../auth/middleware.js'
import { getDb } from '../db/index.js'
import { smtpConfigs } from '../db/schema.js'
import { now } from '../db/timestamp.js'
import { encrypt, decrypt } from '../crypto.js'
import { testSmtpConnection, invalidateTransporter, sendEmail } from '../smtp/manager.js'
import { discoverSmtpConfig } from '../smtp/autoconfig.js'

function escHtml(s: string | null | undefined): string {
  if (!s) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const smtpConfigSchema = z.object({
  name: z.string().max(100).optional(),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean().default(false),
  auth_type: z.enum(['password', 'oauth2', 'plain', 'login', 'cram-md5', 'none']).default('password'),
  username: z.string().optional(),
  password: z.string().optional(),
  oauth2_client_id: z.string().optional(),
  oauth2_client_secret: z.string().optional(),
  oauth2_refresh_token: z.string().optional(),
  oauth2_tenant_id: z.string().optional(),
  from_address: z.string().optional(),
  from_name: z.string().optional(),
})

const smtpConfigUpdateSchema = smtpConfigSchema.omit({ name: true }).partial()

function encryptSensitiveFields(data: any) {
  const result: any = { ...data }
  if (data.password) result.password_encrypted = encrypt(data.password)
  if (data.oauth2_client_secret) result.oauth2_client_secret_encrypted = encrypt(data.oauth2_client_secret)
  if (data.oauth2_refresh_token) result.oauth2_refresh_token_encrypted = encrypt(data.oauth2_refresh_token)
  delete result.password
  delete result.oauth2_client_secret
  delete result.oauth2_refresh_token
  return result
}

function decryptSensitiveFields(row: any) {
  const result = { ...row }
  if (result.passwordEncrypted) {
    try { result.password = decrypt(result.passwordEncrypted) } catch { /* ignore */ }
  }
  if (result.oauth2ClientSecretEncrypted) {
    try { result.oauth2_client_secret = decrypt(result.oauth2ClientSecretEncrypted) } catch { /* ignore */ }
  }
  if (result.oauth2RefreshTokenEncrypted) {
    try { result.oauth2_refresh_token = decrypt(result.oauth2RefreshTokenEncrypted) } catch { /* ignore */ }
  }
  delete result.passwordEncrypted
  delete result.oauth2ClientSecretEncrypted
  delete result.oauth2RefreshTokenEncrypted
  return result
}

export async function smtpConfigRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/autoconfig — Discover SMTP config from domain
  app.get<{ Querystring: { domain: string } }>('/api/autoconfig', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return

    const domain = request.query.domain
    if (!domain || !domain.includes('.')) {
      return reply.code(400).send({ error: 'Valid domain required' })
    }

    try {
      const result = await discoverSmtpConfig(domain)
      return reply.send(result)
    } catch (err: any) {
      return reply.send({ domain, smtp: [], source: 'error', error: err.message })
    }
  })

  // GET /api/smtp-configs — List all SMTP configs
  app.get('/api/smtp-configs', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return

    const db = getDb()
    const rows = db.select().from(smtpConfigs).orderBy(desc(smtpConfigs.createdAt)).all()
    return reply.send(rows.map(decryptSensitiveFields))
  })

  // POST /api/smtp-configs — Create SMTP config
  app.post('/api/smtp-configs', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return

    const parsed = smtpConfigSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues })
    }

    const id = nanoid()
    const db = getDb()
    const encrypted = encryptSensitiveFields(parsed.data)

    const ts = now()
    db.insert(smtpConfigs).values({
      id,
      name: encrypted.name || null,
      host: encrypted.host,
      port: encrypted.port,
      secure: encrypted.secure ? 1 : 0,
      authType: encrypted.auth_type,
      username: encrypted.username || null,
      passwordEncrypted: encrypted.password_encrypted || null,
      oauth2ClientId: encrypted.oauth2_client_id || null,
      oauth2ClientSecretEncrypted: encrypted.oauth2_client_secret_encrypted || null,
      oauth2RefreshTokenEncrypted: encrypted.oauth2_refresh_token_encrypted || null,
      oauth2TenantId: encrypted.oauth2_tenant_id || null,
      fromAddress: encrypted.from_address || null,
      fromName: encrypted.from_name || null,
      createdAt: ts,
      updatedAt: ts,
    }).run()

    const row = db.select().from(smtpConfigs).where(eq(smtpConfigs.id, id)).get()!
    return reply.code(201).send(decryptSensitiveFields(row))
  })

  // GET /api/smtp-configs/:id
  app.get<{ Params: { id: string } }>('/api/smtp-configs/:id', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return

    const db = getDb()
    const row = db.select().from(smtpConfigs).where(eq(smtpConfigs.id, request.params.id)).get()
    if (!row) return reply.code(404).send({ error: 'Not found' })
    return reply.send(decryptSensitiveFields(row))
  })

  // PUT /api/smtp-configs/:id
  app.put<{ Params: { id: string } }>('/api/smtp-configs/:id', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return

    const parsed = smtpConfigUpdateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues })
    }

    const db = getDb()
    const existing = db.select().from(smtpConfigs).where(eq(smtpConfigs.id, request.params.id)).get()
    if (!existing) return reply.code(404).send({ error: 'Not found' })

    const encrypted = encryptSensitiveFields(parsed.data)

    // Build partial update object mapping API field names to schema column names
    const updates: Record<string, any> = {}
    const fieldMap: Record<string, string> = {
      host: 'host', port: 'port', secure: 'secure',
      auth_type: 'authType', username: 'username',
      password_encrypted: 'passwordEncrypted',
      oauth2_client_id: 'oauth2ClientId',
      oauth2_client_secret_encrypted: 'oauth2ClientSecretEncrypted',
      oauth2_refresh_token_encrypted: 'oauth2RefreshTokenEncrypted',
      oauth2_tenant_id: 'oauth2TenantId',
      from_address: 'fromAddress', from_name: 'fromName',
    }

    for (const [apiKey, val] of Object.entries(encrypted)) {
      if (val !== undefined && fieldMap[apiKey]) {
        updates[fieldMap[apiKey]] = typeof val === 'boolean' ? (val ? 1 : 0) : val
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updatedAt = now()
      db.update(smtpConfigs).set(updates).where(eq(smtpConfigs.id, request.params.id)).run()
      invalidateTransporter(request.params.id)
    }

    const row = db.select().from(smtpConfigs).where(eq(smtpConfigs.id, request.params.id)).get()!
    return reply.send(decryptSensitiveFields(row))
  })

  // DELETE /api/smtp-configs/:id
  app.delete<{ Params: { id: string } }>('/api/smtp-configs/:id', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return

    const db = getDb()
    db.delete(smtpConfigs).where(eq(smtpConfigs.id, request.params.id)).run()
    invalidateTransporter(request.params.id)
    return reply.send({ deleted: true })
  })

  // POST /api/smtp-configs/:id/test — Test SMTP connection
  app.post<{ Params: { id: string } }>('/api/smtp-configs/:id/test', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return

    const result = await testSmtpConnection(request.params.id)
    return reply.send(result)
  })

  // POST /api/smtp-configs/:id/test-send — Send a test email
  app.post<{ Params: { id: string }; Body: { to: string } }>('/api/smtp-configs/:id/test-send', async (request, reply) => {
    if (!(await authenticateAdmin(request, reply))) return

    const to = request.body?.to
    if (!to || !to.includes('@')) {
      return reply.code(400).send({ error: 'Valid email address required' })
    }

    const db = getDb()
    const config = db.select().from(smtpConfigs).where(eq(smtpConfigs.id, request.params.id)).get()
    if (!config) return reply.code(404).send({ error: 'Not found' })

    const fromAddress = config.fromAddress || config.username || 'test@amail.local'
    const fromName = config.fromName || 'Amail'
    const from = fromName ? `${fromName} <${fromAddress}>` : fromAddress

    try {
      const result = await sendEmail(request.params.id, {
        from,
        to,
        subject: 'Amail 发件测试',
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#1a73e8;margin:0 0 16px">✅ 发件测试成功</h2>
          <p style="color:#333;line-height:1.6">这是一封来自 <strong>Amail</strong> 邮件代理网关的测试邮件。</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
          <table style="font-size:13px;color:#666">
            <tr><td style="padding:4px 12px 4px 0;font-weight:600">SMTP 配置</td><td>${escHtml(config.name)}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:600">服务器</td><td>${escHtml(config.host)}:${config.port}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:600">发件地址</td><td>${escHtml(fromAddress)}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:600">时间</td><td>${new Date().toLocaleString('zh-CN')}</td></tr>
          </table>
        </div>`,
        text: `Amail 发件测试成功\n\n这是一封来自 Amail 邮件代理网关的测试邮件。\n\nSMTP 配置: ${config.name}\n服务器: ${config.host}:${config.port}\n发件地址: ${fromAddress}\n时间: ${new Date().toLocaleString('zh-CN')}`,
      })
      return reply.send({ success: true, messageId: result.messageId })
    } catch (err: any) {
      return reply.send({ success: false, error: err.message })
    }
  })
}
