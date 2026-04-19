import { useState } from 'react'
import { submitAnswer, moveToNextQuestion } from '../../services/interviewApi'

function VisualBars({ large = false }) {
  if (large) {
    return (
      <div className="live-waveform-large">
        <div className="b h1" />
        <div className="b h2" />
        <div className="b h3" />
        <div className="b h4" />
        <div className="b h5" />
        <div className="b h6" />
        <div className="b h7" />
        <div className="b h8" />
        <div className="b h9" />
        <div className="b h10" />
        <div className="b h11" />
        <div className="b h12" />
        <div className="b h13" />
      </div>
    )
  }

  return (
    <div className="visualizer-bars">
      <div className="v v1" />
      <div className="v v2" />
      <div className="v v3" />
      <div className="v v4" />
      <div className="v v5" />
    </div>
  )
}

function InterviewWorkspace({ interviewId, question, currentQuestionIndex, totalQuestions, onAnswerSubmitted }) {
  const [answer, setAnswer] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAnswered, setIsAnswered] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmitAnswer() {
    if (!answer.trim()) {
      setError('Please provide an answer before continuing.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      await submitAnswer(interviewId, answer.trim())
      setIsAnswered(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleNextQuestion() {
    setIsSubmitting(true)
    setError('')

    try {
      const response = await moveToNextQuestion(interviewId)
      
      if (response.data.hasNextQuestion) {
        setAnswer('')
        setIsAnswered(false)
        onAnswerSubmitted?.()
      } else {
        // No more questions, interview should end
        onAnswerSubmitted?.()
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="interview-workspace">
      <div className="ai-visual-wrap">
        <div className="ai-visual-core ai-pulse">
          <div className="ai-visual-inner">
            <VisualBars />
          </div>
        </div>
        <div className="ai-environment-glow" />
      </div>

      <div className="question-block">
        <h2>{isAnswered ? 'Your Answer Recorded' : 'Interviewer is listening'}</h2>
        <h1>{question}</h1>
      </div>

      <div className="interaction-zone">
        <div className="interaction-card">
          <VisualBars large />
          <div className="interaction-divider" />
          
          {!isAnswered ? (
            <div className="answer-input-section">
              <textarea
                className="answer-textarea"
                placeholder="Type your answer here..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={isSubmitting}
                rows={6}
              />
              {error && <div className="answer-error">{error}</div>}
              <button
                className="submit-answer-btn"
                onClick={handleSubmitAnswer}
                disabled={isSubmitting || !answer.trim()}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Answer'}
              </button>
            </div>
          ) : (
            <div className="answer-submitted-section">
              <div className="submitted-message">
                <span className="material-symbols-outlined">check_circle</span>
                <p>Your answer has been recorded</p>
              </div>
              <button
                className="next-question-btn"
                onClick={handleNextQuestion}
                disabled={isSubmitting}
              >
                {currentQuestionIndex + 1 >= totalQuestions ? 'End Interview' : 'Next Question'}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default InterviewWorkspace
