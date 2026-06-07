/**
 * SMTP Autoconfig — Thunderbird Autoconfig + DNS SRV fallback
 *
 * Fetches SMTP configuration from:
 * 1. https://autoconfig.thunderbird.net/v1.1/{domain}
 * 2. DNS SRV records (_submission._tcp.{domain})
 */

export interface AutoconfigResult {
  host: string
  port: number
  secure: boolean  // true = SSL/TLS, false = STARTTLS
  socketType: string
  authType: string
  username: string  // template, e.g. %EMAILADDRESS%
}

export interface AutoconfigResponse {
  domain: string
  smtp: AutoconfigResult[]
  source: 'thunderbird' | 'srv' | 'none'
}

/**
 * Fetch SMTP config from Thunderbird Autoconfig database
 */
async function fetchThunderbirdAutoconfig(domain: string): Promise<AutoconfigResult[]> {
  const url = `https://autoconfig.thunderbird.net/v1.1/${domain}`

  const res = await fetch(url, {
    headers: { 'Accept': 'application/xml, text/xml' },
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) return []

  const xml = await res.text()
  return parseAutoconfigXml(xml)
}

/**
 * Parse Thunderbird Autoconfig XML to extract SMTP settings
 */
function parseAutoconfigXml(xml: string): AutoconfigResult[] {
  const results: AutoconfigResult[] = []

  // Match all <outgoingServer type="smtp"> blocks
  const smtpBlocks = xml.match(/<outgoingServer\s+type="smtp">[\s\S]*?<\/outgoingServer>/gi) || []

  for (const block of smtpBlocks) {
    const host = extractTag(block, 'hostname')
    const portStr = extractTag(block, 'port')
    const socketType = extractTag(block, 'socketType')
    const username = extractTag(block, 'username')
    const auth = extractTag(block, 'authentication')

    if (!host || !portStr) continue

    const port = parseInt(portStr, 10)
    if (isNaN(port)) continue

    results.push({
      host,
      port,
      secure: socketType?.toUpperCase() === 'SSL',
      socketType: socketType || 'STARTTLS',
      authType: mapAuthType(auth),
      username: username || '%EMAILADDRESS%',
    })
  }

  return results
}

/**
 * Extract text content from an XML tag
 */
function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`, 'i'))
  return match ? match[1].trim() : null
}

/**
 * Map Thunderbird auth type to our auth_type
 */
function mapAuthType(auth: string | null): string {
  if (!auth) return 'password'
  const lower = auth.toLowerCase()
  if (lower.includes('oauth2')) return 'oauth2'
  if (lower === 'password-cleartext' || lower === 'password-encrypted') return 'password'
  if (lower === 'plain') return 'plain'
  if (lower === 'login') return 'login'
  if (lower === 'cram-md5') return 'cram-md5'
  return 'password'
}

/**
 * Try DNS SRV lookup for _submission._tcp.{domain}
 * Falls back when Thunderbird autoconfig has no results
 */
async function fetchSrvRecord(domain: string): Promise<AutoconfigResult[]> {
  // Use DNS-over-HTTPS via Cloudflare
  const url = `https://cloudflare-dns.com/dns-query?name=_submission._tcp.${domain}&type=SRV`

  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/dns-json' },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return []

    const data = await res.json() as any
    if (!data.Answer?.length) return []

    const results: AutoconfigResult[] = []
    for (const answer of data.Answer) {
      if (answer.type !== 33) continue // SRV type = 33

      // SRV data format: "priority weight port target"
      const parts = answer.data.split(/\s+/)
      if (parts.length < 4) continue

      const port = parseInt(parts[2], 10)
      const host = parts[3].replace(/\.$/, '') // Remove trailing dot

      if (isNaN(port) || !host) continue

      results.push({
        host,
        port,
        secure: port === 465,
        socketType: port === 465 ? 'SSL' : 'STARTTLS',
        authType: 'password',
        username: '%EMAILADDRESS%',
      })
    }

    return results
  } catch {
    return []
  }
}

/**
 * Main autoconfig function — tries Thunderbird first, then DNS SRV
 */
export async function discoverSmtpConfig(domain: string): Promise<AutoconfigResponse> {
  // Normalize domain
  domain = domain.toLowerCase().trim()

  // Try Thunderbird autoconfig first
  let results = await fetchThunderbirdAutoconfig(domain)
  if (results.length > 0) {
    return { domain, smtp: results, source: 'thunderbird' }
  }

  // Fallback to DNS SRV
  results = await fetchSrvRecord(domain)
  if (results.length > 0) {
    return { domain, smtp: results, source: 'srv' }
  }

  return { domain, smtp: [], source: 'none' }
}
