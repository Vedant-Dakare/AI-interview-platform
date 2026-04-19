import CameraPreview from './CameraPreview'

function ProgressPanel({ currentQuestionIndex, totalQuestions, mediaStream }) {
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
            <CameraPreview mediaStream={mediaStream} inline={true} />
            <div className="live-label">Live: You</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default ProgressPanel
