import { useEffect, useState } from 'react'
import './App.css'
import './InterviewPage.css'
import LandingPage from './components/landing/LandingPage'
import InterviewPage from './components/interview/InterviewPage'
import AuthPage from './components/auth/AuthPage'
import AuthCallbackPage from './components/auth/AuthCallbackPage'
import CandidateApplyPage from './components/apply/CandidateApplyPage'
import ProtectedPlaceholder from './components/auth/ProtectedPlaceholder'
import { startInterviewWithToken, validateInterviewToken } from './services/interviewLinkApi'
import { useAuth } from './context/AuthContext'

function extractInterviewToken(hash) {
  if (!hash.startsWith('#/interview/')) {
    return null
  }

  return hash.replace('#/interview/', '').trim() || null
}

function getRoute() {
  const hash = window.location.hash || '#/'

  if (hash.startsWith('#/interview/')) {
    return 'interview-link'
  }

  if (hash === '#/interview') {
    return 'interview'
  }

  if (hash.startsWith('#/login')) {
    return 'login'
  }

  if (hash.startsWith('#/signup')) {
    return 'signup'
  }

  if (hash.startsWith('#/auth/callback')) {
    return 'auth-callback'
  }

  if (hash.startsWith('#/apply')) {
    return 'apply'
  }

  if (hash === '#/dashboard') {
    return 'dashboard'
  }

  if (hash === '#/reports') {
    return 'reports'
  }

  if (hash === '#/analytics' || hash === '#/history') {
    return 'analytics'
  }

  return 'landing'
}

function App() {
  const { isAuthenticated, isInitializing, logout } = useAuth()
  const [route, setRoute] = useState(getRoute())
  const [interviewToken, setInterviewToken] = useState(extractInterviewToken(window.location.hash || '#/'))
  const [interviewLinkState, setInterviewLinkState] = useState({ status: 'idle', error: '', context: null })

  const protectedRoutes = new Set(['interview', 'apply', 'dashboard', 'reports', 'analytics'])

  useEffect(() => {
    function handleHashChange() {
      setRoute(getRoute())
      setInterviewToken(extractInterviewToken(window.location.hash || '#/'))
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  function openInterviewPage() {
    if (!isAuthenticated) {
      localStorage.setItem('auth-redirect', '#/interview')
      openLoginPage()
      return
    }

    window.location.hash = '/interview'
    setRoute('interview')
  }

  function openApplyPage() {
    if (!isAuthenticated) {
      localStorage.setItem('auth-redirect', '#/apply')
      openLoginPage()
      return
    }

    window.location.hash = '/apply'
    setRoute('apply')
  }

  function openLoginPage() {
    window.location.hash = '/login'
    setRoute('login')
  }

  function openSignUpPage() {
    window.location.hash = '/signup'
    setRoute('signup')
  }

  function openLandingPage() {
    window.location.hash = '/'
    setRoute('landing')
  }

  function handleAuthSuccess() {
    const pendingToken = localStorage.getItem('pending-interview-token')
    if (pendingToken) {
      window.location.hash = `/interview/${pendingToken}`
      return
    }

    const redirectTarget = localStorage.getItem('auth-redirect')
    if (redirectTarget) {
      localStorage.removeItem('auth-redirect')
      const cleanedTarget = redirectTarget.startsWith('#')
        ? redirectTarget.slice(1)
        : redirectTarget
      window.location.hash = cleanedTarget
      return
    }

    window.location.hash = '/interview'
    setRoute('interview')
  }

  useEffect(() => {
    if (route !== 'interview-link' || !interviewToken) {
      setInterviewLinkState({ status: 'idle', error: '', context: null })
      return
    }

    if (!isAuthenticated) {
      // Not logged in - redirect to login and store pending token
      localStorage.setItem('pending-interview-token', interviewToken)
      localStorage.setItem('auth-redirect', `#/interview/${interviewToken}`)
      setInterviewLinkState({ status: 'idle', error: '', context: null })
      setRoute('login')
      window.location.hash = '/login'
      return
    }

    // User is logged in - validate and start interview
    let isMounted = true

    async function validateAndStart() {
      setInterviewLinkState({ status: 'loading', error: '', context: null })

      try {
        await validateInterviewToken(interviewToken)
        const startResponse = await startInterviewWithToken(interviewToken)

        if (!isMounted) {
          return
        }

        localStorage.removeItem('pending-interview-token')
        setInterviewLinkState({
          status: 'ready',
          error: '',
          context: startResponse.data,
        })
      } catch (error) {
        if (!isMounted) {
          return
        }

        // If authorization fails, clear session and redirect to login
        if (error.message.includes('Unauthorized') || error.message.includes('invalid token')) {
          logout()
          localStorage.setItem('pending-interview-token', interviewToken)
          localStorage.setItem('auth-redirect', `#/interview/${interviewToken}`)
          setRoute('login')
          window.location.hash = '/login'
          return
        }

        setInterviewLinkState({ status: 'error', error: error.message, context: null })
      }
    }

    validateAndStart()

    return () => {
      isMounted = false
    }
  }, [route, interviewToken])

  useEffect(() => {
    if (isInitializing) {
      return
    }

    if (protectedRoutes.has(route) && !isAuthenticated) {
      localStorage.setItem('auth-redirect', window.location.hash || '#/interview')
      setRoute('login')
      window.location.hash = '/login'
    }
  }, [route, isAuthenticated, isInitializing])

  if (route === 'interview') {
    return <InterviewPage />
  }

  if (route === 'interview-link') {
    if (interviewLinkState.status === 'loading') {
      return (
        <div className="interview-link-status">
          <h2>Verifying your interview link...</h2>
          <p>Please wait while we securely validate your access.</p>
        </div>
      )
    }

    if (interviewLinkState.status === 'error') {
      return (
        <div className="interview-link-status">
          <h2>Unable to start interview</h2>
          <p>{interviewLinkState.error || 'Invalid link'}</p>
          <button type="button" className="btn-primary-sm" onClick={openLandingPage}>
            Back to Home
          </button>
        </div>
      )
    }

    if (interviewLinkState.status === 'ready') {
      return <InterviewPage interviewContext={interviewLinkState.context} />
    }
  }

  if (route === 'login') {
    return (
      <AuthPage
        mode="login"
        onSuccess={handleAuthSuccess}
        onSwitchToSignup={openSignUpPage}
        onBackHome={openLandingPage}
      />
    )
  }

  if (route === 'signup') {
    return (
      <AuthPage
        mode="signup"
        onSuccess={handleAuthSuccess}
        onSwitchToLogin={openLoginPage}
        onBackHome={openLandingPage}
      />
    )
  }

  if (route === 'auth-callback') {
    return <AuthCallbackPage onBackHome={openLandingPage} />
  }

  if (route === 'apply') {
    return <CandidateApplyPage onBackHome={openLandingPage} />
  }

  if (route === 'dashboard') {
    return (
      <ProtectedPlaceholder
        title="Interview Dashboard"
        description="Your AI interview control room is ready. Sign in to review sessions, manage pipelines, and launch new interviews."
        onBackHome={openLandingPage}
      />
    )
  }

  if (route === 'reports') {
    return (
      <ProtectedPlaceholder
        title="Performance Reports"
        description="Sign in to access deep performance breakdowns, rubric scores, and candidate insights."
        onBackHome={openLandingPage}
      />
    )
  }

  if (route === 'analytics') {
    return (
      <ProtectedPlaceholder
        title="Analytics & History"
        description="Track interview history, proctoring events, and AI analytics once you're authenticated."
        onBackHome={openLandingPage}
      />
    )
  }

  return (
    <LandingPage
      onOpenInterview={openInterviewPage}
      onOpenLogin={openLoginPage}
      onOpenApply={openApplyPage}
    />
  )
}

export default App
