import { useState } from 'react'
import { submitCandidateApplication } from '../../services/applicationApi'

function CandidateApplyPage({ onBackHome }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('backend')
  const [resumeFile, setResumeFile] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [fallbackInterviewLink, setFallbackInterviewLink] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setFallbackInterviewLink('')

    if (!fullName.trim() || !email.trim()) {
      setErrorMessage('Full name and email are required.')
      return
    }

    if (!resumeFile) {
      setErrorMessage('Please upload your resume PDF.')
      return
    }

    const fileName = (resumeFile.name || '').toLowerCase()
    const isPdfByExt = fileName.endsWith('.pdf')
    const isPdfByMime = !resumeFile.type || resumeFile.type === 'application/pdf'

    if (!isPdfByExt || !isPdfByMime) {
      setErrorMessage('Resume must be a PDF file.')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await submitCandidateApplication({
        fullName: fullName.trim(),
        email: email.trim(),
        role,
        resumeFile,
      })

      setSuccessMessage(
        response.message || 'Your application has been submitted. Please check your email for the interview link.',
      )
      setFullName('')
      setEmail('')
      setRole('backend')
      setResumeFile(null)

      const emailSent = Boolean(response?.data?.emailSent)
      const interviewLink = response?.data?.interviewLink

      if (!emailSent && typeof interviewLink === 'string' && interviewLink) {
        setFallbackInterviewLink(interviewLink)
      }

      if (emailSent) {
        window.setTimeout(() => {
          if (typeof onBackHome === 'function') {
            onBackHome()
          }
        }, 1200)
      }
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to submit application. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-bg-grid" />
      <div className="auth-container">
        <section className="auth-form-panel">
          <button type="button" className="auth-back-link" onClick={onBackHome}>
            <span className="material-symbols-outlined">arrow_back</span>
            Back to Home
          </button>

          <h1 className="auth-brand-title">IntervueAI</h1>
          <h2>Candidate Application</h2>
          <p>Apply for your role and receive a secure interview link by email.</p>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <label>
              Full Name
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Jane Doe"
                autoComplete="name"
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </label>

            <label>
              Role
              <select value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="backend">Backend</option>
                <option value="ml">ML</option>
                <option value="dsa">DSA</option>
              </select>
            </label>

            <label>
              Resume (PDF)
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => setResumeFile(event.target.files?.[0] || null)}
              />
            </label>

            {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}
            {successMessage ? <div className="auth-success">{successMessage}</div> : null}
            {fallbackInterviewLink ? (
              <div className="auth-success">
                Email delivery is delayed. Use your secure interview link now:{' '}
                <a href={fallbackInterviewLink} target="_blank" rel="noreferrer">
                  Start Interview
                </a>
              </div>
            ) : null}

            <button type="submit" className="auth-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

export default CandidateApplyPage
