import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

export default function SchoolSettingsPage() {
  const [name,        setName]        = useState('');
  const [logoUrl,     setLogoUrl]     = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile,    setLogoFile]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [error,       setError]       = useState('');
  const fileRef = useRef();

  useEffect(() => {
    api.get('/auth/school-settings/')
      .then(r => { setName(r.data.name); setLogoUrl(r.data.logo); })
      .catch(() => setError('Could not load school settings.'))
      .finally(() => setLoading(false));
  }, []);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('School name cannot be empty.'); return; }
    setSaving(true); setError(''); setSaved(false);
    try {
      const form = new FormData();
      form.append('name', name.trim());
      if (logoFile) form.append('logo', logoFile);
      const r = await api.put('/auth/school-settings/update/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setLogoUrl(r.data.logo);
      setLogoFile(null);
      setLogoPreview(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={s.page}>
      <div style={s.loadingBox}>Loading settings…</div>
    </div>
  );

  const displayLogo = logoPreview || logoUrl;

  return (
    <div style={s.page}>
      <style>{`@keyframes toast{0%{opacity:0;transform:translateX(-50%) translateY(10px)}15%{opacity:1;transform:translateX(-50%) translateY(0)}85%{opacity:1}100%{opacity:0;transform:translateX(-50%) translateY(10px)}}`}</style>

      {saved && (
        <div style={s.toast}>✓ School settings saved successfully!</div>
      )}

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerIcon}>🏫</div>
        <div>
          <h2 style={s.title}>School Settings</h2>
          <p style={s.subtitle}>Update school name and logo</p>
        </div>
      </div>

      <div style={s.card}>
        {error && <div style={s.errorBox}>{error}</div>}

        {/* Logo section */}
        <div style={s.section}>
          <label style={s.label}>School Logo</label>
          <div style={s.logoRow}>
            {/* Current / preview */}
            <div style={s.logoWrap}>
              {displayLogo ? (
                <img src={displayLogo} alt="School logo" style={s.logoImg} />
              ) : (
                <div style={s.logoPlaceholder}>
                  <span style={{ fontSize: 36 }}>🏫</span>
                  <span style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>No logo</span>
                </div>
              )}
            </div>

            <div style={s.logoActions}>
              <p style={s.logoHint}>
                Recommended: square image, PNG or JPG, at least 200×200 px.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleLogoChange}
              />
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => fileRef.current.click()} style={s.uploadBtn}>
                  📁 {displayLogo ? 'Change Logo' : 'Upload Logo'}
                </button>
                {logoPreview && (
                  <button onClick={() => { setLogoFile(null); setLogoPreview(null); }} style={s.removeBtn}>
                    ✕ Cancel
                  </button>
                )}
              </div>
              {logoPreview && (
                <div style={s.previewNote}>New logo selected — save to apply.</div>
              )}
            </div>
          </div>
        </div>

        <div style={s.divider} />

        {/* Name section */}
        <div style={s.section}>
          <label style={s.label} htmlFor="school-name">School Name</label>
          <input
            id="school-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter school name"
            style={s.input}
          />
          <p style={s.hint}>This name appears across the system.</p>
        </div>

        <div style={s.divider} />

        {/* Save */}
        <div style={s.footer}>
          <button onClick={handleSave} disabled={saving} style={{ ...s.saveBtn, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : '💾 Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  page:        { maxWidth: 680, margin: '0 auto', padding: '28px 20px', fontFamily: 'inherit' },
  loadingBox:  { padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 },

  header:     { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 },
  headerIcon: { fontSize: 36, background: 'linear-gradient(135deg,#1e293b,#334155)', borderRadius: 14, padding: '10px 14px' },
  title:      { margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' },
  subtitle:   { margin: '3px 0 0', fontSize: 13, color: '#94a3b8' },

  card:       { background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden' },
  section:    { padding: '24px 28px' },
  divider:    { height: 1, background: '#f1f5f9' },
  footer:     { padding: '20px 28px', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' },

  label:      { display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' },
  hint:       { margin: '8px 0 0', fontSize: 12, color: '#94a3b8' },

  logoRow:     { display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' },
  logoWrap:    { width: 110, height: 110, borderRadius: 14, border: '2px dashed #e2e8f0', overflow: 'hidden', flexShrink: 0, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoImg:     { width: '100%', height: '100%', objectFit: 'cover' },
  logoPlaceholder: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
  logoActions: { flex: 1, minWidth: 200 },
  logoHint:    { margin: '0 0 12px', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 },
  uploadBtn:   { padding: '9px 18px', background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700 },
  removeBtn:   { padding: '9px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  previewNote: { marginTop: 8, fontSize: 12, color: '#d97706', fontWeight: 600 },

  input:      { width: '100%', padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 15, color: '#0f172a', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' },

  saveBtn:    { padding: '11px 28px', background: 'linear-gradient(135deg,#1d4ed8,#2563eb)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700, transition: 'opacity 0.15s' },
  errorBox:   { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 },
  toast:      { position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#16a34a', color: '#fff', padding: '11px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700, zIndex: 9999, animation: 'toast 3s ease forwards', whiteSpace: 'nowrap', boxShadow: '0 6px 20px rgba(22,163,74,0.35)' },
};
