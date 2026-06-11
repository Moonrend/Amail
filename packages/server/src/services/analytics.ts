import { eq, and, gte, desc, sql } from 'drizzle-orm'
import { getDb } from '../db/index.js'
import { emailLogs, analyticsDaily, smtpConfigs, apiKeys } from '../db/schema.js'

export interface OverviewStats {
  total_emails: number
  delivered: number
  failed: number
  queued: number
  today_sent: number
  today_delivered: number
  today_failed: number
}

export interface DailyStats {
  date: string
  total_sent: number
  total_delivered: number
  total_failed: number
}

export function getOverview(): OverviewStats {
  const db = getDb()
  const today = new Date().toISOString().slice(0, 10)

  const total = db.select({
    total_emails: sql<number>`count(*)`,
    delivered: sql<number>`sum(case when ${emailLogs.status} = 'delivered' then 1 else 0 end)`,
    failed: sql<number>`sum(case when ${emailLogs.status} = 'failed' then 1 else 0 end)`,
    queued: sql<number>`sum(case when ${emailLogs.status} in ('queued', 'sending') then 1 else 0 end)`,
  }).from(emailLogs).get()!

  const todayStats = db.select({
    today_sent: sql<number>`coalesce(sum(${analyticsDaily.totalSent}), 0)`,
    today_delivered: sql<number>`coalesce(sum(${analyticsDaily.totalDelivered}), 0)`,
    today_failed: sql<number>`coalesce(sum(${analyticsDaily.totalFailed}), 0)`,
  }).from(analyticsDaily).where(eq(analyticsDaily.date, today)).get()!

  return {
    total_emails: total.total_emails || 0,
    delivered: total.delivered || 0,
    failed: total.failed || 0,
    queued: total.queued || 0,
    today_sent: todayStats.today_sent || 0,
    today_delivered: todayStats.today_delivered || 0,
    today_failed: todayStats.today_failed || 0,
  }
}

export function getDailyStats(days: number = 30, filters?: { api_key_id?: string; smtp_config_id?: string }): DailyStats[] {
  const db = getDb()

  // If filtering by smtp_config_id, query from email_logs directly
  if (filters?.smtp_config_id) {
    const conditions = [
      sql`${emailLogs.sentAt} is not null`,
      sql`${emailLogs.sentAt} >= date('now', '-' || ${days} || ' days')`,
      eq(emailLogs.smtpConfigId, filters.smtp_config_id),
    ]
    if (filters.api_key_id) conditions.push(eq(emailLogs.apiKeyId, filters.api_key_id))

    return db.select({
      date: sql<string>`date(${emailLogs.sentAt})`.as('date'),
      total_sent: sql<number>`count(*)`.as('total_sent'),
      total_delivered: sql<number>`sum(case when ${emailLogs.status} = 'delivered' then 1 else 0 end)`.as('total_delivered'),
      total_failed: sql<number>`sum(case when ${emailLogs.status} = 'failed' then 1 else 0 end)`.as('total_failed'),
    })
      .from(emailLogs)
      .where(and(...conditions))
      .groupBy(sql`date(${emailLogs.sentAt})`)
      .orderBy(desc(sql`date(${emailLogs.sentAt})`))
      .all()
  }

  const conditions = [gte(analyticsDaily.date, sql`date('now', '-' || ${days} || ' days')`)]
  if (filters?.api_key_id) conditions.push(eq(analyticsDaily.apiKeyId, filters.api_key_id))

  return db.select({
    date: analyticsDaily.date,
    total_sent: sql<number>`sum(${analyticsDaily.totalSent})`.as('total_sent'),
    total_delivered: sql<number>`sum(${analyticsDaily.totalDelivered})`.as('total_delivered'),
    total_failed: sql<number>`sum(${analyticsDaily.totalFailed})`.as('total_failed'),
  })
    .from(analyticsDaily)
    .where(and(...conditions))
    .groupBy(analyticsDaily.date)
    .orderBy(desc(analyticsDaily.date))
    .all()
}

export function getSmtpUsage(): Array<{ id: string; name: string | null; total_sent: number }> {
  const db = getDb()
  return db.select({
    id: smtpConfigs.id,
    name: smtpConfigs.name,
    total_sent: sql<number>`count(${emailLogs.id})`.as('total_sent'),
  })
    .from(smtpConfigs)
    .leftJoin(emailLogs, and(
      eq(emailLogs.smtpConfigId, smtpConfigs.id),
      eq(emailLogs.status, 'delivered'),
    ))
    .groupBy(smtpConfigs.id)
    .orderBy(desc(smtpConfigs.createdAt))
    .all()
}

export function clearLogs(): void {
  const db = getDb()
  db.delete(emailLogs).run()
}

export function getProviderDistribution(): Array<{ id: string; name: string | null; sent: number; delivered: number; failed: number }> {
  const db = getDb()
  return db.select({
    id: smtpConfigs.id,
    name: smtpConfigs.name,
    sent: sql<number>`count(${emailLogs.id})`.as('sent'),
    delivered: sql<number>`sum(case when ${emailLogs.status} = 'delivered' then 1 else 0 end)`.as('delivered'),
    failed: sql<number>`sum(case when ${emailLogs.status} = 'failed' then 1 else 0 end)`.as('failed'),
  })
    .from(smtpConfigs)
    .leftJoin(emailLogs, eq(emailLogs.smtpConfigId, smtpConfigs.id))
    .groupBy(smtpConfigs.id)
    .orderBy(desc(sql`count(${emailLogs.id})`))
    .all()
}

export function getKeyUsage(): Array<{ id: string; name: string; key_prefix: string; sent: number; delivered: number; failed: number }> {
  const db = getDb()
  return db.select({
    id: apiKeys.id,
    name: apiKeys.name,
    key_prefix: apiKeys.keyPrefix,
    sent: sql<number>`count(${emailLogs.id})`.as('sent'),
    delivered: sql<number>`sum(case when ${emailLogs.status} = 'delivered' then 1 else 0 end)`.as('delivered'),
    failed: sql<number>`sum(case when ${emailLogs.status} = 'failed' then 1 else 0 end)`.as('failed'),
  })
    .from(apiKeys)
    .leftJoin(emailLogs, eq(emailLogs.apiKeyId, apiKeys.id))
    .groupBy(apiKeys.id)
    .orderBy(desc(sql`count(${emailLogs.id})`))
    .all()
}

export function getRecipientStats(limit: number = 20): Array<{ domain: string; count: number }> {
  const db = getDb()
  const rows = db.select({ toAddresses: emailLogs.toAddresses })
    .from(emailLogs)
    .where(eq(emailLogs.status, 'delivered'))
    .all()

  const domainCounts = new Map<string, number>()
  for (const row of rows) {
    try {
      const addrs: string[] = JSON.parse(row.toAddresses)
      for (const addr of addrs) {
        const domain = addr.split('@')[1]?.toLowerCase()
        if (domain) domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1)
      }
    } catch { /* skip */ }
  }

  return Array.from(domainCounts.entries())
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
