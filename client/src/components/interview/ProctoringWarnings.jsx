import './ProctoringWarnings.css'

function ProctoringWarnings({ warningCount = 0, isTerminated = false, terminationReason = '' }) {
  if (isTerminated) {
    return (
      <div className="proctoring-warning proctoring-terminated">
        <div className="warning-icon">⛔</div>
        <h2>Interview Terminated</h2>
        <p className="termination-reason">{terminationReason}</p>
        <p className="warning-subtext">Due to policy violations, this interview has been ended.</p>
      </div>
    )
  }

  if (warningCount >= 4) {
    return (
      <div className="proctoring-warning proctoring-critical">
        <div className="warning-badge">⚠️ FINAL WARNING</div>
        <p>
          <strong>{5 - warningCount}</strong> more violation will terminate this interview.
        </p>
      </div>
    )
  }

  if (warningCount >= 3) {
    return (
      <div className="proctoring-warning proctoring-danger">
        <div className="warning-badge">⚠️ Warning {warningCount}/5</div>
        <p>Please stay focused on the interview. Repeated violations will result in termination.</p>
      </div>
    )
  }

  if (warningCount > 0) {
    return (
      <div className="proctoring-warning proctoring-caution">
        <div className="warning-badge">⚠️ Warning {warningCount}/5</div>
        <p>Do not leave the interview screen or switch tabs.</p>
      </div>
    )
  }

  return (
    <div className="proctoring-info">
      <span className="status-badge">✓ Strict Mode Active</span>
    </div>
  )
}

export default ProctoringWarnings
