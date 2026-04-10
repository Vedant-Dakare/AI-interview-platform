function CtaSection({ onViewDemo }) {
  return (
    <section className="cta-section">
      <div className="cta-card">
        <div className="cta-overlay" />
        <div className="cta-content">
          <h2>
            Ready to scale your <br />
            engineering team?
          </h2>
          <p>
            Join 200+ companies automating their technical pipeline with IntervueAI.
          </p>
          <div className="cta-actions">
            <button type="button" className="cta-primary">
              Request Access
            </button>
            <button type="button" className="cta-secondary" onClick={onViewDemo}>
              View Demo
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default CtaSection
