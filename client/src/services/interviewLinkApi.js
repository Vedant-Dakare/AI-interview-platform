const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function getAuthToken() {
  return localStorage.getItem('intervueai-token')
}

async function requestWithAuth(path, method = 'GET') {
  const token = getAuthToken()

  if (!token) {
    throw new Error('Please sign in to continue')
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
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
