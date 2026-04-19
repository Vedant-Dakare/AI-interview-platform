import { endInterview } from '../../services/interviewApi'

function InterviewHeader({ role, currentQuestion, totalQuestions, timeRemaining, interviewId, onFinish }) {
  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  async function handleFinishSession() {
    if (window.confirm('Are you sure you want to end the interview? Your answers will be saved.')) {
      try {
        await endInterview(interviewId)
        onFinish?.()
        window.location.hash = '/'
      } catch (error) {
        alert('Error ending interview: ' + error.message)
      }
    }
  }

  return (
    <header className="interview-header">
      <div className="header-left">
        <span onClick={() => window.location.hash = '/'} className="logo">IntervueAI</span>
        <div className="header-divider" />
        <div className="time-left">
          <span className="material-symbols-outlined">schedule</span>
          <span>Time Remaining: {timeDisplay}</span>
        </div>
      </div>

      <div className="header-center">
        <div className="question-pill">
          <span>QUESTION {currentQuestion}/{totalQuestions}</span>
        </div>
        <div className="strict-pill">
          <span className="material-symbols-outlined fill">warning</span>
          <span>Strict Mode Active</span>
        </div>
      </div>

      <div className="header-right">
        <button type="button" className="support-btn">
          Support
        </button>
        <button type="button" className="finish-btn" onClick={handleFinishSession}>
          Finish Session
        </button>
      </div>
    </header>
  )
}

export default InterviewHeader
