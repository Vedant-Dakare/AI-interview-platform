import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { parseOAuthCallback } from '../../services/authApi'
import { useAuth } from '../../context/AuthContext'

function AuthCallbackPage({ onBackHome }) {
  const { refreshSession } = useAuth()
  const [error, setError] = useState('')

  useEffect(() => {
    const { redirect, error: oauthError, success } = parseOAuthCallback()

    if (oauthError) {
      setError('Unable to complete OAuth login. Please try again.')
      return
    }

    if (success !== '1') {
      setError('Missing authentication payload. Please try again.')
      return
    }

    let isMounted = true

    async function finalizeSession() {
      try {
        await refreshSession()

        const pendingInterview = localStorage.getItem('pending-interview-token')
        const nextTarget =
          (pendingInterview ? `#/interview/${pendingInterview}` : '') ||
          redirect ||
          localStorage.getItem('auth-redirect') ||
          '#/interview'
        localStorage.removeItem('auth-redirect')
        if (pendingInterview) {
          localStorage.removeItem('pending-interview-token')
        }

        const timer = window.setTimeout(() => {
          window.location.hash = nextTarget
        }, 600)

        return () => window.clearTimeout(timer)
      } catch {
        if (isMounted) {
          setError('Missing authentication payload. Please try again.')
        }
      }
      return undefined
    }

    let cleanupTimer
    finalizeSession().then((cleanup) => {
      cleanupTimer = cleanup
    })

    return () => {
      isMounted = false
      cleanupTimer?.()
    }
  }, [refreshSession])

  return (
    <div className="auth-page">
      <div className="auth-backdrop" aria-hidden="true">
        <div className="auth-bg-grid" />
        <div className="auth-glow auth-glow-one" />
        <div className="auth-glow auth-glow-two" />
        <div className="auth-noise" />
      </div>
      <motion.div
        className="auth-callback-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="auth-callback-icon">
          <span className="material-symbols-outlined">shield</span>
        </div>
        <h2>{error ? 'Authentication halted' : 'Securing your session'}</h2>
        <p>
          {error
            ? error
            : 'Finalizing OAuth handshake and preparing your AI workspace. This takes just a moment.'}
        </p>
        {error ? (
          <button type="button" className="btn-primary-sm" onClick={onBackHome}>
            Back to Home
          </button>
        ) : (
          <div className="auth-spinner" aria-hidden="true" />
        )}
      </motion.div>
    </div>
  )
}

export default AuthCallbackPage
