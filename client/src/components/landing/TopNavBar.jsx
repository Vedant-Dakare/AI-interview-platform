import { useEffect, useState } from 'react'
import { getAuthToken } from '../../services/authApi'

const THEME_STORAGE_KEY = 'intervueai-theme'

function TopNavBar({ onGetDemo, onSignIn }) {
  const isLoggedIn = Boolean(getAuthToken())
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    const initialTheme = storedTheme || 'dark'
    setTheme(initialTheme)
    document.documentElement.setAttribute('data-theme', initialTheme)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

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
          {/* <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            <span className="material-symbols-outlined">
              {theme === 'dark' ? 'dark_mode' : 'light_mode'}
            </span>
          </button> */}
          {!isLoggedIn ? (
            <button type="button" className="btn-text" onClick={onSignIn}>
              Sign In
            </button>
          ) : null}
          <button type="button" className="btn-primary-sm" onClick={onGetDemo}>
            Get Demo
          </button>
          <button
            type="button"
            className="menu-toggle"
            aria-label="Toggle navigation"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            <span className="material-symbols-outlined">
              {isMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      <div className={`mobile-panel ${isMenuOpen ? 'open' : ''}`}>
        <div className="mobile-links">
          <a href="#">Features</a>
          <a href="#">Pricing</a>
          <a href="#">Enterprise</a>
        </div>
        <div className="mobile-actions">
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