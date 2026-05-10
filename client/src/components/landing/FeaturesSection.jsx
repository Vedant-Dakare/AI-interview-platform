function FeaturesSection() {
  return (
    <section className="features-section">
      <div className="section-intro">
        <span className="section-eyebrow">Core platform</span>
        <h2>Reinventing the Screening Funnel</h2>
        <p>
          Skip the manual phone screens. Our AI handles the technical deep-dives so
          your engineers can focus on final rounds.
        </p>
      </div>

      <div className="bento-grid">
        <article className="card voice-card">
          <div className="card-glow" />
          <div className="voice-left">
            <div className="icon-box blue">
              <span className="material-symbols-outlined">record_voice_over</span>
            </div>
            <h3>Natural Voice Interaction</h3>
            <p>
              Our low-latency voice engine conducts interviews that feel human.
              Candidates speak naturally while the AI understands intent, tone, and
              technical depth.
            </p>
            <ul>
              <li>
                <span className="material-symbols-outlined">check_circle</span>
                Multi-language support
              </li>
              <li>
                <span className="material-symbols-outlined">check_circle</span>
                Sub-100ms response time
              </li>
            </ul>
          </div>

          <div className="voice-right">
            <div className="mini-chat-card">
              <div className="mini-chat-header">
                <div className="avatar" />
                <span>IntervueAI Specialist</span>
              </div>
              <p>
                "Explain how you would optimize a high-traffic SQL query that
                involves multiple joins and large datasets."
              </p>
            </div>
          </div>
        </article>

        <article className="card eval-card">
          <div className="card-glow" />
          <div className="icon-box indigo">
            <span className="material-symbols-outlined">psychology</span>
          </div>
          <h3>AI Evaluation</h3>
          <p>
            Instant, detailed scorecards based on code quality, problem-solving
            approach, and communication skills.
          </p>

          <div className="accuracy-wrap">
            <div className="accuracy-head">
              <span>System Accuracy</span>
              <strong>99.4%</strong>
            </div>
            <div className="accuracy-track">
              <div className="accuracy-fill" />
            </div>
          </div>
        </article>

        <article className="card adaptive-card">
          <div className="card-glow" />
          <div className="icon-box orange">
            <span className="material-symbols-outlined">schema</span>
          </div>
          <h3>Adaptive Flow</h3>
          <p>
            The AI dynamically adjusts difficulty based on candidate performance,
            ensuring a fair yet rigorous assessment of their true ceiling.
          </p>
        </article>

        <article className="card guard-card">
          <div className="card-glow" />
          <div className="guard-left">
            <h3>Integrity Guard</h3>
            <p>
              Multi-modal proctoring system detects screen sharing, unauthorized tabs,
              and AI-assisted cheating to maintain high recruitment standards.
            </p>
            <button type="button" className="learn-link">
              Learn about our proctoring
              <span className="material-symbols-outlined">arrow_right_alt</span>
            </button>
          </div>

          <div className="guard-right">
            <div className="security-panel">
              <span className="material-symbols-outlined security-icon">security</span>
              <div className="secure-indicator">
                <span className="red-dot" />
                <span>SECURE CHANNEL ACTIVE</span>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}

export default FeaturesSection
