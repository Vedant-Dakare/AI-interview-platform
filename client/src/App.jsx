import { useEffect, useState } from 'react'
import './App.css'
import './InterviewPage.css'
import LandingPage from './components/landing/LandingPage'
import InterviewPage from './components/interview/InterviewPage'
import AuthPage from './components/auth/AuthPage'

function getRoute() {
  const hash = window.location.hash || '#/'

  if (hash === '#/interview') {
    return 'interview'
  }

  if (hash === '#/login') {
    return 'login'
  }

  if (hash === '#/signup') {
    return 'signup'
  }

  return 'landing'
}

function App() {
  const [route, setRoute] = useState(getRoute)

  useEffect(() => {
    function handleHashChange() {
      setRoute(getRoute())
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  function openInterviewPage() {
    window.location.hash = '/interview'
    setRoute('interview')
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

  if (route === 'interview') {
    return <InterviewPage />
  }

  if (route === 'login') {
    return (
      <AuthPage
        mode="login"
        onSuccess={openInterviewPage}
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

  return (
    <LandingPage
      onOpenInterview={openInterviewPage}
      onOpenLogin={openLoginPage}
    />
  )
}

export default App
