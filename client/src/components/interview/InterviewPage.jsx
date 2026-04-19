import { useEffect, useState } from 'react'
import InterviewHeader from './InterviewHeader'
import InterviewWorkspace from './InterviewWorkspace'
import ProgressPanel from './ProgressPanel'
import ProctoringWarnings from './ProctoringWarnings'
import { startInterview, getInterview } from '../../services/interviewApi'
import ProctoringManager from '../../services/ProctoringManager'

function InterviewPage({ interviewContext }) {
  const [hasAcceptedChecklist, setHasAcceptedChecklist] = useState(false)
  const [hasStartedInterview, setHasStartedInterview] = useState(false)
  const [permissionError, setPermissionError] = useState(null)
  const [proctorState, setProctoredState] = useState({
    manager: null,
    mediaStream: null,
    warningCount: 0,
    isTerminated: false,
    terminationReason: '',
  })
  const [interviewState, setInterviewState] = useState({
    interviewId: null,
    role: interviewContext?.role || 'Backend Engineer',
    status: 'loading',
    currentQuestionIndex: 0,
    questions: [],
    answers: [],
    totalQuestions: 0,
    error: null,
  })
  const [timeRemaining, setTimeRemaining] = useState(900) // 15 minutes in seconds

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (proctorState.manager) {
        proctorState.manager.stopMonitoring()
      }
      // Stop all camera tracks on unmount
      if (proctorState.mediaStream) {
        proctorState.mediaStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // Stop camera when interview is terminated
  useEffect(() => {
    if (proctorState.isTerminated && proctorState.mediaStream) {
      console.log('[InterviewPage] Stopping camera due to interview termination')
      proctorState.mediaStream.getTracks().forEach((track) => {
        track.stop()
        console.log(`[InterviewPage] Stopped ${track.kind} track`)
      })
      
      // Also stop monitoring
      if (proctorState.manager) {
        proctorState.manager.stopMonitoring()
      }
    }
  }, [proctorState.isTerminated])

  // Stop camera when interview is completed normally
  useEffect(() => {
    if (interviewState.status === 'completed' && proctorState.mediaStream) {
      console.log('[InterviewPage] Stopping camera due to interview completion')
      proctorState.mediaStream.getTracks().forEach((track) => {
        track.stop()
        console.log(`[InterviewPage] Stopped ${track.kind} track`)
      })
      
      // Also stop monitoring
      if (proctorState.manager) {
        proctorState.manager.stopMonitoring()
      }
    }
  }, [interviewState.status])

  // Timer countdown
  useEffect(() => {
    if (!hasStartedInterview || interviewState.status === 'completed') {
      return
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 0) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [hasStartedInterview, interviewState.status])

  // Start interview on button click
  async function handleStartInterview() {
    if (!hasAcceptedChecklist) {
      return
    }

    setPermissionError(null)
    setHasStartedInterview(true)
    setInterviewState((prev) => ({ ...prev, status: 'loading' }))

    try {
      // Step 1: Start interview backend
      const response = await startInterview(interviewState.role)
      const { data } = response
      const interviewId = data.interviewId

      setInterviewState((prev) => ({
        ...prev,
        interviewId,
        role: data.role,
        status: data.status,
        currentQuestionIndex: data.currentQuestionIndex,
        totalQuestions: data.totalQuestions,
        questions: data.currentQuestion ? [data.currentQuestion] : [],
      }))

      // Step 2: Initialize proctoring
      try {
        const manager = new ProctoringManager(
          interviewId,
          // onWarningUpdate callback
          (warningCount) => {
            setProctoredState((prev) => ({
              ...prev,
              warningCount,
            }))
          },
          // onTerminated callback
          (reason) => {
            setProctoredState((prev) => ({
              ...prev,
              isTerminated: true,
              terminationReason: reason,
            }))
            setInterviewState((prev) => ({
              ...prev,
              status: 'terminated',
            }))
          }
        )

        await manager.init()

        setProctoredState((prev) => ({
          ...prev,
          manager,
          mediaStream: manager.getVideoStream(),
        }))

        console.log('[InterviewPage] Proctoring initialized successfully')
      } catch (error) {
        setPermissionError(error.message)
        setHasStartedInterview(false)
        setInterviewState((prev) => ({
          ...prev,
          status: 'idle',
        }))
        throw error
      }
    } catch (error) {
      console.error('[InterviewPage] Error starting interview:', error.message)
      setInterviewState((prev) => ({
        ...prev,
        status: 'error',
        error: error.message,
      }))
    }
  }

  if (!hasStartedInterview) {
    return (
      <div className="interview-page precheck-page">
        <section className="precheck-card">
          <span className="precheck-badge">Before You Start</span>
          <h1>Interview Readiness Checklist</h1>
          <p>
            Review these rules before continuing. This session may be monitored for fairness and quality.
          </p>

          {permissionError && (
            <div className="permission-error">
              <span className="material-symbols-outlined">error</span>
              <div>
                <h3>Access Required</h3>
                <p>{permissionError}</p>
              </div>
            </div>
          )}

          {interviewState.role ? (
            <p className="precheck-role-note">
              Role: <strong>{String(interviewState.role).toUpperCase()}</strong>
            </p>
          ) : null}

          <ul className="precheck-list">
            <li>
              <span className="material-symbols-outlined">tab</span>
              <div>
                <h3>Do not switch tabs or windows</h3>
                <p>Tab switching can pause or terminate the interview session.</p>
              </div>
            </li>
            <li>
              <span className="material-symbols-outlined">videocam</span>
              <div>
                <h3>Keep camera enabled and stable</h3>
                <p>Ensure your face is visible in a well-lit environment.</p>
              </div>
            </li>
            <li>
              <span className="material-symbols-outlined">mic</span>
              <div>
                <h3>Use a working microphone</h3>
                <p>Test mic input and reduce background noise before starting.</p>
              </div>
            </li>
            <li>
              <span className="material-symbols-outlined">wifi</span>
              <div>
                <h3>Maintain strong internet connection</h3>
                <p>Use reliable Wi-Fi or wired internet to avoid disruptions.</p>
              </div>
            </li>
          </ul>

          <label className="precheck-confirm">
            <input
              type="checkbox"
              checked={hasAcceptedChecklist}
              onChange={(event) => setHasAcceptedChecklist(event.target.checked)}
            />
            <span>I understand and agree to follow these interview rules.</span>
          </label>

          <button
            type="button"
            className="precheck-start-btn"
            onClick={handleStartInterview}
            disabled={!hasAcceptedChecklist}
          >
            Start Interview
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </section>
      </div>
    )
  }

  if (interviewState.status === 'terminated' || proctorState.isTerminated) {
    return (
      <div className="interview-page precheck-page">
        <ProctoringWarnings
          warningCount={5}
          isTerminated={true}
          terminationReason={proctorState.terminationReason || interviewState.error || 'Interview was terminated'}
        />
      </div>
    )
  }

  if (interviewState.status === 'error') {
    return (
      <div className="interview-page precheck-page">
        <section className="precheck-card">
          <h2>Error Starting Interview</h2>
          <p>{interviewState.error}</p>
          <button
            type="button"
            className="btn-primary-sm"
            onClick={() => window.location.hash = '/'}
          >
            Back to Home
          </button>
        </section>
      </div>
    )
  }

  if (interviewState.status === 'loading') {
    return (
      <div className="interview-page precheck-page">
        <section className="precheck-card">
          <h2>Starting your interview...</h2>
          <p>Please wait while we load your questions.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="interview-page">
      <ProctoringWarnings
        warningCount={proctorState.warningCount}
        isTerminated={proctorState.isTerminated}
        terminationReason={proctorState.terminationReason}
      />
      <InterviewHeader
        role={interviewState.role}
        currentQuestion={interviewState.currentQuestionIndex + 1}
        totalQuestions={interviewState.totalQuestions}
        timeRemaining={timeRemaining}
        interviewId={interviewState.interviewId}
        onFinish={() => setInterviewState((prev) => ({ ...prev, status: 'completed' }))}
      />
      <main className="interview-main">
        <InterviewWorkspace
          interviewId={interviewState.interviewId}
          question={interviewState.questions[0] || 'Loading question...'}
          currentQuestionIndex={interviewState.currentQuestionIndex}
          totalQuestions={interviewState.totalQuestions}
          onAnswerSubmitted={() => {
            setInterviewState((prev) => ({
              ...prev,
              currentQuestionIndex: prev.currentQuestionIndex + 1,
            }))
          }}
        />
        <ProgressPanel
          currentQuestionIndex={interviewState.currentQuestionIndex}
          totalQuestions={interviewState.totalQuestions}
          mediaStream={proctorState.mediaStream}
        />
      </main>
    </div>
  )
}

export default InterviewPage
