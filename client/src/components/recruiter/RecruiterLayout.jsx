import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Overview', hash: '#/recruiter/dashboard', icon: 'space_dashboard' },
  { key: 'candidates', label: 'Candidates', hash: '#/recruiter/candidates', icon: 'group' },
  { key: 'analytics', label: 'Analytics', hash: '#/recruiter/analytics', icon: 'analytics' },
  { key: 'jobs', label: 'Interviews', hash: '#/recruiter/jobs', icon: 'work' },
  { key: 'settings', label: 'Settings', hash: '#/recruiter/settings', icon: 'tune' },
]

function RecruiterLayout({ title, subtitle, children }) {
  const { user } = useAuth()
  const [active, setActive] = useState('dashboard')

  useEffect(() => {
    const update = () => {
      const hash = window.location.hash
      const match = NAV_ITEMS.find((item) => hash.startsWith(item.hash))
      setActive(match?.key || 'dashboard')
    }

    update()
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  return (
    <div className="recruiter-shell">
      <aside className="recruiter-sidebar">
        <div className="recruiter-brand">
          <span className="brand">IntervueAI</span>
          <span className="recruiter-role">Recruiter Suite</span>
        </div>
        <nav className="recruiter-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`recruiter-nav-item ${active === item.key ? 'active' : ''}`}
              onClick={() => {
                window.location.hash = item.hash.replace('#', '')
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="recruiter-user">
          <div className="recruiter-avatar">
            {user?.avatarUrl ? <img src={user.avatarUrl} alt={user?.name || 'User'} /> : <span>{user?.name?.[0] || 'R'}</span>}
          </div>
          <div>
            <strong>{user?.name || 'Recruiter'}</strong>
            <span>{user?.email || 'IntervueAI Recruiter'}</span>
          </div>
        </div>
      </aside>
      <section className="recruiter-main">
        <header className="recruiter-header">
          <div>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className="recruiter-header-actions">
            <button type="button" className="btn-primary-sm" onClick={() => (window.location.hash = '/recruiter/candidates')}
            >
              View pipeline
            </button>
          </div>
        </header>
        <div className="recruiter-content">{children}</div>
      </section>
    </div>
  )
}

export default RecruiterLayout
