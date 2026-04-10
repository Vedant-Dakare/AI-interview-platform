import InterviewHeader from './InterviewHeader'
import InterviewWorkspace from './InterviewWorkspace'
import ProgressPanel from './ProgressPanel'

function InterviewPage() {
  return (
    <div className="interview-page">
      <InterviewHeader />
      <main className="interview-main">
        <InterviewWorkspace />
        <ProgressPanel />
      </main>
    </div>
  )
}

export default InterviewPage
