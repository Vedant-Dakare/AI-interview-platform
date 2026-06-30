function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="brand">IntervueAI</span>
          <p>Intelligent Engineering Recruitment for modern teams.</p>
          <div className="footer-social">
            <a href="#" aria-label="LinkedIn">
              <span className="material-symbols-outlined">public</span>
            </a>
            <a href="#" aria-label="Twitter">
              <span className="material-symbols-outlined">tag</span>
            </a>
            <a href="#" aria-label="YouTube">
              <span className="material-symbols-outlined">smart_display</span>
            </a>
          </div>
        </div>

        <div className="footer-columns">
          <div className="footer-col">
            <h4>Platform</h4>
            <a href="#">Features</a>
            <a href="#">Security</a>
            <a href="#">Integrations</a>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <a href="#">About</a>
            <a href="#">Careers</a>
            <a href="#">Contact</a>
          </div>
          <div className="footer-col">
            <h4>Resources</h4>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Status</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 IntervueAI. All rights reserved.</span>
      </div>
    </footer>
  )
}

export default SiteFooter
