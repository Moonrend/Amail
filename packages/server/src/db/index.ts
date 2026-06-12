import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { config } from '../config.js'
import * as schema from './schema.js'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { join } from 'node:path'

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

let db: DrizzleDb

function configureSqlite(client: DrizzleDb['$client']): void {
  client.pragma('journal_mode = WAL')
  client.pragma('foreign_keys = ON')
  client.pragma('busy_timeout = 5000')
  client.pragma('synchronous = NORMAL')
  client.pragma('temp_store = MEMORY')
}

export function getDb(): DrizzleDb {
  if (!db) {
    mkdirSync(dirname(config.dbPath), { recursive: true })

    db = drizzle(config.dbPath, { schema })

    configureSqlite(db.$client)

    // Auto-run migrations on startup
    try {
      const migrationsFolder = join(import.meta.dirname, 'migrations')
      migrate(db, { migrationsFolder })
    } catch (err) {
      console.error('[db] Migration failed:', err)
      throw err
    }
  }
  return db
}
