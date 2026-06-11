import { nanoid } from 'nanoid'
import { eq, sql } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { emailLogs, analyticsDaily } from '../db/schema.js'
import { now } from '../db/timestamp.js'
import { selectSmtpConfig, getSmtpConfigById, sendEmail } from '../smtp/manager.js'

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
  provider: string
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
    const existing = db.select({ id: emailLogs.id })
      .from(emailLogs)
      .where(eq(emailLogs.idempotencyKey, idempotencyKey))
      .get()
    if (existing) return { id: existing.id }
  }

  const emailId = nanoid(21)
  const toAddresses = toArray(input.to)
  const replyTo = toArray(input.reply_to)

  // Select SMTP config
  const fromParsed = parseFrom(input.from)
  const smtpConfig = input.provider === 'auto'
    ? await selectSmtpConfig(fromParsed.address)
    : await getSmtpConfigById(input.provider)

  // Resolve from address
  let fromAddress: string
  if (smtpConfig.fromAddress) {
    fromAddress = smtpConfig.fromName
      ? `${smtpConfig.fromName} <${smtpConfig.fromAddress}>`
      : smtpConfig.fromAddress
  } else {
    fromAddress = input.from || smtpConfig.username || ''
    if (!fromAddress) {
      throw new Error('No sender address: provide a "from" field or configure from_address on the SMTP provider')
    }
  }

  // Build nodemailer options
  const mailOptions: any = {
    from: fromAddress,
    to: toAddresses.join(', '),
    subject: input.subject,
    html: input.html,
    text: input.text,
  }

  const ccList = toArray(input.cc)
  const bccList = toArray(input.bcc)
  if (ccList.length) mailOptions.cc = ccList.join(', ')
  if (bccList.length) mailOptions.bcc = bccList.join(', ')
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
  const ts = now()
  db.insert(emailLogs).values({
    id: emailId,
    apiKeyId,
    smtpConfigId: smtpConfig.id,
    fromAddress,
    toAddresses: JSON.stringify(toAddresses),
    subject: input.subject,
    hasHtml: input.html ? 1 : 0,
    hasText: input.text ? 1 : 0,
    hasAttachments: input.attachments?.length ? 1 : 0,
    attachmentCount: input.attachments?.length || 0,
    status: 'queued',
    idempotencyKey: idempotencyKey || null,
    scheduledAt: input.scheduled_at || null,
    queuedAt: ts,
    createdAt: ts,
  }).run()

  // Send immediately
  try {
    db.update(emailLogs).set({ status: 'sending' }).where(eq(emailLogs.id, emailId)).run()

    const result = await sendEmail(smtpConfig.id, mailOptions)

    db.update(emailLogs).set({
      status: 'delivered',
      messageId: result.messageId,
      sentAt: now(),
    }).where(eq(emailLogs.id, emailId)).run()

    // Update analytics
    const today = new Date().toISOString().slice(0, 10)
    db.insert(analyticsDaily).values({
      id: nanoid(),
      date: today,
      apiKeyId,
      totalSent: 1,
      totalDelivered: 1,
      createdAt: now(),
    }).onConflictDoUpdate({
      target: [analyticsDaily.date, analyticsDaily.apiKeyId],
      set: {
        totalSent: sql`${analyticsDaily.totalSent} + 1`,
        totalDelivered: sql`${analyticsDaily.totalDelivered} + 1`,
      },
    }).run()

  } catch (err: any) {
    db.update(emailLogs).set({
      status: 'failed',
      errorMessage: err.message,
      sentAt: now(),
    }).where(eq(emailLogs.id, emailId)).run()

    // Update analytics
    const today = new Date().toISOString().slice(0, 10)
    db.insert(analyticsDaily).values({
      id: nanoid(),
      date: today,
      apiKeyId,
      totalSent: 1,
      totalFailed: 1,
      createdAt: now(),
    }).onConflictDoUpdate({
      target: [analyticsDaily.date, analyticsDaily.apiKeyId],
      set: {
        totalSent: sql`${analyticsDaily.totalSent} + 1`,
        totalFailed: sql`${analyticsDaily.totalFailed} + 1`,
      },
    }).run()

    throw err
  }

  return { id: emailId }
}
