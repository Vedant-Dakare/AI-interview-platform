import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import RecruiterLayout from './RecruiterLayout'
import {
  getRecruiterCandidates,
  shortlistRecruiterCandidate,
  rejectRecruiterCandidate,
} from '../../services/recruiterApi'
import useDebouncedValue from '../../utils/useDebouncedValue'

const STATUS_TABS = [
  { key: 'all', label: 'All candidates' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'invited', label: 'Invited' },
  { key: 'interviewing', label: 'Interviewing' },
  { key: 'completed', label: 'Completed' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'rejected', label: 'Rejected' },
]

function RecruiterCandidates() {
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [sort, setSort] = useState('recent')
  const [page, setPage] = useState(1)

  const debouncedSearch = useDebouncedValue(search, 300)
  const queryClient = useQueryClient()

  const queryKey = useMemo(
    () => ['recruiter-candidates', { status, search: debouncedSearch, role: roleFilter, sort, page }],
    [status, debouncedSearch, roleFilter, sort, page],
  )

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      getRecruiterCandidates({
        status,
        search: debouncedSearch,
        role: roleFilter,
        sort,
        page,
        pageSize: 20,
      }),
    keepPreviousData: true,
  })

  const shortlistMutation = useMutation({
    mutationFn: (candidateId) => shortlistRecruiterCandidate(candidateId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recruiter-candidates'] }),
  })

  const rejectMutation = useMutation({
    mutationFn: (candidateId) => rejectRecruiterCandidate(candidateId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recruiter-candidates'] }),
  })

  const items = data?.data?.items || []
  const total = data?.data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <RecruiterLayout
      title="Candidate Pipeline"
      subtitle="Search, filter, and take action on AI interview outcomes." 
    >
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
            placeholder="Search by name, email, or candidate ID"
          />
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">All roles</option>
            <option value="backend">Backend</option>
            <option value="ml">ML</option>
            <option value="dsa">DSA</option>
          </select>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="recent">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      <div className="recruiter-panel">
        {isLoading ? (
          <div className="recruiter-skeleton">Loading candidates...</div>
        ) : (
          <div className="recruiter-table">
            <div className="recruiter-table-head wide">
              <span>Candidate</span>
              <span>Role</span>
              <span>Status</span>
              <span>AI score</span>
              <span>Confidence</span>
              <span>Flags</span>
              <span>Actions</span>
            </div>
            {items.map((item) => (
              <div className="recruiter-table-row wide" key={item.candidateId}>
                <div>
                  <strong>{item.fullName}</strong>
                  <span>{item.email}</span>
                </div>
                <span>{item.role.toUpperCase()}</span>
                <span className={`status-pill status-${item.applicationStatus}`}>{item.applicationStatus}</span>
                <span>{item.overallScore ?? '--'}</span>
                <span>{item.confidenceScore ?? '--'}</span>
                <span>{item.suspiciousFlags || 0}</span>
                <div className="recruiter-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => (window.location.hash = `/recruiter/candidates/${item.candidateId}`)}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={shortlistMutation.isLoading}
                    onClick={() => shortlistMutation.mutate(item.candidateId)}
                  >
                    Shortlist
                  </button>
                  <button
                    type="button"
                    className="btn-ghost danger"
                    disabled={rejectMutation.isLoading}
                    onClick={() => rejectMutation.mutate(item.candidateId)}
                  >
                    Reject
                  </button>
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

export default RecruiterCandidates
