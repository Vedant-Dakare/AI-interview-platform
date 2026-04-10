import { useState } from 'react'
import InterviewHeader from './InterviewHeader'
import InterviewWorkspace from './InterviewWorkspace'
import ProgressPanel from './ProgressPanel'

function InterviewPage() {
  const [hasAcceptedChecklist, setHasAcceptedChecklist] = useState(false)
  const [hasStartedInterview, setHasStartedInterview] = useState(false)

  function handleStartInterview() {
    if (!hasAcceptedChecklist) {
      return
    }

    setHasStartedInterview(true)
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

  return (
    <div className="interview-page">
      <InterviewHeader />
      <main className="interview-main">
        <InterviewWorkspace />
        <ProgressPanel />
      </main>
    </div>
  )
}

export default InterviewPage
