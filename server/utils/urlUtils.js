function normalizeBaseUrl(value) {
  if (!value) {
    return ''
  }

  return String(value).trim().replace(/\/+$/, '')
}

function getClientBaseUrl() {
  const fromEnv = process.env.CLIENT_URL || process.env.CLIENT_APP_URL || process.env.PUBLIC_APP_URL
  const fromCors = (process.env.CORS_ORIGIN || '').split(',')[0]
  const base = normalizeBaseUrl(fromEnv || fromCors || 'http://localhost:5173')

  return base || 'http://localhost:5173'
}

export { getClientBaseUrl }
