function TopNavBar({ onGetDemo, onSignIn }) {
  const isLoggedIn = Boolean(localStorage.getItem('intervueai-token'))

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
          {!isLoggedIn ? (
            <button type="button" className="btn-text" onClick={onSignIn}>
              Sign In
            </button>
          ) : null}
          <button type="button" className="btn-primary-sm" onClick={onGetDemo}>
            Get Demo
          </button>
        </div>
      </div>
    </nav>
  )
}

export default TopNavBar
