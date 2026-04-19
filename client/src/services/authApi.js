const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// Cookie utility functions
function setCookie(name, value, days = 7) {
  const date = new Date()
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
  const expires = `expires=${date.toUTCString()}`
  document.cookie = `${name}=${value};${expires};path=/`
}

function getCookie(name) {
  const nameEQ = `${name}=`
  const cookies = document.cookie.split(';')
  for (let cookie of cookies) {
    cookie = cookie.trim()
    if (cookie.startsWith(nameEQ)) {
      return cookie.substring(nameEQ.length)
    }
  }
  return null
}

function removeCookie(name) {
  setCookie(name, '', -1)
}

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
  if (data?.token) {
    setCookie('intervueai-token', data.token, 7)
  }
  if (data?.user) {
    setCookie('intervueai-user', JSON.stringify(data.user), 7)
  }
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

export function logout() {
  removeCookie('intervueai-token')
  removeCookie('intervueai-user')
}

export function getAuthToken() {
  return getCookie('intervueai-token')
}

export function getAuthUser() {
  const user = getCookie('intervueai-user')
  return user ? JSON.parse(user) : null
}
