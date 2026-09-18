export default function NewProjectPage() {
  return (
    <div>
      <h1 style={{ fontSize: '2rem', marginBottom: '2rem' }}>Create New Project</h1>
      
      <div className="glass-panel" style={{ padding: '2rem', maxWidth: '600px' }}>
        <form style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: 500 }}>Project Name / Brand</label>
            <input 
              type="text" 
              placeholder="e.g. Summer Skincare Campaign"
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
            <label style={{ fontWeight: 500 }}>Upload Product Photos</label>
            <div style={{
              border: '2px dashed var(--glass-border)',
              padding: '2rem',
              textAlign: 'center',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}>
              Drag & drop images here or click to browse
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: 500 }}>Target Platform</label>
            <select style={{
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--glass-border)',
              background: '#0B0F19',
              color: 'white'
            }}>
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
              <option value="shopee">Shopee / E-commerce</option>
            </select>
          </div>

          <button type="button" className="btn-primary" style={{ marginTop: '1rem' }}>
            Create Project
          </button>
        </form>
      </div>
    </div>
  );
}
