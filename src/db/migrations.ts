import type Database from 'better-sqlite3'

export function runMigrations(db: Database.Database): void {
  // Check if old smtp_configs table exists (with is_active column)
  const oldTable = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='smtp_configs'
  `).get() as { name: string } | undefined

  const hasOldSchema = oldTable && (() => {
    const columns = db.prepare(`PRAGMA table_info(smtp_configs)`).all() as any[]
    return columns.some(c => c.name === 'is_active')
  })()

  if (hasOldSchema) {
    // Migrate from old schema to new schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS smtp_configs_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
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

    // Update email_logs smtp_config_id references if possible
    // (Old IDs were nanoid, new IDs are names — best effort mapping)
    console.log('[migrations] Migrated smtp_configs: id now equals name')
  } else if (!oldTable) {
    // Fresh install — create table with new schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS smtp_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
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
  // else: new schema already exists, no migration needed

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

    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      api_key_id TEXT,
      smtp_config_id TEXT,
      from_address TEXT NOT NULL,
      to_addresses TEXT NOT NULL,
      cc_addresses TEXT,
      bcc_addresses TEXT,
      subject TEXT NOT NULL,
      has_html INTEGER NOT NULL DEFAULT 0,
      has_text INTEGER NOT NULL DEFAULT 0,
      has_attachments INTEGER NOT NULL DEFAULT 0,
      attachment_count INTEGER NOT NULL DEFAULT 0,
      tags TEXT,
      headers TEXT,
      status TEXT NOT NULL DEFAULT 'queued',
      error_message TEXT,
      smtp_response TEXT,
      idempotency_key TEXT,
      message_id TEXT,
      scheduled_at TEXT,
      queued_at TEXT NOT NULL DEFAULT (datetime('now')),
      sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

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

    CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
    CREATE INDEX IF NOT EXISTS idx_email_logs_api_key ON email_logs(api_key_id);
    CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_email_logs_idempotency ON email_logs(idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily(date);
  `)
}
