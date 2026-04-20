import { getAuthToken } from './authApi'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

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

async function requestBinaryWithAuth(path, method = 'GET', body = null) {
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

  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(message || 'Interview audio request failed')
  }

  return response.blob()
}

export async function startInterview(role, candidateName) {
  return requestWithAuth('/api/interview/start', 'POST', { role, candidateName })
}

export async function getRoleQuestions(role) {
  return requestWithAuth(`/api/interview/questions?role=${encodeURIComponent(role)}`, 'GET')
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

export async function submitInterviewAnswer(interviewId, questionId, answerText) {
  return requestWithAuth('/api/interview/answer', 'POST', {
    interviewId,
    questionId,
    answerText,
  })
}

export async function endInterview(interviewId) {
  return requestWithAuth(`/api/interview/${interviewId}/end`, 'POST')
}

export async function endInterviewById(interviewId) {
  return requestWithAuth('/api/interview/end', 'POST', { interviewId })
}

export async function synthesizeInterviewSpeech(text) {
  return requestBinaryWithAuth('/api/interview/tts', 'POST', { text })
}
