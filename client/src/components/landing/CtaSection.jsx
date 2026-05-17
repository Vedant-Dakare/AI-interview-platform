import MagneticHover from './motion/MagneticHover'

function CtaSection({ onRequestAccess }) {
  return (
    <section className="cta-section">
      <MagneticHover block maxMove={6} maxRotate={0.8}>
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
              <MagneticHover>
                <button type="button" className="cta-primary" onClick={onRequestAccess}>
                  Request Access
                </button>
              </MagneticHover>
            </div>
          </div>
        </div>
      </MagneticHover>
    </section>
  )
}

export default CtaSection
