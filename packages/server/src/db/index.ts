import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { config } from '../config.js'
import * as schema from './schema.js'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { join } from 'node:path'

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>

let db: DrizzleDb

export function getDb(): DrizzleDb {
  if (!db) {
    mkdirSync(dirname(config.dbPath), { recursive: true })

    db = drizzle(config.dbPath, { schema })

    // Pragmas via $client
    db.$client.pragma('journal_mode = WAL')
    db.$client.pragma('foreign_keys = ON')
    db.$client.pragma('busy_timeout = 5000')

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
