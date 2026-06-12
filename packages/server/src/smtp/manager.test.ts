import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildTransporterOptions } from './manager.js'
import type { SmtpConfig } from '../db/schema.js'

function makeConfig(overrides: Partial<SmtpConfig> = {}): SmtpConfig {
  return {
    id: 'smtp_123',
    name: 'Primary',
    host: 'smtp.example.com',
    port: 587,
    secure: 0,
    authType: 'none',
    username: null,
    passwordEncrypted: null,
    oauth2ClientId: null,
    oauth2ClientSecretEncrypted: null,
    oauth2RefreshTokenEncrypted: null,
    oauth2AccessToken: null,
    oauth2TokenExpires: null,
    oauth2TenantId: null,
    fromAddress: null,
    fromName: null,
    priority: 0,
    createdAt: '2026-06-12T00:00:00.000Z',
    updatedAt: '2026-06-12T00:00:00.000Z',
    ...overrides,
  }
}

test('builds pooled SMTP transporter options with configured limits', () => {
  const options = buildTransporterOptions(makeConfig(), {
    maxConnections: 3,
    maxMessages: 50,
    connectionTimeoutMs: 4000,
    greetingTimeoutMs: 3000,
    socketTimeoutMs: 20000,
  })

  assert.equal(options.pool, true)
  assert.equal(options.maxConnections, 3)
  assert.equal(options.maxMessages, 50)
  assert.equal(options.connectionTimeout, 4000)
  assert.equal(options.greetingTimeout, 3000)
  assert.equal(options.socketTimeout, 20000)
})
