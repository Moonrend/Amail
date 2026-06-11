import { getDb } from '../db/index.js'

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

  const total = db.prepare(`
    SELECT
      COUNT(*) as total_emails,
      SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status IN ('queued', 'sending') THEN 1 ELSE 0 END) as queued
    FROM email_logs
  `).get() as any

  const todayStats = db.prepare(`
    SELECT
      COALESCE(SUM(total_sent), 0) as today_sent,
      COALESCE(SUM(total_delivered), 0) as today_delivered,
      COALESCE(SUM(total_failed), 0) as today_failed
    FROM analytics_daily WHERE date = ?
  `).get(today) as any

  return {
    total_emails: total?.total_emails || 0,
    delivered: total?.delivered || 0,
    failed: total?.failed || 0,
    queued: total?.queued || 0,
    today_sent: todayStats?.today_sent || 0,
    today_delivered: todayStats?.today_delivered || 0,
    today_failed: todayStats?.today_failed || 0,
  }
}

export function getDailyStats(days: number = 30, filters?: { api_key_id?: string; smtp_config_id?: string }): DailyStats[] {
  const db = getDb()
  let where = "date >= date('now', '-' || ? || ' days')"
  const params: any[] = [days]

  if (filters?.api_key_id) {
    where += ' AND api_key_id = ?'
    params.push(filters.api_key_id)
  }
  if (filters?.smtp_config_id) {
    where += ' AND smtp_config_id = ?'
    params.push(filters.smtp_config_id)
  }

  // If filtering by smtp_config_id, query from email_logs directly (analytics_daily doesn't track smtp_config_id)
  if (filters?.smtp_config_id) {
    return db.prepare(`
      SELECT date(sent_at) as date,
        COUNT(*) as total_sent,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as total_delivered,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed
      FROM email_logs
      WHERE sent_at IS NOT NULL AND sent_at >= date('now', '-' || ? || ' days') AND smtp_config_id = ?
      ${filters?.api_key_id ? 'AND api_key_id = ?' : ''}
      GROUP BY date(sent_at)
      ORDER BY date DESC
    `).all(...params) as DailyStats[]
  }

  return db.prepare(`
    SELECT date,
      SUM(total_sent) as total_sent,
      SUM(total_delivered) as total_delivered,
      SUM(total_failed) as total_failed
    FROM analytics_daily
    WHERE ${where}
    GROUP BY date
    ORDER BY date DESC
  `).all(...params) as DailyStats[]
}

export function getSmtpUsage(): Array<{ id: string; name: string; total_sent: number }> {
  const db = getDb()
  return db.prepare(`
    SELECT s.id, s.name, COUNT(e.id) as total_sent
    FROM smtp_configs s
    LEFT JOIN email_logs e ON e.smtp_config_id = s.id AND e.status = 'delivered'
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `).all() as any[]
}

export function clearLogs(): void {
  const db = getDb()
  db.exec('DELETE FROM email_logs')
}

export function getProviderDistribution(): Array<{ id: string; name: string; sent: number; delivered: number; failed: number }> {
  const db = getDb()
  return db.prepare(`
    SELECT s.id, s.name,
      COUNT(e.id) as sent,
      SUM(CASE WHEN e.status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN e.status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM smtp_configs s
    LEFT JOIN email_logs e ON e.smtp_config_id = s.id
    GROUP BY s.id
    ORDER BY sent DESC
  `).all() as any[]
}

export function getKeyUsage(): Array<{ id: string; name: string; key_prefix: string; sent: number; delivered: number; failed: number }> {
  const db = getDb()
  return db.prepare(`
    SELECT k.id, k.name, k.key_prefix,
      COUNT(e.id) as sent,
      SUM(CASE WHEN e.status = 'delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(CASE WHEN e.status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM api_keys k
    LEFT JOIN email_logs e ON e.api_key_id = k.id
    GROUP BY k.id
    ORDER BY sent DESC
  `).all() as any[]
}

export function getRecipientStats(limit: number = 20): Array<{ domain: string; count: number }> {
  const db = getDb()
  // Extract domain from to_addresses JSON array and count
  const rows = db.prepare(`
    SELECT to_addresses FROM email_logs WHERE status = 'delivered'
  `).all() as { to_addresses: string }[]

  const domainCounts = new Map<string, number>()
  for (const row of rows) {
    try {
      const addrs: string[] = JSON.parse(row.to_addresses)
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
