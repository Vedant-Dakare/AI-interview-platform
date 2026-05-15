function ProtectedPlaceholder({ title, description, onBackHome }) {
  return (
    <div className="protected-page">
      <div className="protected-card">
        <span className="material-symbols-outlined">lock</span>
        <h2>{title}</h2>
        <p>{description}</p>
        <button type="button" className="btn-primary-sm" onClick={onBackHome}>
          Back to Home
        </button>
      </div>
    </div>
  )
}

export default ProtectedPlaceholder
