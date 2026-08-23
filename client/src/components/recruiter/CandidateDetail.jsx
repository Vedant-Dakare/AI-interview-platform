import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import RecruiterLayout from './RecruiterLayout'
import {
  addRecruiterNote,
  getRecruiterCandidateDetail,
  rejectRecruiterCandidate,
  shortlistRecruiterCandidate,
} from '../../services/recruiterApi'

function toPercentScore(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return null
  }

  if (numeric <= 10) {
    return Math.round(numeric * 10)
  }

  return Math.round(numeric)
}

function formatActionLabel(action) {
  if (!action) {
    return 'Updated'
  }

  return String(action)
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function CandidateDetail({ candidateId }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['recruiter-candidate', candidateId],
    queryFn: () => getRecruiterCandidateDetail(candidateId),
  })

  const detail = data?.data
  const candidate = detail?.candidate
  const scores = detail?.scores || {}
  const reportSummary = detail?.reportSummary || null
  const interviewStatus = detail?.interview?.status || 'pending'
  const primaryScore = toPercentScore(reportSummary?.overallScore ?? scores.overallScore)

  const shortlistMutation = useMutation({
    mutationFn: () => shortlistRecruiterCandidate(candidateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruiter-candidate', candidateId] })
      queryClient.invalidateQueries({ queryKey: ['recruiter-candidates'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () => rejectRecruiterCandidate(candidateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruiter-candidate', candidateId] })
      queryClient.invalidateQueries({ queryKey: ['recruiter-candidates'] })
    },
  })

  const noteMutation = useMutation({
    mutationFn: (payload) => addRecruiterNote(candidateId, payload),
    onSuccess: () => {
      setNote('')
      queryClient.invalidateQueries({ queryKey: ['recruiter-candidate', candidateId] })
    },
  })

  const transcript = useMemo(() => {
    return detail?.interview?.questions || []
  }, [detail])

  const insights = useMemo(() => {
    if (reportSummary) {
      return {
        strengths: Array.isArray(reportSummary.strengths)
          ? reportSummary.strengths.filter(Boolean).slice(0, 6)
          : [],
        weaknesses: Array.isArray(reportSummary.weaknesses)
          ? reportSummary.weaknesses.filter(Boolean).slice(0, 6)
          : [],
      }
    }

    const strengths = []
    const weaknesses = []

    transcript.forEach((question) => {
      const meta = question?.answer?.evaluationMeta || {}
      if (Array.isArray(meta.strengths)) {
        strengths.push(...meta.strengths)
      }
      if (Array.isArray(meta.weaknesses)) {
        weaknesses.push(...meta.weaknesses)
      }
    })

    const unique = (values) => Array.from(new Set(values.filter(Boolean))).slice(0, 6)

    return {
      strengths: unique(strengths),
      weaknesses: unique(weaknesses),
    }
  }, [transcript, reportSummary])

  const focusTags = useMemo(() => {
    const tags = []
    if (candidate?.role) {
      tags.push(candidate.role.toUpperCase())
    }
    tags.push(...insights.strengths.slice(0, 3))
    return tags.slice(0, 4)
  }, [candidate, insights.strengths])

  const resumeInsights = candidate?.resumeInsights
  const timeline = detail?.activities || []

  return (
    <RecruiterLayout
      title="Candidate Review"
      subtitle="Evaluate profile, interview depth, and fit before final decision."
    >
      {isLoading ? (
        <div className="recruiter-skeleton">Loading candidate profile...</div>
      ) : (
        <>
          <div className="recruiter-review-page">
          <div className="review-topbar">
            <button
              type="button"
              className="review-back-link"
              onClick={() => {
                window.location.hash = '/recruiter/candidates'
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
              Candidates / {candidate?.role?.toUpperCase() || 'Role'} / {candidate?.fullName || 'Profile'}
            </button>
            <div className="review-topbar-actions">
              <button
                type="button"
                className="btn-ghost danger"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isLoading}
              >
                {rejectMutation.isLoading ? 'Rejecting...' : 'Reject'}
              </button>
              <button
                type="button"
                className="btn-primary-sm"
                onClick={() => shortlistMutation.mutate()}
                disabled={shortlistMutation.isLoading}
              >
                {shortlistMutation.isLoading ? 'Saving...' : 'Shortlist'}
              </button>
            </div>
          </div>

          <div className="review-hero-grid">
            <section className="review-candidate-card recruiter-panel">
              <div className="review-candidate-header">
                <div className="review-avatar">
                  {candidate?.fullName?.[0] || 'C'}
                </div>
                <div>
                  <h2>{candidate?.fullName || 'Candidate'}</h2>
                  <p>
                    {candidate?.role?.toUpperCase() || 'Role pending'}
                    <span className="dot-separator" aria-hidden="true">•</span>
                    {candidate?.email || 'No email available'}
                  </p>
                </div>
              </div>

              <div className="review-tag-row">
                {focusTags.length ? (
                  focusTags.map((tag) => (
                    <span key={tag} className="review-tag">
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="review-tag">Interview Pending</span>
                )}
              </div>

              <div className="review-health-grid">
                <div>
                  <span className="detail-label">Application Status</span>
                  <span className={`status-pill status-${candidate?.applicationStatus}`}>{candidate?.applicationStatus}</span>
                </div>
                <div>
                  <span className="detail-label">Interview Status</span>
                  <strong>{String(interviewStatus).toUpperCase()}</strong>
                </div>
                <div>
                  <span className="detail-label">Applied On</span>
                  <strong>{candidate?.appliedAt ? new Date(candidate.appliedAt).toLocaleDateString() : '--'}</strong>
                </div>
              </div>
            </section>

            <aside className="review-score-card recruiter-side-card">
              <span className="detail-label">IntervueAI Score</span>
              <div className="review-score-main">
                <strong>{primaryScore ?? '--'}</strong>
                <span>/100</span>
              </div>
              <div className="review-score-bar" aria-hidden="true">
                <div style={{ width: `${Math.max(4, Math.min(100, primaryScore ?? 0))}%` }} />
              </div>
              <p>
                {primaryScore
                  ? `Candidate ranks in top ${Math.max(1, 100 - primaryScore)}% for this role based on interview signals.`
                  : 'Interview score becomes available after evaluated responses are present.'}
              </p>
            </aside>
          </div>

          <div className="review-main-grid">
            <section className="review-left-column">
              <div className="recruiter-panel recruiter-section-card">
                <div className="recruiter-panel-header">
                  <h3>Performance Breakdown</h3>
                  <button
                    type="button"
                    className="btn-text"
                    onClick={() => setShowReportModal(true)}
                    disabled={!reportSummary && transcript.every((item) => !item.answer)}
                  >
                    Full report
                  </button>
                </div>

                <div className="review-metric-list">
                  <div className="review-metric-item">
                    <div>
                      <h4>Technical Depth</h4>
                      <p>Correctness and depth of technical reasoning in answers.</p>
                    </div>
                    <strong>{toPercentScore(reportSummary?.technicalScore ?? scores.technicalScore) ?? '--'}/100</strong>
                  </div>
                  <div className="review-metric-item">
                    <div>
                      <h4>Problem Solving</h4>
                      <p>Structure, trade-off awareness, and diagnostic approach.</p>
                    </div>
                    <strong>{toPercentScore(reportSummary?.problemSolvingScore ?? scores.overallScore) ?? '--'}/100</strong>
                  </div>
                  <div className="review-metric-item">
                    <div>
                      <h4>Communication</h4>
                      <p>Clarity, structure, and completeness of explanations.</p>
                    </div>
                    <strong>{toPercentScore(reportSummary?.communicationScore ?? scores.communicationScore) ?? '--'}/100</strong>
                  </div>
                </div>
              </div>

              <div className="recruiter-panel recruiter-section-card">
                <h3>AI Insights</h3>
                <div className="insight-grid">
                  <div>
                    <span>Strengths</span>
                    <ul>
                      {insights.strengths.length
                        ? insights.strengths.map((item) => <li key={item}>{item}</li>)
                        : <li>No strengths captured yet.</li>}
                    </ul>
                  </div>
                  <div>
                    <span>Growth Areas</span>
                    <ul>
                      {insights.weaknesses.length
                        ? insights.weaknesses.map((item) => <li key={item}>{item}</li>)
                        : <li>No weaknesses captured yet.</li>}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="recruiter-panel recruiter-section-card">
                <h3>Interview Transcript</h3>
                <div className="review-transcript-list">
                  {transcript.length ? (
                    transcript.map((question, index) => (
                      <article key={question.id} className="review-transcript-item">
                        <div className="review-speaker-row">
                          <span className="review-time-chip">Q{index + 1}</span>
                          <strong>IntervueAI</strong>
                        </div>
                        <p>{question.questionText}</p>

                        <div className="review-speaker-row answer">
                          <span className="review-time-chip">A{index + 1}</span>
                          <strong>{candidate?.fullName || 'Candidate'}</strong>
                          {question.answer?.finalScore !== null && question.answer?.finalScore !== undefined && (
                            <span
                              className={`review-answer-score ${
                                Number(question.answer.finalScore) >= 7
                                  ? 'good'
                                  : Number(question.answer.finalScore) < 5
                                    ? 'weak'
                                    : ''
                              }`}
                            >
                              {Number(question.answer.finalScore).toFixed(1)}/10
                            </span>
                          )}
                        </div>
                        <p>{question.answer?.answerText || 'No answer recorded.'}</p>
                      </article>
                    ))
                  ) : (
                    <p>No interview transcript available yet.</p>
                  )}
                </div>
              </div>
            </section>

            <aside className="review-right-column">
              <div className="recruiter-side-card resume-card">
                <div className="recruiter-panel-header">
                  <h3>Resume Preview</h3>
                  {candidate?.resumeFileUrl ? (
                    <a className="btn-ghost" href={candidate.resumeFileUrl} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  ) : null}
                </div>

                {candidate?.resumeFileUrl ? (
                  <div 
                    className="resume-preview-shell"
                    onClick={() => setShowResumeModal(true)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setShowResumeModal(true)}
                  >
                    <iframe
                      src={`https://docs.google.com/gview?url=${encodeURIComponent(candidate.resumeFileUrl)}&embedded=true`}
                      className="resume-preview-frame"
                      title="Resume preview"
                      allow="fullscreen"
                    />
                  </div>
                ) : (
                  <div className="resume-placeholder">
                    <p>No resume uploaded</p>
                  </div>
                )}
              </div>

              <div className="recruiter-side-card" style={{ display: 'none' }}>
                <h3>Next Steps</h3>
                <p>
                  {resumeInsights || 'Use interview evidence, transcript quality, and fit markers to decide final round readiness.'}
                </p>
                <div className="review-next-actions">
                  <button
                    type="button"
                    className="btn-primary-sm"
                    onClick={() => shortlistMutation.mutate()}
                    disabled={shortlistMutation.isLoading}
                  >
                    {shortlistMutation.isLoading ? 'Saving...' : 'Schedule Final Round'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      const email = candidate?.email
                      if (!email) {
                        return
                      }
                      window.location.href = `mailto:${email}`
                    }}
                    disabled={!candidate?.email}
                  >
                    Share with Hiring Manager
                  </button>
                </div>
              </div>

              <div className="recruiter-side-card">
                <h3>Recruiter Notes</h3>
                <div className="recruiter-notes">
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Add internal notes or next steps."
                  />
                  <button
                    type="button"
                    className="btn-primary-sm"
                    onClick={() => noteMutation.mutate({ notes: note })}
                    disabled={!note.trim() || noteMutation.isLoading}
                  >
                    {noteMutation.isLoading ? 'Saving...' : 'Save Note'}
                  </button>
                </div>
              </div>

              <div className="recruiter-side-card">
                <h3>Timeline</h3>
                <div className="timeline-list">
                  {timeline.length ? (
                    timeline.map((activity) => (
                      <div key={activity.id}>
                        <strong>{formatActionLabel(activity.action)}</strong>
                        <span>{new Date(activity.createdAt).toLocaleString()}</span>
                        {activity.notes ? <p>{activity.notes}</p> : null}
                      </div>
                    ))
                  ) : (
                    <p>No recruiter activity yet.</p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>

        {showReportModal && (
          <div className="resume-modal-overlay" onClick={() => setShowReportModal(false)}>
            <div className="resume-modal-content report-modal" onClick={(e) => e.stopPropagation()}>
              <button
                className="resume-modal-close"
                onClick={() => setShowReportModal(false)}
                type="button"
                title="Close report"
              >
                ✕
              </button>
              <h2>AI Interview Report</h2>
              <p className="report-subtitle">
                {candidate?.fullName} · {candidate?.role?.toUpperCase() || 'Role pending'}
              </p>

              {reportSummary ? (
                <>
                  <div className="report-score-grid">
                    <div>
                      <span>Overall</span>
                      <strong>{toPercentScore(reportSummary.overallScore) ?? '--'}/100</strong>
                    </div>
                    <div>
                      <span>Technical</span>
                      <strong>{toPercentScore(reportSummary.technicalScore) ?? '--'}/100</strong>
                    </div>
                    <div>
                      <span>Communication</span>
                      <strong>{toPercentScore(reportSummary.communicationScore) ?? '--'}/100</strong>
                    </div>
                    <div>
                      <span>Problem Solving</span>
                      <strong>{toPercentScore(reportSummary.problemSolvingScore) ?? '--'}/100</strong>
                    </div>
                    <div>
                      <span>Integrity Risk</span>
                      <strong>{toPercentScore(reportSummary.cheatingRiskScore) ?? '--'}/100</strong>
                    </div>
                  </div>

                  {reportSummary.recommendation && (
                    <div className={`report-recommendation ${String(reportSummary.recommendation).toLowerCase()}`}>
                      Recommendation: <strong>{formatActionLabel(reportSummary.recommendation)}</strong>
                    </div>
                  )}

                  <div className="insight-grid">
                    <div>
                      <span>Strengths</span>
                      <ul>
                        {insights.strengths.length
                          ? insights.strengths.map((item) => <li key={item}>{item}</li>)
                          : <li>Not captured.</li>}
                      </ul>
                    </div>
                    <div>
                      <span>Growth Areas</span>
                      <ul>
                        {insights.weaknesses.length
                          ? insights.weaknesses.map((item) => <li key={item}>{item}</li>)
                          : <li>Not captured.</li>}
                      </ul>
                    </div>
                  </div>
                </>
              ) : (
                <p className="recruiter-empty">
                  Deterministic AI summary becomes available after an adaptive interview with evaluated answers.
                </p>
              )}

              <h3>Question breakdown</h3>
              <div className="report-question-list">
                {transcript.filter((item) => item.answer).length ? (
                  transcript
                    .filter((item) => item.answer)
                    .map((question, index) => (
                      <article key={question.id} className="report-question-item">
                        <header>
                          <span>Q{index + 1}</span>
                          {question.answer.finalScore !== null && question.answer.finalScore !== undefined && (
                            <strong>{Number(question.answer.finalScore).toFixed(1)}/10</strong>
                          )}
                        </header>
                        <p className="report-q-text">{question.questionText}</p>
                        {question.answer.feedback && <p className="report-feedback">{question.answer.feedback}</p>}
                      </article>
                    ))
                ) : (
                  <p className="recruiter-empty">No answered questions yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {showResumeModal && candidate?.resumeFileUrl && (
          <div className="resume-modal-overlay" onClick={() => setShowResumeModal(false)}>
            <div className="resume-modal-content" onClick={(e) => e.stopPropagation()}>
              <button 
                className="resume-modal-close"
                onClick={() => setShowResumeModal(false)}
                type="button"
                title="Close resume"
              >
                ✕
              </button>
              <iframe
                src={`https://docs.google.com/gview?url=${encodeURIComponent(candidate.resumeFileUrl)}&embedded=true`}
                className="resume-modal-frame"
                title="Full screen resume"
                allow="fullscreen"
              />
            </div>
          </div>
        )}
        </>
      )}
    </RecruiterLayout>
  )
}

export default CandidateDetail;
