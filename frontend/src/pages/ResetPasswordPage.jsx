import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { changePassword, getMe } from '../services/authService';

function getStrength(pw) {
  let score = 0;
  if (pw.length >= 8)          score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const STRENGTH = [
  { label: 'Too short',  color: '#e2e8f0', textColor: '#94a3b8' },
  { label: 'Weak',       color: '#ef4444', textColor: '#ef4444' },
  { label: 'Fair',       color: '#f59e0b', textColor: '#f59e0b' },
  { label: 'Good',       color: '#3b82f6', textColor: '#3b82f6' },
  { label: 'Strong',     color: '#10b981', textColor: '#10b981' },
];

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form,    setForm]    = useState({ new_password: '', confirm_password: '' });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showCon, setShowCon] = useState(false);

  const strength = form.new_password ? getStrength(form.new_password) : 0;
  const str      = STRENGTH[strength];
  const match    = form.confirm_password && form.new_password === form.confirm_password;
  const mismatch = form.confirm_password && form.new_password !== form.confirm_password;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.new_password !== form.confirm_password) { setError('Passwords do not match.'); return; }
    if (form.new_password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await changePassword(form.new_password, form.confirm_password);
      const updatedUser = await getMe();
      login(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      navigate('/dashboard');
    } catch (err) {
      const data = err.response?.data;
      setError(data ? Object.values(data).flat().join(' ') : 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.bg}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin    { to { transform: rotate(360deg); } }
      `}</style>

      <div style={s.card}>

        {/* Top accent */}
        <div style={s.topAccent} />

        {/* Icon */}
        <div style={s.iconWrap}>
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="11" rx="2" stroke="white" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M7 11V7a5 5 0 0110 0v4" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="16" r="1.5" fill="white"/>
          </svg>
        </div>

        <h2 style={s.title}>Set New Password</h2>
        <p style={s.sub}>Create a strong password to secure your account.</p>

        <form onSubmit={handleSubmit} style={s.form}>

          {/* New Password */}
          <div style={s.fieldWrap}>
            <label style={s.label}>New Password</label>
            <div style={s.inputWrap}>
              <svg style={s.inputIcon} width="16" height="16" fill="none" viewBox="0 0 24 24">
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="#94a3b8" strokeWidth="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <input
                style={{ ...s.input, borderColor: form.new_password && strength < 2 ? '#f59e0b' : '#e2e8f0' }}
                type={showNew ? 'text' : 'password'}
                value={form.new_password}
                onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
                placeholder="Minimum 8 characters"
                required
              />
              <button type="button" style={s.eyeBtn} onClick={() => setShowNew(p => !p)}>
                {showNew
                  ? <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/></svg>
                  : <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#94a3b8" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="#94a3b8" strokeWidth="2"/></svg>
                }
              </button>
            </div>

            {/* Strength bar */}
            {form.new_password && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= strength ? str.color : '#e2e8f0', transition: 'background 0.25s' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: str.textColor }}>{str.label}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                    {[
                      form.new_password.length >= 8  && '8+ chars',
                      /[A-Z]/.test(form.new_password) && 'Uppercase',
                      /[0-9]/.test(form.new_password) && 'Number',
                      /[^A-Za-z0-9]/.test(form.new_password) && 'Symbol',
                    ].filter(Boolean).join(' · ')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div style={s.fieldWrap}>
            <label style={s.label}>Confirm Password</label>
            <div style={s.inputWrap}>
              <svg style={s.inputIcon} width="16" height="16" fill="none" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="3" y="11" width="18" height="11" rx="2" stroke="#94a3b8" strokeWidth="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <input
                style={{ ...s.input, borderColor: mismatch ? '#ef4444' : match ? '#10b981' : '#e2e8f0' }}
                type={showCon ? 'text' : 'password'}
                value={form.confirm_password}
                onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))}
                placeholder="Repeat new password"
                required
              />
              <button type="button" style={s.eyeBtn} onClick={() => setShowCon(p => !p)}>
                {showCon
                  ? <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/></svg>
                  : <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="#94a3b8" strokeWidth="2"/><circle cx="12" cy="12" r="3" stroke="#94a3b8" strokeWidth="2"/></svg>
                }
              </button>
            </div>
            {mismatch && <p style={s.mismatch}>⚠ Passwords do not match</p>}
            {match    && <p style={s.matchOk}>✓ Passwords match</p>}
          </div>

          {/* Requirements checklist */}
          <div style={s.checklist}>
            {[
              { ok: form.new_password.length >= 8,          label: 'At least 8 characters' },
              { ok: /[A-Z]/.test(form.new_password),         label: 'One uppercase letter' },
              { ok: /[0-9]/.test(form.new_password),         label: 'One number' },
              { ok: /[^A-Za-z0-9]/.test(form.new_password),  label: 'One special character' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: r.ok ? '#dcfce7' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.2s' }}>
                  <svg width="9" height="9" fill="none" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7" stroke={r.ok ? '#16a34a' : '#cbd5e1'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span style={{ fontSize: 12, color: r.ok ? '#16a34a' : '#94a3b8', fontWeight: r.ok ? 600 : 400, transition: 'color 0.2s' }}>{r.label}</span>
              </div>
            ))}
          </div>

          {error && (
            <div style={s.errorBox}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#dc2626" strokeWidth="2"/><path d="M12 8v4M12 16h.01" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/></svg>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading || mismatch} style={{ ...s.btn, opacity: (loading || mismatch) ? 0.7 : 1 }}>
            {loading
              ? <><span style={s.spinner} /> Saving…</>
              : <>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="11" width="18" height="11" rx="2" stroke="white" strokeWidth="2"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                  Set Password &amp; Continue
                </>
            }
          </button>

        </form>
      </div>
    </div>
  );
}

const s = {
  bg: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%)',
    padding: 20, fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
  },
  card: {
    background: '#fff', borderRadius: 20, width: '100%', maxWidth: 420,
    boxShadow: '0 25px 60px rgba(0,0,0,0.35)', overflow: 'hidden',
    animation: 'fadeUp 0.4s ease',
  },
  topAccent: {
    height: 6,
    background: 'linear-gradient(90deg, #1e40af, #6d28d9, #0891b2)',
  },
  iconWrap: {
    width: 60, height: 60, borderRadius: '50%',
    background: 'linear-gradient(135deg, #1e40af, #6d28d9)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '28px auto 16px', boxShadow: '0 8px 24px rgba(30,64,175,0.35)',
  },
  title:  { margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a', textAlign: 'center' },
  sub:    { fontSize: 13, color: '#94a3b8', textAlign: 'center', margin: '6px 0 0' },
  form:   { padding: '24px 28px 28px', display: 'flex', flexDirection: 'column', gap: 18 },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  label:  { fontSize: 13, fontWeight: 600, color: '#374151' },
  inputWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  inputIcon: { position: 'absolute', left: 12, pointerEvents: 'none' },
  input: {
    width: '100%', padding: '11px 40px 11px 36px', border: '1.5px solid #e2e8f0',
    borderRadius: 10, fontSize: 14, color: '#0f172a', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.2s',
  },
  eyeBtn: {
    position: 'absolute', right: 10, background: 'none', border: 'none',
    cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
  },
  checklist: { display: 'flex', flexDirection: 'column', gap: 7, padding: '4px 0' },
  mismatch: { margin: '4px 0 0', fontSize: 12, color: '#ef4444', fontWeight: 600 },
  matchOk:  { margin: '4px 0 0', fontSize: 12, color: '#10b981', fontWeight: 600 },
  errorBox: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
    padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
  },
  btn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '13px', background: 'linear-gradient(135deg, #1e40af, #6d28d9)',
    color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
    cursor: 'pointer', boxShadow: '0 4px 14px rgba(30,64,175,0.4)', transition: 'opacity 0.2s',
  },
  spinner: {
    width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block',
    animation: 'spin 0.7s linear infinite',
  },
};
