import { useMemo, useState } from 'react'
import { login, signup } from '../../services/authApi'

function AuthPage({ mode = 'login', onSuccess, onSwitchToSignup, onSwitchToLogin, onBackHome }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const isSignup = mode === 'signup'

  const content = useMemo(() => {
    if (isSignup) {
      return {
        title: 'Create your IntervueAI account',
        subtitle: 'Set up your profile to run structured mock interviews and track performance.',
        submitLabel: 'Create Account',
        switchLabel: 'Already have an account?',
        switchActionLabel: 'Sign In',
      }
    }

    return {
      title: 'Welcome back to IntervueAI',
      subtitle: 'Sign in to continue your interview preparation workflow.',
      submitLabel: 'Sign In',
      switchLabel: 'New to IntervueAI?',
      switchActionLabel: 'Create account',
    }
  }, [isSignup])

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    if (isSignup && !fullName.trim()) {
      setErrorMessage('Full name is required.')
      return
    }

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Email and password are required.')
      return
    }

    setIsLoading(true)

    try {
      if (isSignup) {
        await signup({
          name: fullName.trim(),
          email: email.trim(),
          password,
        })
      } else {
        await login({
          email: email.trim(),
          password,
        })
      }

      onSuccess?.()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleSwitchAuthPage() {
    if (isSignup) {
      onSwitchToLogin?.()
      return
    }

    onSwitchToSignup?.()
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
          <h2>{content.title}</h2>
          <p>{content.subtitle}</p>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            {isSignup ? (
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
            ) : null}

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
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
            </label>

            {errorMessage ? <div className="auth-error">{errorMessage}</div> : null}

            <button type="submit" className="auth-submit" disabled={isLoading}>
              {isLoading ? 'Please wait...' : content.submitLabel}
            </button>
          </form>

          <div className="auth-switch-row">
            <span>{content.switchLabel}</span>
            <button type="button" onClick={handleSwitchAuthPage}>
              {content.switchActionLabel}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}

export default AuthPage
