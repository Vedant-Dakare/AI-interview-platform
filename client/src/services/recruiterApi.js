const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

async function request(path, method = 'GET', payload = null) {
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

export async function getRecruiterCandidates(params = {}) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, value)
    }
  })

  const query = searchParams.toString()
  return request(`/api/recruiter/candidates${query ? `?${query}` : ''}`)
}

export async function getRecruiterCandidateDetail(candidateId) {
  return request(`/api/recruiter/candidates/${candidateId}`)
}

export async function shortlistRecruiterCandidate(candidateId, payload = {}) {
  return request(`/api/recruiter/candidates/${candidateId}/shortlist`, 'POST', payload)
}

export async function rejectRecruiterCandidate(candidateId, payload = {}) {
  return request(`/api/recruiter/candidates/${candidateId}/reject`, 'POST', payload)
}

export async function addRecruiterNote(candidateId, payload = {}) {
  return request(`/api/recruiter/candidates/${candidateId}/notes`, 'POST', payload)
}

export async function getRecruiterDashboard() {
  return request('/api/recruiter/dashboard')
}

export async function getRecruiterInterviews(params = {}) {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, value)
    }
  })

  const query = searchParams.toString()
  return request(`/api/recruiter/interviews${query ? `?${query}` : ''}`)
}

export async function createRecruiterInterview(payload) {
  return request('/api/recruiter/interviews', 'POST', payload)
}

export async function resendRecruiterInterviewEmail(candidateId) {
  return request(`/api/recruiter/interviews/${candidateId}/resend`, 'POST')
}
