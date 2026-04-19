const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function getAuthToken() {
  return localStorage.getItem('intervueai-token')
}

async function requestWithAuth(path, method = 'GET', body = null) {
  const token = getAuthToken()

  if (!token) {
    throw new Error('Please sign in to continue')
  }

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  if (body) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, options)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Interview request failed')
  }

  return data
}

export async function startInterview(role) {
  return requestWithAuth('/api/interview/start', 'POST', { role })
}

export async function getInterview(interviewId) {
  return requestWithAuth(`/api/interview/${interviewId}`, 'GET')
}

export async function submitAnswer(interviewId, answer) {
  return requestWithAuth(`/api/interview/${interviewId}/answer`, 'POST', { answer })
}

export async function moveToNextQuestion(interviewId) {
  return requestWithAuth(`/api/interview/${interviewId}/next`, 'POST')
}

export async function endInterview(interviewId) {
  return requestWithAuth(`/api/interview/${interviewId}/end`, 'POST')
}
