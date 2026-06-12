import Fastify from 'fastify'
import cors from '@fastify/cors'
import view from '@fastify/view'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ejs from 'ejs'
import { config } from './config.js'
import { getDb } from './db/index.js'
import { emailRoutes } from './api/emails.js'
import { smtpConfigRoutes } from './api/smtp-configs.js'
import { apiKeyRoutes } from './api/api-keys.js'
import { analyticsRoutes } from './api/analytics.js'
import { registerErrorHandler } from './errors.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const app = Fastify({
    logger: { level: config.logLevel },
  })
  registerErrorHandler(app)

  await app.register(cors, { origin: true })

  await app.register(view, {
    engine: { ejs },
    root: join(__dirname, 'web', 'views'),
  })

  getDb()
  app.log.info('Database initialized')

  await app.register(emailRoutes)
  await app.register(smtpConfigRoutes)
  await app.register(apiKeyRoutes)
  await app.register(analyticsRoutes)

  app.get('/health', async () => ({ status: 'ok', version: '1.0.0' }))

  // Pages
  app.get('/', async (_req, reply) => reply.view('pages/login.ejs'))
  app.get('/smtp', async (_req, reply) => reply.view('pages/smtp.ejs'))
  app.get('/apikeys', async (_req, reply) => reply.view('pages/apikeys.ejs'))
  app.get('/logs', async (_req, reply) => reply.view('pages/emails.ejs'))
  app.get('/analytics', async (_req, reply) => reply.view('pages/analytics.ejs'))

  await app.listen({ port: config.port, host: config.host })
  app.log.info(`Amail running at http://${config.host}:${config.port}`)
  app.log.info(`Admin panel: http://localhost:${config.port}`)
  app.log.info(`API endpoint: http://localhost:${config.port}/emails`)

  if (!config.adminToken) app.log.warn('ADMIN_TOKEN not set! Set it in .env')
  if (!config.encryptionKey) app.log.warn('ENCRYPTION_KEY not set! SMTP passwords will not be encrypted.')
}

main().catch((err) => {
  console.error('Failed to start Amail:', err)
  process.exit(1)
})
