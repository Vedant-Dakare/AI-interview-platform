function InterviewHeader() {
  function handleLogoClick() {
    window.location.hash = '/'
  }

  return (
    <header className="interview-header">
      <div className="header-left">
        <span onClick={handleLogoClick} className="logo">IntervueAI</span>
        <div className="header-divider" />
        <div className="time-left">
          <span className="material-symbols-outlined">schedule</span>
          <span>Time Remaining: 14:02</span>
        </div>
      </div>

      <div className="header-center">
        <div className="question-pill">
          <span>QUESTION 3/10</span>
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
        <button type="button" className="finish-btn">
          Finish Session
        </button>
      </div>
    </header>
  )
}

export default InterviewHeader
