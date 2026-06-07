import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { getDb } from '../db/index.js'
import { decrypt, encrypt } from '../crypto.js'
import { refreshOAuth2Token, isTokenExpired } from './oauth.js'

export interface SmtpConfigRow {
  id: string
  name: string
  host: string
  port: number
  secure: number
  auth_type: string
  username: string | null
  password_encrypted: string | null
  oauth2_client_id: string | null
  oauth2_client_secret_encrypted: string | null
  oauth2_refresh_token_encrypted: string | null
  oauth2_access_token: string | null
  oauth2_token_expires: number | null
  oauth2_tenant_id: string | null
  from_address: string | null
  from_name: string | null
  priority: number
}

// Connection pool: configId -> transporter
const transporterCache = new Map<string, Transporter>()

function buildTransporterOptions(config: SmtpConfigRow, accessToken?: string): Record<string, unknown> {
  const opts: Record<string, unknown> = {
    host: config.host,
    port: config.port,
    secure: config.secure === 1,
  }

  switch (config.auth_type) {
    case 'password':
    case 'plain':
    case 'login':
      opts.auth = {
        type: config.auth_type === 'password' ? 'login' : config.auth_type,
        user: config.username || '',
        pass: config.password_encrypted ? decrypt(config.password_encrypted) : '',
      }
      break

    case 'cram-md5':
      opts.auth = {
        type: 'custom',
        method: 'CRAM-MD5',
        user: config.username || '',
        pass: config.password_encrypted ? decrypt(config.password_encrypted) : '',
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
      // No authentication
      break

    default:
      throw new Error(`Unsupported auth type: ${config.auth_type}`)
  }

  return opts
}

async function getTransporter(configId: string): Promise<{ transporter: Transporter; config: SmtpConfigRow }> {
  const db = getDb()
  const config = db.prepare('SELECT * FROM smtp_configs WHERE id = ?').get(configId) as SmtpConfigRow | undefined
  if (!config) throw new Error(`SMTP config not found: ${configId}`)

  // Handle OAuth2 token refresh
  let accessToken = config.oauth2_access_token
  if (config.auth_type === 'oauth2') {
    if (isTokenExpired(config.oauth2_token_expires)) {
      // Determine provider from host
      let provider: 'microsoft' | 'google' | 'generic' = 'generic'
      if (config.host.includes('office365') || config.host.includes('outlook')) {
        provider = 'microsoft'
      } else if (config.host.includes('gmail') || config.host.includes('google')) {
        provider = 'google'
      }

      const secret = config.oauth2_client_secret_encrypted ? decrypt(config.oauth2_client_secret_encrypted) : ''
      const refresh = config.oauth2_refresh_token_encrypted ? decrypt(config.oauth2_refresh_token_encrypted) : ''

      const tempConfig = { ...config, oauth2_client_secret_encrypted: secret, oauth2_refresh_token_encrypted: refresh }
      const result = await refreshOAuth2Token(tempConfig, provider)
      accessToken = result.accessToken

      // Update cached token
      db.prepare(`
        UPDATE smtp_configs SET oauth2_access_token = ?, oauth2_token_expires = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(accessToken, result.expiresAt, configId)
    }
  }

  // Return cached or create new transporter
  if (transporterCache.has(configId)) {
    return { transporter: transporterCache.get(configId)!, config }
  }

  const opts = buildTransporterOptions(config, accessToken || undefined)
  const transporter = nodemailer.createTransport(opts)
  transporterCache.set(configId, transporter)

  return { transporter, config }
}

export async function selectSmtpConfig(fromAddress: string): Promise<SmtpConfigRow> {
  const db = getDb()

  // Try to find a config matching the from address
  const matched = db.prepare(`
    SELECT * FROM smtp_configs
    WHERE from_address = ? OR from_address IS NULL
    ORDER BY priority DESC
    LIMIT 1
  `).get(fromAddress) as SmtpConfigRow | undefined

  if (matched) return matched

  // Fallback to any config
  const fallback = db.prepare(`
    SELECT * FROM smtp_configs
    ORDER BY priority DESC
    LIMIT 1
  `).get() as SmtpConfigRow | undefined

  if (!fallback) throw new Error('No SMTP configuration available. Please add one in the admin panel.')
  return fallback
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
