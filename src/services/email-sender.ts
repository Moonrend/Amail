import { nanoid } from 'nanoid'
import { getDb } from '../db/index.js'
import { selectSmtpConfig, sendEmail } from '../smtp/manager.js'

export interface SendEmailInput {
  from: string
  to: string | string[]
  subject: string
  html?: string
  text?: string
  cc?: string | string[]
  bcc?: string | string[]
  reply_to?: string | string[]
  headers?: Record<string, string>
  tags?: Array<{ name: string; value: string }>
  attachments?: Array<{
    content?: string | Buffer
    filename?: string
    path?: string
    content_type?: string
    content_id?: string
  }>
  scheduled_at?: string
}

function toArray(val: string | string[] | undefined): string[] {
  if (!val) return []
  return Array.isArray(val) ? val : [val]
}

function parseFrom(from: string): { name?: string; address: string } {
  const match = from.match(/^"?([^"<]*)"?\s*<([^>]+)>$/)
  if (match) {
    return { name: match[1].trim() || undefined, address: match[2].trim() }
  }
  return { address: from.trim() }
}

export async function processSendEmail(
  input: SendEmailInput,
  apiKeyId: string,
  idempotencyKey?: string,
): Promise<{ id: string }> {
  const db = getDb()

  // Check idempotency
  if (idempotencyKey) {
    const existing = db.prepare('SELECT id FROM email_logs WHERE idempotency_key = ?').get(idempotencyKey) as { id: string } | undefined
    if (existing) return { id: existing.id }
  }

  const emailId = nanoid(21) // Resend uses 21-char IDs
  const toAddresses = toArray(input.to)
  const ccAddresses = toArray(input.cc)
  const bccAddresses = toArray(input.bcc)
  const replyTo = toArray(input.reply_to)

  // Select SMTP config
  const fromParsed = parseFrom(input.from)
  const smtpConfig = await selectSmtpConfig(fromParsed.address)

  // Build nodemailer options
  const mailOptions: any = {
    from: input.from,
    to: toAddresses.join(', '),
    subject: input.subject,
    html: input.html,
    text: input.text,
  }

  if (ccAddresses.length) mailOptions.cc = ccAddresses.join(', ')
  if (bccAddresses.length) mailOptions.bcc = bccAddresses.join(', ')
  if (replyTo.length) mailOptions.replyTo = replyTo.join(', ')
  if (input.headers) mailOptions.headers = input.headers

  if (input.attachments?.length) {
    mailOptions.attachments = input.attachments.map((a) => ({
      content: a.content,
      filename: a.filename,
      path: a.path,
      contentType: a.content_type,
      cid: a.content_id,
    }))
  }

  // Log to database
  db.prepare(`
    INSERT INTO email_logs (id, api_key_id, smtp_config_id, from_address, to_addresses, cc_addresses, bcc_addresses,
      subject, has_html, has_text, has_attachments, attachment_count, tags, headers, status, idempotency_key, scheduled_at, queued_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    emailId,
    apiKeyId,
    smtpConfig.id,
    input.from,
    JSON.stringify(toAddresses),
    JSON.stringify(ccAddresses),
    JSON.stringify(bccAddresses),
    input.subject,
    input.html ? 1 : 0,
    input.text ? 1 : 0,
    input.attachments?.length ? 1 : 0,
    input.attachments?.length || 0,
    input.tags ? JSON.stringify(input.tags) : null,
    input.headers ? JSON.stringify(input.headers) : null,
    'queued',
    idempotencyKey || null,
    input.scheduled_at || null,
  )

  // Send immediately (or queue for scheduled)
  try {
    db.prepare('UPDATE email_logs SET status = \'sending\' WHERE id = ?').run(emailId)
    const result = await sendEmail(smtpConfig.id, mailOptions)

    db.prepare(`
      UPDATE email_logs SET status = 'delivered', message_id = ?, smtp_response = ?, sent_at = datetime('now')
      WHERE id = ?
    `).run(result.messageId, result.response, emailId)

    // Update analytics
    const today = new Date().toISOString().slice(0, 10)
    db.prepare(`
      INSERT INTO analytics_daily (id, date, api_key_id, total_sent, total_delivered)
      VALUES (?, ?, ?, 1, 1)
      ON CONFLICT(date, api_key_id) DO UPDATE SET
        total_sent = total_sent + 1, total_delivered = total_delivered + 1
    `).run(nanoid(), today, apiKeyId)

  } catch (err: any) {
    db.prepare(`
      UPDATE email_logs SET status = 'failed', error_message = ?, sent_at = datetime('now')
      WHERE id = ?
    `).run(err.message, emailId)

    // Update analytics
    const today = new Date().toISOString().slice(0, 10)
    db.prepare(`
      INSERT INTO analytics_daily (id, date, api_key_id, total_sent, total_failed)
      VALUES (?, ?, ?, 1, 1)
      ON CONFLICT(date, api_key_id) DO UPDATE SET
        total_sent = total_sent + 1, total_failed = total_failed + 1
    `).run(nanoid(), today, apiKeyId)

    throw err
  }

  return { id: emailId }
}
