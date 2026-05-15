import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { login, signup, getOAuthUrl } from '../../services/authApi'
import { useAuth } from '../../context/AuthContext'

function AuthPage({ mode = 'login', onSuccess, onSwitchToSignup, onSwitchToLogin, onBackHome }) {
  const { setSession } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const isSignup = mode === 'signup'

  const content = useMemo(() => {
    if (isSignup) {
      return {
        title: 'Create your IntervueAI account',
        subtitle: 'Design your AI interview journey with adaptive coaching and real-time insights.',
        submitLabel: 'Create Account',
        switchLabel: 'Already have an account?',
        switchActionLabel: 'Sign In',
        eyebrow: 'New account',
      }
    }

    return {
      title: 'Welcome back to IntervueAI',
      subtitle: 'Sign in to continue your AI-driven interview preparation workflow.',
      submitLabel: 'Sign In',
      switchLabel: 'New to IntervueAI?',
      switchActionLabel: 'Create account',
      eyebrow: 'Secure access',
    }
  }, [isSignup])

  useEffect(() => {
    if (window.location.hash.includes('error=oauth')) {
      setErrorMessage('OAuth sign-in failed. Please try again or use email + password.')
    }
  }, [])

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
      const response = isSignup
        ? await signup({
            name: fullName.trim(),
            email: email.trim(),
            password,
          })
        : await login({
            email: email.trim(),
            password,
          })

      if (response?.data) {
        setSession(response.data)
      }

      onSuccess?.()
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  function handleOAuthLogin(provider) {
    setErrorMessage('')
    setOauthLoading(provider)

    const redirectPath = localStorage.getItem('auth-redirect') || window.location.hash || '#/interview'
    const oauthUrl = getOAuthUrl(provider, redirectPath)
    window.location.href = oauthUrl
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
      <div className="auth-backdrop" aria-hidden="true">
        <div className="auth-bg-grid" />
        <div className="auth-glow auth-glow-one" />
        <div className="auth-glow auth-glow-two" />
        <div className="auth-noise" />
      </div>

      <motion.div
        className="auth-container auth-split"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <section className="auth-brand-panel">
          <div className="auth-brand-header">
            <span className="auth-brand">IntervueAI</span>
            <span className="auth-badge">AI Interview Studio</span>
          </div>

          <h1>
            Ace Your AI Interview Journey
            <span className="gradient-text">. Practice. Analyze. Improve.</span>
          </h1>
          <p>
            A futuristic interview cockpit designed for precision hiring and confident candidates. Your AI
            copilot aligns question quality, response depth, and performance analytics in real time.
          </p>

          <div className="auth-visual-card">
            <div className="auth-visual-glow" />
            <div className="auth-orbit">
              <div className="auth-ring auth-ring-outer" />
              <div className="auth-ring auth-ring-mid" />
              <div className="auth-ring auth-ring-inner" />
              <div className="auth-core">
                <span className="material-symbols-outlined">hub</span>
              </div>
            </div>
            <div className="auth-signal">
              <div>
                <span>Signal integrity</span>
                <div className="signal-track"><div className="signal-fill" /></div>
              </div>
              <div>
                <span>Confidence index</span>
                <div className="signal-track"><div className="signal-fill s2" /></div>
              </div>
            </div>
          </div>

          <div className="auth-points">
            <div>
              <span className="material-symbols-outlined">auto_awesome</span>
              Adaptive questioning tailored to role DNA.
            </div>
            <div>
              <span className="material-symbols-outlined">shield</span>
              Real-time integrity checks and proctoring.
            </div>
            <div>
              <span className="material-symbols-outlined">insights</span>
              Reports, analytics, and candidate replay.
            </div>
          </div>
        </section>

        <section className="auth-form-panel">
          <button type="button" className="auth-back-link" onClick={onBackHome}>
            <span className="material-symbols-outlined">arrow_back</span>
            Back to Home
          </button>

          <div className="auth-header">
            <span className="auth-eyebrow">{content.eyebrow}</span>
            <h2>{content.title}</h2>
            <p>{content.subtitle}</p>
          </div>

          <div className="auth-oauth">
            <button
              type="button"
              className="auth-provider-btn"
              onClick={() => handleOAuthLogin('google')}
              disabled={oauthLoading === 'google'}
            >
              <span className="auth-provider-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="img" aria-label="Google">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.6h5.05c-.2 1.1-.86 2.03-1.83 2.66v2.2h2.96c1.73-1.6 2.72-3.95 2.72-6.75 0-.63-.06-1.24-.18-1.84H12z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 21.5c2.48 0 4.56-.82 6.08-2.23l-2.96-2.2c-.82.55-1.86.88-3.12.88-2.4 0-4.44-1.62-5.18-3.8H3.74v2.38C5.25 19.6 8.34 21.5 12 21.5z"
                  />
                  <path
                    fill="#4A90E2"
                    d="M6.82 14.15c-.2-.6-.32-1.25-.32-1.95s.12-1.35.32-1.95V7.87H3.74A9.5 9.5 0 0 0 2.5 12.2c0 1.53.37 2.97 1.24 4.33l3.08-2.38z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M12 6.4c1.35 0 2.56.47 3.52 1.4l2.64-2.64C16.54 3.6 14.48 2.7 12 2.7c-3.66 0-6.75 1.9-8.26 4.97l3.08 2.38c.74-2.18 2.78-3.8 5.18-3.8z"
                  />
                </svg>
              </span>
              <span>{oauthLoading === 'google' ? 'Connecting...' : 'Continue with Google'}</span>
              {oauthLoading === 'google' ? <span className="auth-spinner" aria-hidden="true" /> : null}
            </button>

            <button
              type="button"
              className="auth-provider-btn"
              onClick={() => handleOAuthLogin('github')}
              disabled={oauthLoading === 'github'}
            >
              <span className="auth-provider-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="img" aria-label="GitHub">
                  <path
                    fill="currentColor"
                    d="M12 2.2c-5.37 0-9.73 4.36-9.73 9.73 0 4.3 2.84 7.95 6.78 9.23.5.09.68-.22.68-.49v-1.72c-2.76.6-3.34-1.33-3.34-1.33-.45-1.14-1.1-1.44-1.1-1.44-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.2-.25-4.5-1.1-4.5-4.9 0-1.08.38-1.96 1.02-2.65-.1-.25-.45-1.26.1-2.62 0 0 .83-.27 2.72 1.02a9.4 9.4 0 0 1 4.96 0c1.89-1.29 2.72-1.02 2.72-1.02.55 1.36.2 2.37.1 2.62.64.69 1.02 1.57 1.02 2.65 0 3.8-2.3 4.65-4.51 4.89.36.31.68.92.68 1.86v2.76c0 .27.18.58.69.48a9.75 9.75 0 0 0 6.77-9.22c0-5.37-4.36-9.73-9.73-9.73z"
                  />
                </svg>
              </span>
              <span>{oauthLoading === 'github' ? 'Connecting...' : 'Continue with GitHub'}</span>
              {oauthLoading === 'github' ? <span className="auth-spinner" aria-hidden="true" /> : null}
            </button>
          </div>

          <div className="auth-divider">
            <span>or continue with email</span>
          </div>

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

          <div className="auth-footer-note">
            Secure sessions with encrypted tokens and role-based access control.
          </div>
        </section>
      </motion.div>
    </div>
  )
}

export default AuthPage
