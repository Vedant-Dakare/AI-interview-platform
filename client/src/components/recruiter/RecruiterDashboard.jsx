import { useQuery } from '@tanstack/react-query'
import RecruiterLayout from './RecruiterLayout'
import { getRecruiterCandidates } from '../../services/recruiterApi'

function RecruiterDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['recruiter-candidates', { status: 'all', page: 1, pageSize: 6 }],
    queryFn: () => getRecruiterCandidates({ status: 'all', page: 1, pageSize: 6 }),
  })

  const items = data?.data?.items || []

  return (
    <RecruiterLayout
      title="Recruiter Overview"
      subtitle="Monitor pipeline health, AI evaluation trends, and recent candidate activity."
    >
      <div className="recruiter-grid">
        <div className="recruiter-card">
          <h3>Active candidates</h3>
          <strong>{data?.data?.total || 0}</strong>
          <span>Across all roles</span>
        </div>
        <div className="recruiter-card">
          <h3>Shortlisted</h3>
          <strong>{items.filter((item) => item.applicationStatus === 'shortlisted').length}</strong>
          <span>Ready for next step</span>
        </div>
        <div className="recruiter-card">
          <h3>Interviewing</h3>
          <strong>{items.filter((item) => item.interviewStatus === 'started').length}</strong>
          <span>Live sessions</span>
        </div>
      </div>

      <div className="recruiter-panel">
        <div className="recruiter-panel-header">
          <h3>Recent candidates</h3>
          <button type="button" className="btn-text" onClick={() => (window.location.hash = '/recruiter/candidates')}>
            Open pipeline
          </button>
        </div>
        {isLoading ? (
          <div className="recruiter-skeleton">Loading pipeline snapshot...</div>
        ) : (
          <div className="recruiter-table">
            <div className="recruiter-table-head">
              <span>Candidate</span>
              <span>Role</span>
              <span>Status</span>
              <span>AI score</span>
            </div>
            {items.map((item) => (
              <div className="recruiter-table-row" key={item.candidateId}>
                <span>{item.fullName}</span>
                <span>{item.role.toUpperCase()}</span>
                <span>{item.applicationStatus}</span>
                <span>{item.overallScore ?? '--'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </RecruiterLayout>
  )
}

export default RecruiterDashboard
