const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export async function submitCandidateApplication({ fullName, email, role, resumeFile }) {
  const formData = new FormData()
  formData.append('fullName', fullName)
  formData.append('email', email)
  formData.append('role', role)
  formData.append('resume', resumeFile)

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 45000)

  let response
  try {
    response = await fetch(`${API_BASE_URL}/api/apply`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Submission timed out. Please check your connection and retry.')
    }

    throw new Error(error?.message || 'Unable to reach the server. Please try again.')
  } finally {
    window.clearTimeout(timeout)
  }

  let data = {}
  try {
    data = await response.clone().json()
  } catch {
    const text = await response.text().catch(() => '')
    if (text) {
      data = { message: text }
    }
  }

  if (!response.ok) {
    throw new Error(data.message || 'Unable to submit application. Please try again.')
  }

  return data
}
