import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import RecruiterLayout from './RecruiterLayout'
import {
  createRecruiterInterview,
  getRecruiterInterviews,
  resendRecruiterInterviewEmail,
} from '../../services/recruiterApi'
import useDebouncedValue from '../../utils/useDebouncedValue'

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'expired', label: 'Expired' },
]

const ROLES = [
  { value: 'backend', label: 'Backend' },
  { value: 'ml', label: 'ML' },
  { value: 'dsa', label: 'DSA' },
]

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

function CreateInviteForm({ onSuccess }) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('backend')
  const [sendEmail, setSendEmail] = useState(true)

  const mutation = useMutation({
    mutationFn: createRecruiterInterview,
    onSuccess,
  })

  const created = mutation.data?.data

  function handleSubmit(event) {
    event.preventDefault()
    mutation.mutate({ email, fullName, role, sendEmail })
  }

  async function copyLink() {
    if (created?.interviewLink) {
      await navigator.clipboard.writeText(created.interviewLink)
    }
  }

  return (
    <form className="recruiter-create-form" onSubmit={handleSubmit}>
      <div className="recruiter-form-grid">
        <label>
          <span>Email *</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="candidate@example.com"
          />
        </label>
        <label>
          <span>Full name</span>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Optional"
          />
        </label>
        <label>
          <span>Role *</span>
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            {ROLES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="recruiter-checkbox">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(event) => setSendEmail(event.target.checked)}
          />
          <span>Email the link automatically</span>
        </label>
      </div>

      <div className="recruiter-form-actions">
        <button type="submit" className="btn-primary" disabled={mutation.isLoading}>
          {mutation.isLoading ? 'Creating...' : 'Create interview'}
        </button>
      </div>

      {mutation.isError && (
        <p className="recruiter-form-error">{mutation.error?.message || 'Failed to create interview.'}</p>
      )}

      {created && (
        <div className="recruiter-created-invite">
          <p>
            Invite ready for <strong>{created.email}</strong>
            {created.emailSent ? ' and emailed.' : '.'}
          </p>
          <div className="recruiter-link-row">
            <code>{created.interviewLink}</code>
            <button type="button" className="btn-ghost" onClick={copyLink}>
              Copy link
            </button>
          </div>
          {!created.emailSent && created.emailError && (
            <p className="recruiter-form-error">Email delivery failed: {created.emailError}. Share the link manually.</p>
          )}
        </div>
      )}
    </form>
  )
}

function RecruiterJobs() {
  const [status, setStatus] = useState('all')
  const [roleFilter, setRoleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const debouncedSearch = useDebouncedValue(search, 300)
  const queryClient = useQueryClient()

  const queryKey = useMemo(
    () => ['recruiter-interviews', { status, role: roleFilter, search: debouncedSearch, page }],
    [status, roleFilter, debouncedSearch, page],
  )

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      getRecruiterInterviews({
        status,
        role: roleFilter,
        search: debouncedSearch,
        page,
        pageSize: 20,
      }),
    keepPreviousData: true,
  })

  const resendMutation = useMutation({
    mutationFn: (candidateId) => resendRecruiterInterviewEmail(candidateId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recruiter-interviews'] }),
  })

  const items = data?.data?.items || []
  const total = data?.data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / 20))

  function handleCreateSuccess() {
    queryClient.invalidateQueries({ queryKey: ['recruiter-interviews'] })
    queryClient.invalidateQueries({ queryKey: ['recruiter-dashboard'] })
    setPage(1)
    setStatus('all')
  }

  return (
    <RecruiterLayout
      title="Interview Management"
      subtitle="Send AI interview links, track invite status, and follow candidate progress."
    >
      <div className="recruiter-panel">
        <div className="recruiter-panel-header">
          <h3>New interview</h3>
        </div>
        <CreateInviteForm onSuccess={handleCreateSuccess} />
      </div>

      <div className="recruiter-toolbar">
        <div className="recruiter-tabs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`recruiter-tab ${status === tab.key ? 'active' : ''}`}
              onClick={() => {
                setStatus(tab.key)
                setPage(1)
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="recruiter-filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email or candidate ID"
          />
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">All roles</option>
            {ROLES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="recruiter-panel">
        {isLoading ? (
          <div className="recruiter-skeleton">Loading interviews...</div>
        ) : items.length === 0 ? (
          <p className="recruiter-empty">No interviews match these filters.</p>
        ) : (
          <div className="recruiter-table">
            <div className="recruiter-table-head wide">
              <span>Candidate</span>
              <span>Role</span>
              <span>Invite status</span>
              <span>Expires</span>
              <span>Progress</span>
              <span>AI score</span>
              <span>Actions</span>
            </div>
            {items.map((item) => (
              <div className="recruiter-table-row wide" key={`${item.candidateId}-${item.createdAt}`}>
                <div>
                  <button
                    type="button"
                    className="candidate-profile-link"
                    onClick={() => (window.location.hash = `/recruiter/candidates/${item.candidateId}`)}
                  >
                    {item.fullName}
                  </button>
                  <span>{item.email}</span>
                </div>
                <span>{item.role.toUpperCase()}</span>
                <span>
                  <span className={`status-pill status-${item.inviteStatus}`}>{item.inviteStatus}</span>
                </span>
                <span>{formatDateTime(item.tokenExpiry)}</span>
                <span>
                  {item.interview
                    ? `${Math.min(item.interview.currentQuestionIndex + 1, item.interview.targetQuestionCount || 6)}/${item.interview.targetQuestionCount || '?'} · ${item.interview.status}`
                    : item.resumeUploaded
                      ? 'Resume uploaded'
                      : 'Not started'}
                </span>
                <span>{formatScore(item.interview?.overallScore)}</span>
                <div className="recruiter-actions">
                  {item.interview && item.inviteStatus !== 'pending' && (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => (window.location.hash = `/recruiter/candidates/${item.candidateId}`)}
                    >
                      Report
                    </button>
                  )}
                  {item.inviteStatus !== 'completed' && (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={resendMutation.isLoading}
                      onClick={() => resendMutation.mutate(item.candidateId)}
                    >
                      Resend link
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="recruiter-pagination">
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
          Next
        </button>
      </div>
    </RecruiterLayout>
  )
}

export default RecruiterJobs
