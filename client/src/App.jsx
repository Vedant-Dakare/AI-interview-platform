import { useEffect, useState } from 'react'
import './App.css'
import './InterviewPage.css'
import LandingPage from './components/landing/LandingPage'
import InterviewPage from './components/interview/InterviewPage'
import AuthPage from './components/auth/AuthPage'
import AuthCallbackPage from './components/auth/AuthCallbackPage'
import CandidateApplyPage from './components/apply/CandidateApplyPage'
import ProtectedPlaceholder from './components/auth/ProtectedPlaceholder'
import RecruiterDashboard from './components/recruiter/RecruiterDashboard'
import RecruiterCandidates from './components/recruiter/RecruiterCandidates'
import CandidateDetail from './components/recruiter/CandidateDetail'
import RecruiterAnalytics from './components/recruiter/RecruiterAnalytics'
import RecruiterJobs from './components/recruiter/RecruiterJobs'
import RecruiterSettings from './components/recruiter/RecruiterSettings'
import RecruiterAdminPanel from './components/recruiter/RecruiterAdminPanel'
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

  if (hash.startsWith('#/recruiter/candidates/')) {
    return 'recruiter-candidate'
  }

  if (hash.startsWith('#/recruiter/candidates')) {
    return 'recruiter-candidates'
  }

  if (hash.startsWith('#/recruiter/analytics')) {
    return 'recruiter-analytics'
  }

  if (hash.startsWith('#/recruiter/jobs')) {
    return 'recruiter-jobs'
  }

  if (hash.startsWith('#/recruiter/settings')) {
    return 'recruiter-settings'
  }

  if (hash.startsWith('#/recruiter')) {
    return 'recruiter-dashboard'
  }

  if (hash.startsWith('#/admin')) {
    return 'admin'
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
  const { isAuthenticated, isInitializing, logout, user } = useAuth()
  const [route, setRoute] = useState(getRoute())
  const [interviewToken, setInterviewToken] = useState(extractInterviewToken(window.location.hash || '#/'))
  const [interviewLinkState, setInterviewLinkState] = useState({ status: 'idle', error: '', context: null })
  const recruiterCandidateId = route === 'recruiter-candidate'
    ? window.location.hash.replace('#/recruiter/candidates/', '').trim()
    : null

  const protectedRoutes = new Set(['apply', 'dashboard', 'reports', 'analytics'])
  const recruiterRoutes = new Set([
    'recruiter-dashboard',
    'recruiter-candidates',
    'recruiter-candidate',
    'recruiter-analytics',
    'recruiter-jobs',
    'recruiter-settings',
  ])

  useEffect(() => {
    function handleHashChange() {
      setRoute(getRoute())
      setInterviewToken(extractInterviewToken(window.location.hash || '#/'))
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

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
      window.location.hash = cleanedTarget === '/interview' ? '/' : cleanedTarget
      return
    }

    window.location.hash = '/'
    setRoute('landing')
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
      localStorage.setItem('auth-redirect', window.location.hash || '#/')
      setRoute('login')
      window.location.hash = '/login'
    }

    if (recruiterRoutes.has(route) && !isAuthenticated) {
      localStorage.setItem('auth-redirect', window.location.hash || '#/')
      setRoute('login')
      window.location.hash = '/login'
    }
  }, [route, isAuthenticated, isInitializing])

  if (route === 'interview') {
    return (
      <ProtectedPlaceholder
        title="Interview link required"
        description="This interview can only be started from a valid invitation link. Please use the link sent to your email."
        onBackHome={openLandingPage}
      />
    )
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
      return <InterviewPage interviewContext={interviewLinkState.context} interviewToken={interviewToken} />
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
    if (user?.role && user.role !== 'USER') {
      return (
        <ProtectedPlaceholder
          title="Candidate dashboard only"
          description="This dashboard is available for candidate accounts."
          onBackHome={openLandingPage}
        />
      )
    }

    return (
      <ProtectedPlaceholder
        title="Interview Dashboard"
        description="Your AI interview control room is ready. Sign in to review sessions, manage pipelines, and launch new interviews."
        onBackHome={openLandingPage}
      />
    )
  }

  if (route === 'reports') {
    if (user?.role && user.role !== 'USER') {
      return (
        <ProtectedPlaceholder
          title="Candidate reports only"
          description="Reports are available for candidate accounts."
          onBackHome={openLandingPage}
        />
      )
    }

    return (
      <ProtectedPlaceholder
        title="Performance Reports"
        description="Sign in to access deep performance breakdowns, rubric scores, and candidate insights."
        onBackHome={openLandingPage}
      />
    )
  }

  if (route === 'analytics') {
    if (user?.role && user.role !== 'USER') {
      return (
        <ProtectedPlaceholder
          title="Candidate analytics only"
          description="Analytics are available for candidate accounts."
          onBackHome={openLandingPage}
        />
      )
    }

    return (
      <ProtectedPlaceholder
        title="Analytics & History"
        description="Track interview history, proctoring events, and AI analytics once you're authenticated."
        onBackHome={openLandingPage}
      />
    )
  }

  if (recruiterRoutes.has(route)) {
    if (!isAuthenticated) {
      return (
        <ProtectedPlaceholder
          title="Sign in required"
          description="Please sign in to access recruiter dashboards."
          onBackHome={openLandingPage}
        />
      )
    }

    if (!['RECRUITER', 'ADMIN'].includes(user?.role)) {
      return (
        <ProtectedPlaceholder
          title="Recruiter access only"
          description="Your account does not have recruiter permissions."
          onBackHome={openLandingPage}
        />
      )
    }

    if (route === 'recruiter-dashboard') {
      return <RecruiterDashboard />
    }

    if (route === 'recruiter-candidates') {
      return <RecruiterCandidates />
    }

    if (route === 'recruiter-candidate') {
      if (!recruiterCandidateId) {
        return (
          <ProtectedPlaceholder
            title="Candidate not found"
            description="Select a candidate from the pipeline to view details."
            onBackHome={openLandingPage}
          />
        )
      }

      return <CandidateDetail candidateId={recruiterCandidateId} />
    }

    if (route === 'recruiter-analytics') {
      return <RecruiterAnalytics />
    }

    if (route === 'recruiter-jobs') {
      return <RecruiterJobs />
    }

    if (route === 'recruiter-settings') {
      return <RecruiterSettings />
    }
  }

  if (route === 'admin') {
    if (!isAuthenticated) {
      return (
        <ProtectedPlaceholder
          title="Sign in required"
          description="Please sign in to access admin controls."
          onBackHome={openLandingPage}
        />
      )
    }

    if (user?.role !== 'ADMIN') {
      return (
        <ProtectedPlaceholder
          title="Admin access only"
          description="Your account does not have admin permissions."
          onBackHome={openLandingPage}
        />
      )
    }

    return <RecruiterAdminPanel />
  }

  return (
    <LandingPage onOpenLogin={openLoginPage} onOpenApply={openApplyPage} />
  )
}

export default App
