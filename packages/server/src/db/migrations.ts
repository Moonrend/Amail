import type Database from 'better-sqlite3'

export function runMigrations(db: Database.Database): void {
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')

  // ── smtp_configs: migrate old schema if needed ──
  const oldTable = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='smtp_configs'
  `).get() as { name: string } | undefined

  const columns = oldTable
    ? (db.prepare(`PRAGMA table_info(smtp_configs)`).all() as any[])
    : []

  const hasOldSchema = oldTable && columns.some(c => c.name === 'is_active')
  const nameIsNotNull = oldTable && columns.some(c => c.name === 'name' && c.notnull === 1)
  const needRecreateSmtp = oldTable && (hasOldSchema || nameIsNotNull)

  if (needRecreateSmtp) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS smtp_configs_new (
        id TEXT PRIMARY KEY,
        name TEXT,
        host TEXT NOT NULL,
        port INTEGER NOT NULL DEFAULT 587,
        secure INTEGER NOT NULL DEFAULT 0,
        auth_type TEXT NOT NULL DEFAULT 'password',
        username TEXT,
        password_encrypted TEXT,
        oauth2_client_id TEXT,
        oauth2_client_secret_encrypted TEXT,
        oauth2_refresh_token_encrypted TEXT,
        oauth2_access_token TEXT,
        oauth2_token_expires INTEGER,
        oauth2_tenant_id TEXT,
        from_address TEXT,
        from_name TEXT,
        priority INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT OR IGNORE INTO smtp_configs_new (
        id, name, host, port, secure, auth_type, username,
        password_encrypted, oauth2_client_id, oauth2_client_secret_encrypted,
        oauth2_refresh_token_encrypted, oauth2_access_token, oauth2_token_expires,
        oauth2_tenant_id, from_address, from_name, priority, created_at, updated_at
      )
      SELECT
        name, name, host, port, secure, auth_type, username,
        password_encrypted, oauth2_client_id, oauth2_client_secret_encrypted,
        oauth2_refresh_token_encrypted, oauth2_access_token, oauth2_token_expires,
        oauth2_tenant_id, from_address, from_name, priority, created_at, updated_at
      FROM smtp_configs;

      DROP TABLE smtp_configs;
      ALTER TABLE smtp_configs_new RENAME TO smtp_configs;
    `)
    console.log('[migrations] Migrated smtp_configs: name column now nullable')
  } else if (!oldTable) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS smtp_configs (
        id TEXT PRIMARY KEY,
        name TEXT,
        host TEXT NOT NULL,
        port INTEGER NOT NULL DEFAULT 587,
        secure INTEGER NOT NULL DEFAULT 0,
        auth_type TEXT NOT NULL DEFAULT 'password',
        username TEXT,
        password_encrypted TEXT,
        oauth2_client_id TEXT,
        oauth2_client_secret_encrypted TEXT,
        oauth2_refresh_token_encrypted TEXT,
        oauth2_access_token TEXT,
        oauth2_token_expires INTEGER,
        oauth2_tenant_id TEXT,
        from_address TEXT,
        from_name TEXT,
        priority INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `)
  }

  // ── api_keys ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // ── analytics_daily ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_daily (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      api_key_id TEXT,
      total_sent INTEGER NOT NULL DEFAULT 0,
      total_delivered INTEGER NOT NULL DEFAULT 0,
      total_failed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(date, api_key_id)
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily(date);
  `)

  // ── email_logs: create or migrate ──
  migrateEmailLogs(db)
}

/**
 * email_logs migration — always safe on any SQLite version.
 * Strategy: check for old columns; if found, recreate table with new schema
 * and copy data over. This avoids ALTER TABLE DROP COLUMN which needs SQLite 3.35+.
 */
function migrateEmailLogs(db: Database.Database): void {
  // Clean up leftover from a previous crashed migration
  const leftover = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='email_logs_new'
  `).get() as { name: string } | undefined
  if (leftover) db.exec('DROP TABLE email_logs_new')

  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='email_logs'
  `).get() as { name: string } | undefined

  const NEW_SCHEMA = `
    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      api_key_id TEXT,
      smtp_config_id TEXT,
      from_address TEXT NOT NULL,
      to_addresses TEXT NOT NULL,
      subject TEXT NOT NULL,
      has_html INTEGER NOT NULL DEFAULT 0,
      has_text INTEGER NOT NULL DEFAULT 0,
      has_attachments INTEGER NOT NULL DEFAULT 0,
      attachment_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'queued',
      error_message TEXT,
      idempotency_key TEXT,
      message_id TEXT,
      scheduled_at TEXT,
      queued_at TEXT NOT NULL DEFAULT (datetime('now')),
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `

  if (!tableExists) {
    // Fresh install
    db.exec(NEW_SCHEMA)
    createEmailLogsIndexes(db)
    return
  }

  // Check if old columns exist
  const cols = (db.prepare('PRAGMA table_info(email_logs)').all() as any[]).map(c => c.name)
  const OLD_COLUMNS = ['cc_addresses', 'bcc_addresses', 'tags', 'headers', 'smtp_response']
  const hasOldColumns = OLD_COLUMNS.some(c => cols.includes(c))

  if (!hasOldColumns) {
    // Already up to date — just ensure indexes exist
    createEmailLogsIndexes(db)
    return
  }

  // Migrate: recreate table without old columns
  console.log('[migrations] Migrating email_logs: removing verbose columns...')

  db.exec('PRAGMA foreign_keys = OFF')

  try {
    db.exec(`
      ${NEW_SCHEMA.replace('email_logs', 'email_logs_new')}

      INSERT INTO email_logs_new (
        id, api_key_id, smtp_config_id, from_address, to_addresses,
        subject, has_html, has_text, has_attachments, attachment_count,
        status, error_message, idempotency_key, message_id, scheduled_at, queued_at, sent_at, created_at
      )
      SELECT
        id, api_key_id, smtp_config_id, from_address, to_addresses,
        subject, has_html, has_text, has_attachments, attachment_count,
        status, error_message, idempotency_key, message_id, scheduled_at, queued_at, sent_at, created_at
      FROM email_logs;

      DROP TABLE email_logs;
      ALTER TABLE email_logs_new RENAME TO email_logs;
    `)

    createEmailLogsIndexes(db)
    console.log('[migrations] email_logs migration complete')
  } finally {
    db.exec('PRAGMA foreign_keys = ON')
  }
}

function createEmailLogsIndexes(db: Database.Database): void {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
    CREATE INDEX IF NOT EXISTS idx_email_logs_api_key ON email_logs(api_key_id);
    CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_email_logs_idempotency ON email_logs(idempotency_key);
  `)
}
