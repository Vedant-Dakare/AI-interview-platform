function VisualBars({ large = false }) {
  if (large) {
    return (
      <div className="live-waveform-large">
        <div className="b h1" />
        <div className="b h2" />
        <div className="b h3" />
        <div className="b h4" />
        <div className="b h5" />
        <div className="b h6" />
        <div className="b h7" />
        <div className="b h8" />
        <div className="b h9" />
        <div className="b h10" />
        <div className="b h11" />
        <div className="b h12" />
        <div className="b h13" />
      </div>
    )
  }

  return (
    <div className="visualizer-bars">
      <div className="v v1" />
      <div className="v v2" />
      <div className="v v3" />
      <div className="v v4" />
      <div className="v v5" />
    </div>
  )
}

function InterviewWorkspace() {
  return (
    <section className="interview-workspace">
      <div className="ai-visual-wrap">
        <div className="ai-visual-core ai-pulse">
          <div className="ai-visual-inner">
            <VisualBars />
          </div>
        </div>
        <div className="ai-environment-glow" />
      </div>

      <div className="question-block">
        <h2>Interviewer is listening</h2>
        {/* <h1>
          "Can you describe a situation where you had to manage technical debt
          while delivering a high-priority feature? How did you prioritize?"
        </h1> */}
      </div>

      <div className="interaction-zone">
        <div className="interaction-card">
          <VisualBars large />
          <div className="interaction-divider" />
          <div className="listening-tag">
            <span className="ping-dot" />
            <span>Listening...</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default InterviewWorkspace
