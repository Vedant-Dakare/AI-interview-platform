import { useQuery } from '@tanstack/react-query'
import RecruiterLayout from './RecruiterLayout'
import { getRecruiterDashboard } from '../../services/recruiterApi'

const STATUS_LABELS = {
  submitted: 'Submitted',
  invited: 'Invited',
  interviewing: 'Interviewing',
  completed: 'Completed',
  shortlisted: 'Shortlisted',
  rejected: 'Rejected',
}

function formatScore(score) {
  if (score === null || score === undefined) return '--'
  return Number(score).toFixed(1)
}

function formatDateTime(value) {
  if (!value) return '--'
  try {
    return new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '--'
  }
}

function DashboardSkeleton() {
  return (
    <>
      <div className="recruiter-grid">
        {[0, 1, 2, 3].map((key) => (
          <div className="recruiter-card recruiter-skeleton" key={key} aria-hidden="true" />
        ))}
      </div>
      <div className="recruiter-panel">
        <div className="recruiter-skeleton" style={{ minHeight: '220px' }} />
      </div>
    </>
  )
}

function RecruiterDashboard() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['recruiter-dashboard'],
    queryFn: getRecruiterDashboard,
    refetchInterval: 30000,
  })

  const payload = data?.data
  const stats = payload?.stats || {}
  const funnel = payload?.applicationFunnel || {}
  const recentActivity = Array.isArray(payload?.recentActivity) ? payload.recentActivity : []

  const funnelSteps = Object.entries(STATUS_LABELS)
    .map(([key, label]) => ({ key, label, count: funnel[key] || 0 }))
  const maxFunnel = Math.max(1, ...funnelSteps.map((step) => step.count))

  if (isLoading) {
    return (
      <RecruiterLayout
        title="Recruiter Overview"
        subtitle="Monitor pipeline health, AI evaluation trends, and recent candidate activity."
      >
        <DashboardSkeleton />
      </RecruiterLayout>
    )
  }

  if (isError) {
    return (
      <RecruiterLayout title="Recruiter Overview">
        <div className="recruiter-panel recruiter-error">
          <h3>Could not load dashboard</h3>
          <p>{error?.message || 'Something went wrong while loading the overview.'}</p>
          <button type="button" className="btn-primary" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      </RecruiterLayout>
    )
  }

  return (
    <RecruiterLayout
      title="Recruiter Overview"
      subtitle="Monitor pipeline health, AI evaluation trends, and recent candidate activity."
    >
      <div className="recruiter-grid">
        <div className="recruiter-card">
          <h3>Total candidates</h3>
          <strong>{stats.totalCandidates ?? 0}</strong>
          <span>Across all roles</span>
        </div>
        <div className="recruiter-card">
          <h3>Pending invites</h3>
          <strong>{stats.pendingInvites ?? 0}</strong>
          <span>{stats.expiredInvites ?? 0} expired links</span>
        </div>
        <div className="recruiter-card">
          <h3>Active interviews</h3>
          <strong>{stats.activeInterviews ?? 0}</strong>
          <span>In progress right now</span>
        </div>
        <div className="recruiter-card">
          <h3>Completed</h3>
          <strong>{stats.completedInterviews ?? 0}</strong>
          <span>Avg score {formatScore(stats.averageScore)}/10</span>
        </div>
      </div>

      <div className="recruiter-panel">
        <div className="recruiter-panel-header">
          <h3>Pipeline funnel</h3>
        </div>
        <div className="recruiter-funnel">
          {funnelSteps.map((step) => (
            <div className="recruiter-funnel-step" key={step.key}>
              <div className="recruiter-funnel-meta">
                <span>{step.label}</span>
                <strong>{step.count}</strong>
              </div>
              <div className="recruiter-funnel-bar">
                <span style={{ width: `${Math.round((step.count / maxFunnel) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="recruiter-panel">
        <div className="recruiter-panel-header">
          <h3>Recent interviews</h3>
          <button type="button" className="btn-text" onClick={() => (window.location.hash = '/recruiter/jobs')}>
            Manage interviews
          </button>
        </div>
        {recentActivity.length === 0 ? (
          <p className="recruiter-empty">No interview activity yet. Send an invite to get started.</p>
        ) : (
          <div className="recruiter-table">
            <div className="recruiter-table-head">
              <span>Candidate</span>
              <span>Role</span>
              <span>Status</span>
              <span>AI score</span>
              <span>Flags</span>
              <span>Updated</span>
            </div>
            {recentActivity.map((item) => (
              <div className="recruiter-table-row" key={item.interviewId}>
                <span>{item.candidateName || item.candidateEmail || 'Unknown'}</span>
                <span>{item.role.toUpperCase()}</span>
                <span>
                  <span className={`status-pill status-${item.status}`}>{item.status}</span>
                </span>
                <span>{formatScore(item.overallScore)}</span>
                <span>{item.proctoringFlags || 0}</span>
                <span>{formatDateTime(item.updatedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </RecruiterLayout>
  )
}

export default RecruiterDashboard
