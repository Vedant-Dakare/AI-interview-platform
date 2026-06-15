import RecruiterLayout from './RecruiterLayout'

function RecruiterSettings() {
  return (
    <RecruiterLayout
      title="Recruiter Settings"
      subtitle="Manage notification preferences and recruiter workflow settings."
    >
      <div className="recruiter-panel">
        <h3>Preferences</h3>
        <p>Configure email alerts, team access, and workflow automation.</p>
      </div>
    </RecruiterLayout>
  )
}

export default RecruiterSettings
