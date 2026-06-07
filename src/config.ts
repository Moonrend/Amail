import 'dotenv/config'

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  adminToken: process.env.ADMIN_TOKEN || '',
  dbPath: process.env.DB_PATH || './data/amail.db',
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  defaultRateLimit: parseInt(process.env.DEFAULT_RATE_LIMIT || '60', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
}
