import 'dotenv/config'

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const config = {
  port: intEnv('PORT', 3000),
  host: process.env.HOST || '0.0.0.0',
  adminToken: process.env.ADMIN_TOKEN || '',
  dbPath: process.env.DB_PATH || './data/amail.db',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  logLevel: process.env.LOG_LEVEL || 'info',
  smtpPool: {
    maxConnections: intEnv('SMTP_POOL_MAX_CONNECTIONS', 5),
    maxMessages: intEnv('SMTP_POOL_MAX_MESSAGES', 100),
    connectionTimeoutMs: intEnv('SMTP_CONNECTION_TIMEOUT_MS', 10_000),
    greetingTimeoutMs: intEnv('SMTP_GREETING_TIMEOUT_MS', 10_000),
    socketTimeoutMs: intEnv('SMTP_SOCKET_TIMEOUT_MS', 60_000),
  },
}
