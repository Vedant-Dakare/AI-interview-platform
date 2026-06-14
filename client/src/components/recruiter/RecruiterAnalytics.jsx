import RecruiterLayout from './RecruiterLayout'

function RecruiterAnalytics() {
  return (
    <RecruiterLayout
      title="Recruiter Analytics"
      subtitle="Track AI score distribution, funnel velocity, and integrity signals."
    >
      <div className="recruiter-panel">
        <h3>Analytics dashboard</h3>
        <p>Connect this view to your metrics pipeline and add charts here.</p>
      </div>
    </RecruiterLayout>
  )
}

export default RecruiterAnalytics
