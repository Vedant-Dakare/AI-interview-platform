function HeroSection() {
  return (
    <section className="hero-section">
      <div className="hero-bg-orb hero-bg-orb-one" />
      <div className="hero-bg-orb hero-bg-orb-two" />

      <div className="hero-grid">
        <div className="hero-content">
          <div className="beta-pill">
            <span className="pulse-dot" />
            <span>Now in Enterprise Beta</span>
          </div>

          <h1>
            AI-Powered <br />
            Technical Interviews <br />
            <span className="gradient-text">at Scale</span>
          </h1>

          <p>
            Automate your first-round technical screenings with human-like voice AI.
            Real-time adaptive questioning, intelligent evaluation, and zero-bias
            proctoring.
          </p>

          <div className="hero-actions">
            <button type="button" className="btn-hero-primary">
              Start Interview
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
            <button type="button" className="btn-hero-secondary">
              For Recruiters
            </button>
          </div>

          <div className="trusted-row">
            <span>Trusted by</span>
            <div className="trusted-brands">
              <span>TECHNOVA</span>
              <span>STREAMLY</span>
              <span>VORTEX</span>
            </div>
          </div>
        </div>

        <div className="hero-visual-wrap">
          <div className="hero-visual-card">
            <div className="hero-visual-glow" />

            <div className="hero-visual-content">
              <div className="mic-circle">
                <div className="mic-ring" />
                <div className="mic-core">
                  <span className="material-symbols-outlined mic-icon">mic</span>
                </div>
                <div className="mic-status">AI ANALYZING RESPONSE...</div>
              </div>

              <div className="progress-stack">
                <div className="progress-line"><div className="progress-fill p1" /></div>
                <div className="progress-line"><div className="progress-fill p2" /></div>
                <div className="progress-line"><div className="progress-fill p3" /></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
