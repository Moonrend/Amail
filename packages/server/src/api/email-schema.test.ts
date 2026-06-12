import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseSendEmailBody } from './email-schema.js'

test('normalizes provider_id into provider for SDK-compatible requests', () => {
  const parsed = parseSendEmailBody({
    provider_id: 'smtp_123',
    from: 'Sender <sender@example.com>',
    to: ['user@example.com'],
    subject: 'Hello',
    html: '<p>Hello</p>',
  })

  assert.equal(parsed.success, true)
  if (parsed.success) {
    assert.equal(parsed.data.provider, 'smtp_123')
  }
})

test('keeps provider alias for backward-compatible requests', () => {
  const parsed = parseSendEmailBody({
    provider: 'auto',
    from: 'sender@example.com',
    to: 'user@example.com',
    subject: 'Hello',
    text: 'Hello',
  })

  assert.equal(parsed.success, true)
  if (parsed.success) {
    assert.equal(parsed.data.provider, 'auto')
  }
})
