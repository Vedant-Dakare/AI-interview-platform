import { useEffect, useState } from 'react'
import './App.css'
import './InterviewPage.css'
import LandingPage from './components/landing/LandingPage'
import InterviewPage from './components/interview/InterviewPage'
import AuthPage from './components/auth/AuthPage'
import CandidateApplyPage from './components/apply/CandidateApplyPage'
import { startInterviewWithToken, validateInterviewToken } from './services/interviewLinkApi'

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

  if (hash === '#/login') {
    return 'login'
  }

  if (hash === '#/signup') {
    return 'signup'
  }

  if (hash === '#/apply') {
    return 'apply'
  }

  return 'landing'
}

function App() {
  const [route, setRoute] = useState(getRoute())
  const [interviewToken, setInterviewToken] = useState(extractInterviewToken(window.location.hash || '#/'))
  const [interviewLinkState, setInterviewLinkState] = useState({ status: 'idle', error: '', context: null })

  useEffect(() => {
    function handleHashChange() {
      setRoute(getRoute())
      setInterviewToken(extractInterviewToken(window.location.hash || '#/'))
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  function openInterviewPage() {
    window.location.hash = '/interview'
    setRoute('interview')
  }

  function openApplyPage() {
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

  useEffect(() => {
    if (route !== 'interview-link' || !interviewToken) {
      setInterviewLinkState({ status: 'idle', error: '', context: null })
      return
    }

    const userToken = localStorage.getItem('intervueai-token')
    if (!userToken) {
      // Not logged in - redirect to login and store pending token
      localStorage.setItem('pending-interview-token', interviewToken)
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

        // If authorization fails, clear token and redirect to login
        if (error.message.includes('Unauthorized') || error.message.includes('invalid token')) {
          localStorage.removeItem('intervueai-token')
          localStorage.removeItem('intervueai-user')
          localStorage.setItem('pending-interview-token', interviewToken)
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
        onSuccess={() => {
          const pendingToken = localStorage.getItem('pending-interview-token')

          if (pendingToken) {
            // Redirect back to interview link - this will trigger the interview-link useEffect
            window.location.hash = `/interview/${pendingToken}`
            return
          }

          // No pending interview - go to interview page
          openInterviewPage()
        }}
        onSwitchToSignup={openSignUpPage}
        onBackHome={openLandingPage}
      />
    )
  }

  if (route === 'signup') {
    return (
      <AuthPage
        mode="signup"
        onSuccess={openInterviewPage}
        onSwitchToLogin={openLoginPage}
        onBackHome={openLandingPage}
      />
    )
  }

  if (route === 'apply') {
    return <CandidateApplyPage onBackHome={openLandingPage} />
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
