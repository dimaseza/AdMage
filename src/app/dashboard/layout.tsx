import { logout } from '@/app/auth/actions';
import SidebarNav from './SidebarNav';
import CreditBalance from '@/components/CreditBalance';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-container">
      <aside className="sidebar glass-panel">
        <div className="brand">
          <h2>AdMage</h2>
        </div>
        <SidebarNav />
        <div className="user-section">
          <CreditBalance />
          <form action={logout} style={{ marginTop: '0.5rem' }}>
            <button type="submit" style={{ 
              width: '100%', 
              background: 'transparent', 
              color: 'var(--text-secondary)', 
              border: 'none', 
              padding: '0.5rem', 
              cursor: 'pointer',
              fontWeight: 500
            }}>Logout</button>
          </form>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
