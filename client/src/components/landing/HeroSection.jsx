function HeroSection() {
  return (
    <section className="hero-section">
      <div className="hero-ambient" aria-hidden="true">
        <div className="hero-bg-orb hero-bg-orb-one" />
        <div className="hero-bg-orb hero-bg-orb-two" />
        <div className="hero-bg-orb hero-bg-orb-three" />
        <div className="hero-grid-overlay" />
      </div>

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
            <button type="button" className="btn-hero-secondary">
              For Recruiters
            </button>
          </div>

          <div className="hero-stats">
            <div className="stat-card">
              <span className="stat-label">Average time saved</span>
              <strong>12.4 hrs</strong>
              <span className="stat-note">per hiring loop</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Bias reduction</span>
              <strong>94%</strong>
              <span className="stat-note">consistent scoring</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Candidate NPS</span>
              <strong>+68</strong>
              <span className="stat-note">top-tier UX</span>
            </div>
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
            <div className="hero-visual-grain" />

            <div className="hero-visual-content">
              <div className="ai-orbit">
                <div className="ai-ring ring-outer" />
                <div className="ai-ring ring-mid" />
                <div className="ai-ring ring-inner" />
                <div className="ai-core">
                  <span className="material-symbols-outlined">graphic_eq</span>
                </div>
                <div className="ai-status">AI ANALYZING RESPONSE...</div>
              </div>

              <div className="signal-stack">
                <div className="signal-row">
                  <span>Speech cadence</span>
                  <div className="signal-track"><div className="signal-fill s1" /></div>
                </div>
                <div className="signal-row">
                  <span>Technical depth</span>
                  <div className="signal-track"><div className="signal-fill s2" /></div>
                </div>
                <div className="signal-row">
                  <span>Confidence score</span>
                  <div className="signal-track"><div className="signal-fill s3" /></div>
                </div>
              </div>

              <div className="waveform">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
