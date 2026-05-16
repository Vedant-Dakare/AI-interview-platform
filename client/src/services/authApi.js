const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

async function request(path, method = 'POST', payload = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  }

  if (payload) {
    options.body = JSON.stringify(payload)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, options)

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Request failed. Please try again.')
  }

  return data
}

export async function signup(payload) {
  const response = await request('/api/auth/register', 'POST', payload)
  return response
}

export async function login(payload) {
  const response = await request('/api/auth/login', 'POST', payload)
  return response
}

export async function logout() {
  try {
    await request('/api/auth/logout', 'POST')
  } catch {
    // Ignore logout network errors
  }
}

export async function getCurrentUser() {
  const response = await request('/api/auth/me', 'GET')
  return response
}

export function getOAuthUrl(provider, redirectPath = '') {
  const params = new URLSearchParams()
  if (redirectPath) {
    params.set('redirect', redirectPath)
  }

  const query = params.toString()
  return `${API_BASE_URL}/api/auth/${provider}${query ? `?${query}` : ''}`
}

export function parseOAuthCallback(hashValue = window.location.hash || '') {
  const hash = String(hashValue)
  const [, queryString = ''] = hash.split('?')
  const params = new URLSearchParams(queryString)
  const redirect = params.get('redirect')
  const error = params.get('error')
  const success = params.get('success')

  return {
    redirect,
    error,
    success,
  }
}
