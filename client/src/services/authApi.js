const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

async function request(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Request failed. Please try again.')
  }

  return data
}

function persistAuth(data) {
  if (!data?.token || !data?.user) {
    return
  }

  localStorage.setItem('intervueai-token', data.token)
  localStorage.setItem('intervueai-user', JSON.stringify(data.user))
}

export async function signup(payload) {
  const response = await request('/api/auth/register', payload)
  persistAuth(response.data)
  return response
}

export async function login(payload) {
  const response = await request('/api/auth/login', payload)
  persistAuth(response.data)
  return response
}
