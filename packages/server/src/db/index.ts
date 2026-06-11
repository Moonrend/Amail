import Database from 'better-sqlite3'
import { config } from '../config.js'
import { runMigrations } from './migrations.js'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    mkdirSync(dirname(config.dbPath), { recursive: true })
    db = new Database(config.dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.pragma('busy_timeout = 5000')
    try {
      runMigrations(db)
    } catch (err) {
      console.error('[db] Migration failed:', err)
      throw err
    }
  }
  return db
}
