import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { eq, or, isNull, desc } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { smtpConfigs, type SmtpConfig } from '../db/schema.js'
import { now } from '../db/timestamp.js'
import { decrypt, encrypt } from '../crypto.js'
import { refreshOAuth2Token, isTokenExpired } from './oauth.js'
import { config as appConfig } from '../config.js'
import { notFound } from '../errors.js'

// Connection pool: configId -> transporter
const transporterCache = new Map<string, Transporter>()

export interface SmtpPoolOptions {
  maxConnections: number
  maxMessages: number
  connectionTimeoutMs: number
  greetingTimeoutMs: number
  socketTimeoutMs: number
}

export function buildTransporterOptions(
  config: SmtpConfig,
  pool: SmtpPoolOptions = appConfig.smtpPool,
  accessToken?: string,
): Record<string, unknown> {
  const opts: Record<string, unknown> = {
    host: config.host,
    port: config.port,
    secure: config.secure === 1,
    pool: true,
    maxConnections: pool.maxConnections,
    maxMessages: pool.maxMessages,
    connectionTimeout: pool.connectionTimeoutMs,
    greetingTimeout: pool.greetingTimeoutMs,
    socketTimeout: pool.socketTimeoutMs,
  }

  switch (config.authType) {
    case 'password':
    case 'plain':
    case 'login':
      opts.auth = {
        type: config.authType === 'password' ? 'login' : config.authType,
        user: config.username || '',
        pass: config.passwordEncrypted ? decrypt(config.passwordEncrypted) : '',
      }
      break

    case 'cram-md5':
      opts.auth = {
        type: 'custom',
        method: 'CRAM-MD5',
        user: config.username || '',
        pass: config.passwordEncrypted ? decrypt(config.passwordEncrypted) : '',
      }
      break

    case 'oauth2':
      opts.auth = {
        type: 'OAuth2',
        user: config.username || '',
        accessToken: accessToken || '',
      }
      break

    case 'none':
      break

    default:
      throw new Error(`Unsupported auth type: ${config.authType}`)
  }

  return opts
}

async function getTransporter(configId: string): Promise<{ transporter: Transporter; config: SmtpConfig }> {
  const db = getDb()
  const config = db.select().from(smtpConfigs).where(eq(smtpConfigs.id, configId)).get()
  if (!config) throw notFound(`SMTP config not found: ${configId}`)

  // Handle OAuth2 token refresh
  let accessToken = config.oauth2AccessToken
  if (config.authType === 'oauth2') {
    if (isTokenExpired(config.oauth2TokenExpires)) {
      let provider: 'microsoft' | 'google' | 'generic' = 'generic'
      if (config.host.includes('office365') || config.host.includes('outlook')) {
        provider = 'microsoft'
      } else if (config.host.includes('gmail') || config.host.includes('google')) {
        provider = 'google'
      }

      const secret = config.oauth2ClientSecretEncrypted ? decrypt(config.oauth2ClientSecretEncrypted) : ''
      const refresh = config.oauth2RefreshTokenEncrypted ? decrypt(config.oauth2RefreshTokenEncrypted) : ''

      const result = await refreshOAuth2Token({
        oauth2ClientId: config.oauth2ClientId,
        oauth2ClientSecretEncrypted: secret,
        oauth2RefreshTokenEncrypted: refresh,
        oauth2TenantId: config.oauth2TenantId,
      }, provider)
      accessToken = result.accessToken

      db.update(smtpConfigs).set({
        oauth2AccessToken: accessToken,
        oauth2TokenExpires: result.expiresAt,
        updatedAt: now(),
      }).where(eq(smtpConfigs.id, configId)).run()
    }
  }

  if (transporterCache.has(configId)) {
    return { transporter: transporterCache.get(configId)!, config }
  }

  const opts = buildTransporterOptions(config, appConfig.smtpPool, accessToken || undefined)
  const transporter = nodemailer.createTransport(opts)
  transporterCache.set(configId, transporter)

  return { transporter, config }
}

export async function selectSmtpConfig(fromAddress: string): Promise<SmtpConfig> {
  const db = getDb()

  const matched = db.select()
    .from(smtpConfigs)
    .where(or(eq(smtpConfigs.fromAddress, fromAddress), isNull(smtpConfigs.fromAddress)))
    .orderBy(desc(smtpConfigs.createdAt))
    .limit(1)
    .get()

  if (matched) return matched

  const fallback = db.select()
    .from(smtpConfigs)
    .orderBy(desc(smtpConfigs.createdAt))
    .limit(1)
    .get()

  if (!fallback) throw notFound('No SMTP configuration available. Please add one in the admin panel.')
  return fallback
}

export async function getSmtpConfigById(id: string): Promise<SmtpConfig> {
  const db = getDb()
  const config = db.select().from(smtpConfigs).where(eq(smtpConfigs.id, id)).get()
  if (!config) throw notFound(`SMTP provider not found: ${id}`)
  return config
}

export async function listSmtpConfigs(): Promise<Array<{ id: string; name: string | null; host: string; from_address: string | null }>> {
  const db = getDb()
  return db.select({
    id: smtpConfigs.id,
    name: smtpConfigs.name,
    host: smtpConfigs.host,
    from_address: smtpConfigs.fromAddress,
  })
    .from(smtpConfigs)
    .orderBy(desc(smtpConfigs.createdAt))
    .all()
}

export async function sendEmail(
  configId: string,
  mailOptions: nodemailer.SendMailOptions,
): Promise<{ messageId: string; response: string }> {
  const { transporter } = await getTransporter(configId)
  const info = await transporter.sendMail(mailOptions)

  return {
    messageId: info.messageId || '',
    response: typeof info.response === 'string' ? info.response : String(info.response),
  }
}

export function invalidateTransporter(configId: string): void {
  const t = transporterCache.get(configId)
  if (t) {
    t.close()
    transporterCache.delete(configId)
  }
}

export async function testSmtpConnection(configId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { transporter } = await getTransporter(configId)
    await transporter.verify()
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
