function ProgressPanel({ currentQuestionIndex, totalQuestions }) {
  // Generate dynamic progress steps
  const steps = Array.from({ length: totalQuestions }, (_, i) => ({
    id: i + 1,
    title: `Question ${i + 1}`,
    state: i < currentQuestionIndex ? 'done' : i === currentQuestionIndex ? 'active' : 'future',
    status: i < currentQuestionIndex ? 'Completed' : i === currentQuestionIndex ? 'Current Question' : 'Upcoming',
  }))

  function ProgressStep({ step }) {
    if (step.state === 'done') {
      return (
        <div className="progress-step done">
          <div className="step-dot done-dot">
            <span className="material-symbols-outlined">check</span>
          </div>
          <div className="step-content">
            <p className="step-title">{step.title}</p>
            <p className="step-subtitle">{step.status}</p>
          </div>
        </div>
      )
    }

    if (step.state === 'active') {
      return (
        <div className="progress-step active">
          <div className="step-dot active-dot">
            <span>{step.id}</span>
          </div>
          <div className="step-content">
            <p className="step-title active-text">{step.title}</p>
            <p className="step-subtitle active-sub">{step.status}</p>
          </div>
        </div>
      )
    }

    return (
      <div className="progress-step future">
        <div className="step-dot future-dot">
          <span>{step.id}</span>
        </div>
        <div className="step-content">
          <p className="step-title">{step.title}</p>
        </div>
      </div>
    )
  }

  return (
    <aside className="progress-panel">
      <h3>Interview Progress</h3>

      <div className="steps-wrap">
        <div className="steps-line" />
        {steps.map((step) => (
          <ProgressStep key={step.id} step={step} />
        ))}
      </div>

      <div className="camera-block-wrap">
        <div className="camera-block">
          <div className="camera-head">
            <span>Camera Status</span>
            <span className="camera-live-dot" />
          </div>

          <div className="camera-frame">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDV50wicWCuACfiOnRByYW429xqEAZMAp5ZGrOK_qHhYdWddSo_Kx23tgfpGEIFo2Mrn2QnlgatH4HtjRD0-J_31_iOaQ3ojVCwRKz9e1Ch55KDGf1vMc1CEbrftxBFJHeBujEZbKzM_lY_G_4WFevzrsgXXN0j0-memfHpqrccB1HubFMkYLTS8Vs_OdKWe2QQ4gFx9Y_fYxCaApdFa7NrsN4J40h0R2CEvirUybP3myfytF0DqAyLl-Jpxvrc3Bhi4paiQY5o0w"
              alt="Self View"
            />
            <div className="live-label">Live: You</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default ProgressPanel
