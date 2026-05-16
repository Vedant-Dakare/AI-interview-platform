const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

async function requestWithAuth(path, method = 'GET') {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: 'include',
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Interview link request failed')
  }

  return data
}

export async function validateInterviewToken(token) {
  return requestWithAuth(`/api/interview-links/validate/${token}`, 'GET')
}

export async function startInterviewWithToken(token) {
  return requestWithAuth(`/api/interview-links/start/${token}`, 'POST')
}
