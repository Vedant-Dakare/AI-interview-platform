const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export async function submitCandidateApplication({ fullName, email, role, resumeFile }) {
  const formData = new FormData()
  formData.append('fullName', fullName)
  formData.append('email', email)
  formData.append('role', role)
  formData.append('resume', resumeFile)

  const response = await fetch(`${API_BASE_URL}/api/apply`, {
    method: 'POST',
    body: formData,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Unable to submit application. Please try again.')
  }

  return data
}
