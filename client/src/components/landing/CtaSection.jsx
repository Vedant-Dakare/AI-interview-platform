function CtaSection({ onRequestAccess }) {
  return (
    <section className="cta-section">
      <div className="cta-card">
        <div className="cta-overlay" aria-hidden="true" />
        <div className="cta-glow" aria-hidden="true" />
        <div className="cta-content">
          <span className="section-eyebrow">Enterprise ready</span>
          <h2>
            Ready to scale your <br />
            engineering team?
          </h2>
          <p>
            Join 200+ companies automating their technical pipeline with IntervueAI.
          </p>
          <div className="cta-actions">
            <button type="button" className="cta-primary" onClick={onRequestAccess}>
              Request Access
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default CtaSection
