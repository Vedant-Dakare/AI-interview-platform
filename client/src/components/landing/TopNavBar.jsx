import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import MouseParallaxLayer from './motion/MouseParallaxLayer'

const THEME_STORAGE_KEY = 'intervueai-theme'

function TopNavBar({ onSignIn }) {
  const { user, isAuthenticated, logout } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const profileRef = useRef(null)
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

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false)
      }
    }

    if (isProfileOpen) {
      window.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isProfileOpen])

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  return (
    <nav className="top-nav">
      <MouseParallaxLayer className="nav-parallax" strength={0.3} maxOffset={5}>
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
            {!isAuthenticated ? (
              <button type="button" className="btn-text" onClick={onSignIn}>
                Sign In
              </button>
            ) : (
              <div className="user-menu" ref={profileRef}>
                <button
                  type="button"
                  className="user-trigger"
                  onClick={() => setIsProfileOpen((current) => !current)}
                >
                  <span className="user-avatar">
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user?.name || 'User'} />
                    ) : (
                      <span className="material-symbols-outlined">person</span>
                    )}
                  </span>
                  <span className="user-name">{user?.name || 'Account'}</span>
                  <span className="material-symbols-outlined">expand_more</span>
                </button>
                <div className={`user-dropdown ${isProfileOpen ? 'open' : ''}`}>
                  <div>
                    <strong>{user?.name || 'IntervueAI Member'}</strong>
                    <span>{user?.email || 'AI Interview Suite'}</span>
                  </div>
                  <button type="button" onClick={() => (window.location.hash = '/dashboard')}>
                    <span className="material-symbols-outlined">dashboard</span>
                    Dashboard
                  </button>
                  <button type="button" onClick={() => (window.location.hash = '/reports')}>
                    <span className="material-symbols-outlined">query_stats</span>
                    Reports
                  </button>
                  <button type="button" onClick={() => (window.location.hash = '/analytics')}>
                    <span className="material-symbols-outlined">insights</span>
                    Analytics
                  </button>
                  <button
                    type="button"
                    className="logout"
                    onClick={() => {
                      logout()
                      window.location.hash = '/login'
                    }}
                  >
                    <span className="material-symbols-outlined">logout</span>
                    Log out
                  </button>
                </div>
              </div>
            )}
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
      </MouseParallaxLayer>

      <div className={`mobile-panel ${isMenuOpen ? 'open' : ''}`}>
        <div className="mobile-links">
          <a href="#">Features</a>
          <a href="#">Pricing</a>
          <a href="#">Enterprise</a>
        </div>
        <div className="mobile-actions">
          {!isAuthenticated ? (
            <button type="button" className="btn-text" onClick={onSignIn}>
              Sign In
            </button>
          ) : null}
        </div>
      </div>
    </nav>
  )
}

export default TopNavBar