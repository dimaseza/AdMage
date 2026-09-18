import Link from 'next/link'
import { signup } from '../actions'

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const resolvedParams = await searchParams
  const errorMessage = resolvedParams?.error

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', textAlign: 'center' }}>Create Account</h1>
        
        {errorMessage && (
          <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', border: '1px solid var(--error)', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', textAlign: 'center' }}>
            {errorMessage}
          </div>
        )}

        <form style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="email" style={{ fontWeight: 500 }}>Email</label>
            <input 
              id="email"
              name="email"
              type="email" 
              required
              placeholder="you@example.com"
              style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--glass-border)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'white'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="password" style={{ fontWeight: 500 }}>Password</label>
            <input 
              id="password"
              name="password"
              type="password" 
              required
              style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--glass-border)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'white'
              }}
            />
          </div>

          <button formAction={signup} className="btn-primary" style={{ marginTop: '0.5rem', width: '100%' }}>
            Sign Up
          </button>
        </form>

        <p style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Already have an account? <Link href="/auth/login" style={{ color: 'var(--primary-color)' }}>Log in</Link>
        </p>
      </div>
    </div>
  )
}
