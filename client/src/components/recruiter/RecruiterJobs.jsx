import RecruiterLayout from './RecruiterLayout'

function RecruiterJobs() {
  return (
    <RecruiterLayout
      title="Job Management"
      subtitle="Configure AI interview tracks, templates, and hiring pipelines."
    >
      <div className="recruiter-panel">
        <h3>Job roles</h3>
        <p>Manage role-specific question plans and interview availability.</p>
      </div>
    </RecruiterLayout>
  )
}

export default RecruiterJobs
