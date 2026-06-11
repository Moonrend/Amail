import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

// ── SMTP Configs ──────────────────────────────────────────────────

export const smtpConfigs = sqliteTable('smtp_configs', {
  id: text('id').primaryKey(),
  name: text('name'),
  host: text('host').notNull(),
  port: integer('port').notNull().default(587),
  secure: integer('secure').notNull().default(0),       // 0 or 1 boolean
  authType: text('auth_type').notNull().default('password'),
  username: text('username'),
  passwordEncrypted: text('password_encrypted'),
  oauth2ClientId: text('oauth2_client_id'),
  oauth2ClientSecretEncrypted: text('oauth2_client_secret_encrypted'),
  oauth2RefreshTokenEncrypted: text('oauth2_refresh_token_encrypted'),
  oauth2AccessToken: text('oauth2_access_token'),
  oauth2TokenExpires: integer('oauth2_token_expires'),
  oauth2TenantId: text('oauth2_tenant_id'),
  fromAddress: text('from_address'),
  fromName: text('from_name'),
  priority: integer('priority').notNull().default(0),
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
})

// ── API Keys ──────────────────────────────────────────────────────

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull().unique(),
  keyPrefix: text('key_prefix').notNull(),
  isActive: integer('is_active').notNull().default(1),   // 0 or 1 boolean
  lastUsedAt: text('last_used_at'),
  createdAt: text('created_at').notNull().default(''),
})

// ── Email Logs ────────────────────────────────────────────────────

export const emailLogs = sqliteTable('email_logs', {
  id: text('id').primaryKey(),
  apiKeyId: text('api_key_id'),
  smtpConfigId: text('smtp_config_id'),
  fromAddress: text('from_address').notNull(),
  toAddresses: text('to_addresses').notNull(),            // JSON array string
  subject: text('subject').notNull(),
  hasHtml: integer('has_html').notNull().default(0),
  hasText: integer('has_text').notNull().default(0),
  hasAttachments: integer('has_attachments').notNull().default(0),
  attachmentCount: integer('attachment_count').notNull().default(0),
  status: text('status').notNull().default('queued'),
  errorMessage: text('error_message'),
  idempotencyKey: text('idempotency_key'),
  messageId: text('message_id'),
  scheduledAt: text('scheduled_at'),
  queuedAt: text('queued_at').notNull().default(''),
  sentAt: text('sent_at'),
  createdAt: text('created_at').notNull().default(''),
}, (table) => [
  index('idx_email_logs_status').on(table.status),
  index('idx_email_logs_api_key').on(table.apiKeyId),
  index('idx_email_logs_created').on(table.createdAt),
  index('idx_email_logs_idempotency').on(table.idempotencyKey),
])

// ── Analytics Daily ───────────────────────────────────────────────

export const analyticsDaily = sqliteTable('analytics_daily', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  apiKeyId: text('api_key_id'),
  totalSent: integer('total_sent').notNull().default(0),
  totalDelivered: integer('total_delivered').notNull().default(0),
  totalFailed: integer('total_failed').notNull().default(0),
  createdAt: text('created_at').notNull().default(''),
}, (table) => [
  uniqueIndex('idx_analytics_daily_unique').on(table.date, table.apiKeyId),
  index('idx_analytics_daily_date').on(table.date),
])

// ── Type exports ──────────────────────────────────────────────────

export type SmtpConfig = typeof smtpConfigs.$inferSelect
export type NewSmtpConfig = typeof smtpConfigs.$inferInsert
export type ApiKey = typeof apiKeys.$inferSelect
export type NewApiKey = typeof apiKeys.$inferInsert
export type EmailLog = typeof emailLogs.$inferSelect
export type NewEmailLog = typeof emailLogs.$inferInsert
export type AnalyticsDaily = typeof analyticsDaily.$inferSelect
export type NewAnalyticsDaily = typeof analyticsDaily.$inferInsert
