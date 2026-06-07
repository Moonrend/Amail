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

export function getDailyStats(days: number = 30): DailyStats[] {
  const db = getDb()
  return db.prepare(`
    SELECT date,
      SUM(total_sent) as total_sent,
      SUM(total_delivered) as total_delivered,
      SUM(total_failed) as total_failed
    FROM analytics_daily
    WHERE date >= date('now', '-' || ? || ' days')
    GROUP BY date
    ORDER BY date DESC
  `).all(days) as DailyStats[]
}

export function getSmtpUsage(): Array<{ id: string; name: string; total_sent: number }> {
  const db = getDb()
  // Get total sent per SMTP config from email_logs
  return db.prepare(`
    SELECT s.id, s.name, COUNT(e.id) as total_sent
    FROM smtp_configs s
    LEFT JOIN email_logs e ON e.smtp_config_id = s.id AND e.status = 'delivered'
    GROUP BY s.id
    ORDER BY s.priority DESC
  `).all() as any[]
}
