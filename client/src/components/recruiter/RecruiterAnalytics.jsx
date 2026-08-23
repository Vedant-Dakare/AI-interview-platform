import { useQuery } from '@tanstack/react-query'
import RecruiterLayout from './RecruiterLayout'
import { getRecruiterDashboard } from '../../services/recruiterApi'

const FUNNEL_STEPS = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'invited', label: 'Invited' },
  { key: 'interviewing', label: 'Interviewing' },
  { key: 'completed', label: 'Completed' },
  { key: 'shortlisted', label: 'Shortlisted' },
]

const ROLE_LABELS = {
  backend: 'Backend',
  ml: 'ML',
  dsa: 'DSA',
}

function formatScore(score) {
  if (score === null || score === undefined) return '--'
  return `${Number(score).toFixed(1)}/10`
}

function AnalyticsSkeleton() {
  return (
    <>
      <div className="recruiter-grid">
        {[0, 1, 2].map((key) => (
          <div className="recruiter-card recruiter-skeleton" key={key} aria-hidden="true" />
        ))}
      </div>
      <div className="recruiter-panel">
        <div className="recruiter-skeleton" style={{ minHeight: '200px' }} />
      </div>
    </>
  )
}

function RecruiterAnalytics() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['recruiter-dashboard'],
    queryFn: getRecruiterDashboard,
  })

  const payload = data?.data
  const stats = payload?.stats || {}
  const funnel = payload?.applicationFunnel || {}
  const roleDistribution = payload?.roleDistribution || {}

  const submitted = funnel.submitted || 0
  const completed = stats.completedInterviews ?? funnel.completed ?? 0
  const shortlisted = funnel.shortlisted || 0
  const completionRate = submitted > 0 ? Math.round((completed / submitted) * 100) : null
  const shortlistRate = completed > 0 ? Math.round((shortlisted / completed) * 100) : null

  const maxRole = Math.max(1, ...Object.values(roleDistribution).map((value) => Number(value) || 0))

  return (
    <RecruiterLayout
      title="Recruiter Analytics"
      subtitle="Track AI score distribution, funnel velocity, and integrity signals."
    >
      {isLoading ? (
        <AnalyticsSkeleton />
      ) : isError ? (
        <div className="recruiter-panel recruiter-error">
          <h3>Could not load analytics</h3>
          <p>{error?.message || 'Something went wrong while loading analytics.'}</p>
        </div>
      ) : (
        <>
          <div className="recruiter-grid">
            <div className="recruiter-card">
              <h3>Average AI score</h3>
              <strong>{formatScore(stats.averageScore)}</strong>
              <span>Across completed interviews</span>
            </div>
            <div className="recruiter-card">
              <h3>Completion rate</h3>
              <strong>{completionRate === null ? '--' : `${completionRate}%`}</strong>
              <span>{completed} of {submitted} submissions</span>
            </div>
            <div className="recruiter-card">
              <h3>Shortlist rate</h3>
              <strong>{shortlistRate === null ? '--' : `${shortlistRate}%`}</strong>
              <span>{shortlisted} shortlisted</span>
            </div>
          </div>

          <div className="recruiter-analytics-grid">
            <div className="recruiter-panel">
              <div className="recruiter-panel-header">
                <h3>Candidate funnel</h3>
              </div>
              <div className="recruiter-funnel">
                {FUNNEL_STEPS.map((step) => {
                  const count = funnel[step.key] || (step.key === 'completed' ? completed : 0)
                  const maxCount = Math.max(1, ...FUNNEL_STEPS.map((item) => funnel[item.key] || 0))
                  return (
                    <div className="recruiter-funnel-step" key={step.key}>
                      <div className="recruiter-funnel-meta">
                        <span>{step.label}</span>
                        <strong>{count}</strong>
                      </div>
                      <div className="recruiter-funnel-bar">
                        <span style={{ width: `${Math.round((count / maxCount) * 100)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="recruiter-panel">
              <div className="recruiter-panel-header">
                <h3>Candidates by role</h3>
              </div>
              <div className="recruiter-funnel">
                {Object.keys(ROLE_LABELS).map((roleKey) => {
                  const count = roleDistribution[roleKey] || 0
                  return (
                    <div className="recruiter-funnel-step" key={roleKey}>
                      <div className="recruiter-funnel-meta">
                        <span>{ROLE_LABELS[roleKey]}</span>
                        <strong>{count}</strong>
                      </div>
                      <div className="recruiter-funnel-bar">
                        <span
                          className="accent"
                          style={{ width: `${Math.round((count / maxRole) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="recruiter-panel">
            <div className="recruiter-panel-header">
              <h3>Invite health</h3>
            </div>
            <div className="recruiter-stat-row">
              <div>
                <strong>{stats.pendingInvites ?? 0}</strong>
                <span>Pending invites awaiting candidates</span>
              </div>
              <div>
                <strong>{stats.expiredInvites ?? 0}</strong>
                <span>Expired links — resend to reactivate</span>
              </div>
              <div>
                <strong>{stats.activeInterviews ?? 0}</strong>
                <span>Interviews currently in progress</span>
              </div>
            </div>
          </div>
        </>
      )}
    </RecruiterLayout>
  )
}

export default RecruiterAnalytics
