import type { SmtpConfigRow } from './manager.js'

interface OAuth2TokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

/**
 * Refresh OAuth2 access token using a refresh token.
 * Supports:
 * - Microsoft (Azure AD / Outlook / Office 365)
 * - Google (Gmail)
 * - Generic OAuth2 (custom token_url)
 */
export async function refreshOAuth2Token(
  config: SmtpConfigRow,
  provider: 'microsoft' | 'google' | 'generic' = 'generic',
  tokenUrl?: string,
): Promise<{ accessToken: string; expiresAt: number }> {
  const clientId = config.oauth2_client_id
  const clientSecret = config.oauth2_client_secret_encrypted
  const refreshToken = config.oauth2_refresh_token_encrypted

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('OAuth2 configuration incomplete: missing client_id, client_secret, or refresh_token')
  }

  let url: string
  const params = new URLSearchParams()

  switch (provider) {
    case 'microsoft':
      url = `https://login.microsoftonline.com/${config.oauth2_tenant_id || 'common'}/oauth2/v2.0/token`
      params.set('grant_type', 'refresh_token')
      params.set('client_id', clientId)
      params.set('client_secret', clientSecret)
      params.set('refresh_token', refreshToken)
      params.set('scope', 'https://outlook.office365.com/.default offline_access')
      break

    case 'google':
      url = 'https://oauth2.googleapis.com/token'
      params.set('grant_type', 'refresh_token')
      params.set('client_id', clientId)
      params.set('client_secret', clientSecret)
      params.set('refresh_token', refreshToken)
      break

    case 'generic':
      if (!tokenUrl) throw new Error('token_url required for generic OAuth2')
      url = tokenUrl
      params.set('grant_type', 'refresh_token')
      params.set('client_id', clientId)
      params.set('client_secret', clientSecret)
      params.set('refresh_token', refreshToken)
      break
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`OAuth2 token refresh failed (${res.status}): ${body}`)
  }

  const data: OAuth2TokenResponse = await res.json()
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 60_000, // 1 min buffer
  }
}

export function isTokenExpired(expiresAt: number | null): boolean {
  if (!expiresAt) return true
  return Date.now() >= expiresAt
}
