import Link from 'next/link';

export default function ProjectsPage() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem' }}>Projects</h1>
        <Link href="/dashboard/projects/new" className="btn-primary">
          New Project
        </Link>
      </div>
      
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>No projects found. Create one to start.</p>
      </div>
    </div>
  );
}
