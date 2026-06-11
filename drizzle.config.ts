import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './packages/server/src/db/schema.ts',
  out: './packages/server/src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_PATH || './data/amail.db',
  },
})
