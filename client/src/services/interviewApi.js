const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

async function requestWithAuth(path, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  }

  if (body) {
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
  const options = {
    method,
    headers: {},
    credentials: 'include',
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

async function requestFormDataWithAuth(path, formData) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Interview request failed')
  }

  return data
}

export async function startInterview(role, candidateName, context = null) {
  return requestWithAuth('/api/interview/start', 'POST', {
    role,
    candidateName,
    resumeInsights: context?.resumeInsights ?? null,
    questionPlan: context?.questionPlan ?? null,
  })
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

export async function transcribeInterviewAudio(audioBlob, filename = 'answer.webm') {
  const formData = new FormData()
  formData.append('audio', audioBlob, filename)
  return requestFormDataWithAuth('/api/interview/transcribe', formData)
}

export async function getInterviewReport(interviewId) {
  return requestWithAuth(`/api/interview/report?interviewId=${encodeURIComponent(interviewId)}`, 'GET')
}
