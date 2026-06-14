import RecruiterLayout from './RecruiterLayout'

function RecruiterAdminPanel() {
  return (
    <RecruiterLayout
      title="Admin Control Center"
      subtitle="Oversee roles, permissions, and audit controls."
    >
      <div className="recruiter-panel">
        <h3>Admin controls</h3>
        <p>Hook this section into your admin tools or internal workflows.</p>
      </div>
    </RecruiterLayout>
  )
}

export default RecruiterAdminPanel
