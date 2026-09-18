export default function DashboardOverview() {
  return (
    <div>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Welcome to AdMage</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Create your first project to start generating AI-powered content.
      </p>
      
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>No Projects Yet</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Get started by creating a project for your brand or product.
        </p>
        <button className="btn-primary">Create New Project</button>
      </div>
    </div>
  );
}
