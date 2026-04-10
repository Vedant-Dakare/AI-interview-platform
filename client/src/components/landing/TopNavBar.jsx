function TopNavBar({ onGetDemo, onSignIn }) {
  return (
    <nav className="top-nav">
      <div className="top-nav-inner">
        <div className="brand-row">
          <span className="brand">IntervueAI</span>
          <div className="desktop-links">
            <a href="#">Features</a>
            <a href="#">Pricing</a>
            <a href="#">Enterprise</a>
          </div>
        </div>

        <div className="nav-actions">
          <button type="button" className="btn-text" onClick={onSignIn}>
            Sign In
          </button>
          <button type="button" className="btn-primary-sm" onClick={onGetDemo}>
            Get Demo
          </button>
        </div>
      </div>
    </nav>
  )
}

export default TopNavBar
