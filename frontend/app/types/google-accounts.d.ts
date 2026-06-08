interface TokenResponse {
  access_token: string
  expires_in: number
  scope: string
  token_type: string
  error?: string
  error_description?: string
}

interface TokenClientConfig {
  client_id: string
  scope: string
  callback: (response: TokenResponse) => void
}

interface TokenClient {
  requestAccessToken: (hint?: { login_hint?: string }) => void
}

interface GoogleOauth2 {
  initTokenClient(config: TokenClientConfig): TokenClient
}

interface GoogleAccountsNamespace {
  oauth2: GoogleOauth2
}

interface Window {
  google?: {
    accounts: GoogleAccountsNamespace
  }
}
