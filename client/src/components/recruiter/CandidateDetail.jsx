import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import RecruiterLayout from './RecruiterLayout'
import {
  addRecruiterNote,
  getRecruiterCandidateDetail,
  rejectRecruiterCandidate,
  shortlistRecruiterCandidate,
} from '../../services/recruiterApi'

function CandidateDetail({ candidateId }) {
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['recruiter-candidate', candidateId],
    queryFn: () => getRecruiterCandidateDetail(candidateId),
  })

  const detail = data?.data
  const candidate = detail?.candidate
  const scores = detail?.scores || {}

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
  }, [transcript])

  return (
    <RecruiterLayout
      title={candidate?.fullName || 'Candidate Detail'}
      subtitle="Review transcripts, AI insights, and make final decisions."
    >
      {isLoading ? (
        <div className="recruiter-skeleton">Loading candidate profile...</div>
      ) : (
        <div className="recruiter-detail-grid">
          <div className="recruiter-panel">
            <div className="recruiter-detail-header">
              <div>
                <span className="detail-label">Role applied</span>
                <strong>{candidate?.role?.toUpperCase()}</strong>
              </div>
              <div>
                <span className="detail-label">Status</span>
                <span className={`status-pill status-${candidate?.applicationStatus}`}>{candidate?.applicationStatus}</span>
              </div>
            </div>

            <div className="recruiter-score-grid">
              <div>
                <span>Overall score</span>
                <strong>{scores.overallScore ?? '--'}</strong>
              </div>
              <div>
                <span>Technical</span>
                <strong>{scores.technicalScore ?? '--'}</strong>
              </div>
              <div>
                <span>Communication</span>
                <strong>{scores.communicationScore ?? '--'}</strong>
              </div>
              <div>
                <span>Confidence</span>
                <strong>{scores.confidenceScore ?? '--'}</strong>
              </div>
            </div>

            <div className="recruiter-section">
              <h3>Resume</h3>
              {candidate?.resumeFileUrl ? (
                <a className="btn-ghost" href={candidate.resumeFileUrl} target="_blank" rel="noreferrer">
                  Preview resume
                </a>
              ) : (
                <p>No resume uploaded.</p>
              )}
            </div>

            <div className="recruiter-section">
              <h3>AI insights</h3>
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
                  <span>Growth areas</span>
                  <ul>
                    {insights.weaknesses.length
                      ? insights.weaknesses.map((item) => <li key={item}>{item}</li>)
                      : <li>No weaknesses captured yet.</li>}
                  </ul>
                </div>
              </div>
            </div>

            <div className="recruiter-section">
              <h3>Transcript</h3>
              <div className="recruiter-transcript">
                {transcript.length ? (
                  transcript.map((question) => (
                    <div key={question.id}>
                      <strong>Q:</strong> {question.questionText}
                      <div className="answer-row">
                        <strong>A:</strong> {question.answer?.answerText || 'No answer recorded.'}
                      </div>
                    </div>
                  ))
                ) : (
                  <p>No interview transcript available yet.</p>
                )}
              </div>
            </div>

            <div className="recruiter-section">
              <h3>Recruiter notes</h3>
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
                  Save note
                </button>
              </div>
            </div>
          </div>

          <aside className="recruiter-side">
            <div className="recruiter-side-card">
              <h3>Decision</h3>
              <button
                type="button"
                className="btn-primary-sm"
                onClick={() => shortlistMutation.mutate()}
                disabled={shortlistMutation.isLoading}
              >
                Shortlist candidate
              </button>
              <button
                type="button"
                className="btn-ghost danger"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isLoading}
              >
                Reject candidate
              </button>
            </div>

            <div className="recruiter-side-card">
              <h3>Timeline</h3>
              <div className="timeline-list">
                {(detail?.activities || []).map((activity) => (
                  <div key={activity.id}>
                    <strong>{activity.action}</strong>
                    <span>{new Date(activity.createdAt).toLocaleString()}</span>
                    {activity.notes ? <p>{activity.notes}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </RecruiterLayout>
  )
}

export default CandidateDetail
