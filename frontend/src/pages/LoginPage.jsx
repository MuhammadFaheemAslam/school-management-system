import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login as loginService } from '../services/authService';
import api from '../services/api';

function FieldError({ msg }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2"/>
        <path d="M12 8V12M12 16H12.01" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
      </svg>
      <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 500 }}>{msg}</span>
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm]         = useState({ username: '', password: '' });
  const [showPwd, setShowPwd]   = useState(false);
  const [errors, setErrors]     = useState({});   // { username?, password?, general? }
  const [loading, setLoading]   = useState(false);
  const [schoolName, setSchoolName] = useState('');

  useEffect(() => {
    api.get('/auth/public-info/').then(res => setSchoolName(res.data.name)).catch(() => {});
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors(prev => ({ ...prev, [e.target.name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const { user, first_login } = await loginService(form.username, form.password);
      login(user);
      navigate(first_login ? '/reset-password' : '/dashboard');
    } catch (err) {
      const data = err.response?.data;
      if (data?.username) {
        setErrors({ username: Array.isArray(data.username) ? data.username[0] : data.username });
      } else if (data?.password) {
        setErrors({ password: Array.isArray(data.password) ? data.password[0] : data.password });
      } else {
        setErrors({ general: data?.detail || 'Something went wrong. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>

      {/* Left panel */}
      <div style={s.left}>
        <div style={s.leftInner}>
          <div style={s.logo}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="12" fill="white" fillOpacity="0.15"/>
              <path d="M20 8L32 14V22C32 28.627 26.627 34 20 34C13.373 34 8 28.627 8 22V14L20 8Z"
                    fill="white" fillOpacity="0.9"/>
              <path d="M15 21L18.5 24.5L25 18" stroke="#1e3a5f" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={s.logoText}>{schoolName || 'School Management System'}</span>
          </div>

          <h1 style={s.headline}>Empowering<br />Education,<br />Simplified.</h1>
          <p style={s.tagline}>
            A complete school management platform for admins, teachers, students, and parents.
          </p>

          <div style={s.pills}>
            {['Student Tracking', 'Attendance', 'Exams & Results', 'Fee Management', 'Reports'].map(t => (
              <span key={t} style={s.pill}>{t}</span>
            ))}
          </div>
        </div>

        {/* Decorative circles */}
        <div style={{ ...s.circle, width: 320, height: 320, top: -80, right: -80, opacity: 0.07 }} />
        <div style={{ ...s.circle, width: 200, height: 200, bottom: 40, right: 60, opacity: 0.05 }} />
      </div>

      {/* Right panel */}
      <div style={s.right}>
        <div style={s.card}>

          <div style={s.cardHeader}>
            <div style={s.avatarIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
                      fill="#2563eb"/>
                <path d="M12 14C7.58172 14 4 17.5817 4 22H20C20 17.5817 16.4183 14 12 14Z"
                      fill="#2563eb"/>
              </svg>
            </div>
            <h2 style={s.cardTitle}>Welcome back</h2>
            <p style={s.cardSub}>Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} style={s.form}>

            {/* Username */}
            <div style={s.fieldWrap}>
              <label style={{ ...s.label, color: errors.username ? '#dc2626' : '#374151' }}>Username</label>
              <div style={s.inputWrap}>
                <span style={s.inputIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M20 21V19C20 16.7909 18.2091 15 16 15H8C5.79086 15 4 16.7909 4 19V21"
                          stroke={errors.username ? '#f87171' : '#94a3b8'} strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="12" cy="7" r="4" stroke={errors.username ? '#f87171' : '#94a3b8'} strokeWidth="2"/>
                  </svg>
                </span>
                <input
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  required
                  autoComplete="username"
                  placeholder="Enter your username"
                  style={{ ...s.input, borderColor: errors.username ? '#f87171' : '#e2e8f0', background: errors.username ? '#fef2f2' : '#fff' }}
                />
              </div>
              {errors.username && <FieldError msg={errors.username} />}
            </div>

            {/* Password */}
            <div style={s.fieldWrap}>
              <label style={{ ...s.label, color: errors.password ? '#dc2626' : '#374151' }}>Password</label>
              <div style={s.inputWrap}>
                <span style={s.inputIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke={errors.password ? '#f87171' : '#94a3b8'} strokeWidth="2"/>
                    <path d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11"
                          stroke={errors.password ? '#f87171' : '#94a3b8'} strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </span>
                <input
                  type={showPwd ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  style={{ ...s.input, borderColor: errors.password ? '#f87171' : '#e2e8f0', background: errors.password ? '#fef2f2' : '#fff', paddingRight: '44px' }}
                />
                <button type="button" onClick={() => setShowPwd(p => !p)} style={s.eyeBtn}>
                  {showPwd ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20C7 20 2.73 16.39 1 12C1.9 9.75 3.37 7.79 5.24 6.27M9.9 4.24A9.12 9.12 0 0112 4C17 4 21.27 7.61 23 12C22.18 14.04 20.88 15.83 19.24 17.22M1 1L23 23" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M1 12C2.73 7.61 7 4 12 4C17 4 21.27 7.61 23 12C21.27 16.39 17 20 12 20C7 20 2.73 16.39 1 12Z" stroke="#94a3b8" strokeWidth="2"/>
                      <circle cx="12" cy="12" r="3" stroke="#94a3b8" strokeWidth="2"/>
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && <FieldError msg={errors.password} />}
            </div>

            {/* Forgot password */}
            <div style={{ textAlign: 'right', marginTop: '-8px' }}>
              <button type="button" onClick={() => navigate('/forgot-password')} style={s.forgotLink}>
                Forgot password?
              </button>
            </div>

            {/* General error (network / other) */}
            {errors.general && (
              <div style={s.errorBox}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2"/>
                  <path d="M12 8V12M12 16H12.01" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {errors.general}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={s.btn}>
              {loading ? (
                <span style={s.spinnerWrap}>
                  <span style={s.spinner} /> Signing in...
                </span>
              ) : 'Sign In'}
            </button>

          </form>

          <p style={s.footer}>
            School Management System &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
  },

  /* ── Left panel ── */
  left: {
    flex: '1 1 55%',
    background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 50%, #2563eb 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 64px',
    position: 'relative',
    overflow: 'hidden',
  },
  leftInner: { position: 'relative', zIndex: 1, maxWidth: '460px' },
  logo: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' },
  logoText: { color: '#fff', fontSize: '22px', fontWeight: '700', letterSpacing: '-0.3px' },
  headline: {
    color: '#fff',
    fontSize: '48px',
    fontWeight: '800',
    lineHeight: '1.15',
    letterSpacing: '-1px',
    margin: '0 0 20px 0',
  },
  tagline: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '16px',
    lineHeight: '1.6',
    margin: '0 0 36px 0',
    maxWidth: '380px',
  },
  pills: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  pill: {
    background: 'rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.9)',
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '500',
    border: '1px solid rgba(255,255,255,0.2)',
    backdropFilter: 'blur(4px)',
  },
  circle: {
    position: 'absolute',
    borderRadius: '50%',
    background: '#fff',
  },

  /* ── Right panel ── */
  right: {
    flex: '1 1 45%',
    background: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 32px',
  },
  card: {
    background: '#fff',
    borderRadius: '20px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07), 0 20px 60px -10px rgba(0,0,0,0.1)',
    padding: '44px 40px',
    width: '100%',
    maxWidth: '420px',
    border: '1px solid #f1f5f9',
  },
  cardHeader: { textAlign: 'center', marginBottom: '32px' },
  avatarIcon: {
    width: '64px', height: '64px', borderRadius: '16px',
    background: '#eff6ff', display: 'flex', alignItems: 'center',
    justifyContent: 'center', margin: '0 auto 16px auto',
    boxShadow: '0 0 0 6px #dbeafe',
  },
  cardTitle: { margin: '0 0 6px 0', fontSize: '24px', fontWeight: '700', color: '#0f172a' },
  cardSub:   { margin: 0, fontSize: '14px', color: '#64748b' },

  /* ── Form ── */
  form:      { display: 'flex', flexDirection: 'column', gap: '20px' },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: '7px' },
  label:     { fontSize: '13px', fontWeight: '600', color: '#374151' },
  inputWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  inputIcon: {
    position: 'absolute', left: '13px', display: 'flex',
    alignItems: 'center', pointerEvents: 'none',
  },
  input: {
    width: '100%', padding: '11px 14px 11px 40px',
    border: '1.5px solid #e2e8f0', borderRadius: '10px',
    fontSize: '14px', color: '#0f172a', outline: 'none',
    background: '#fff', boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  eyeBtn: {
    position: 'absolute', right: '12px', background: 'none',
    border: 'none', cursor: 'pointer', padding: '4px',
    display: 'flex', alignItems: 'center',
  },
  forgotLink: {
    background: 'none', border: 'none', color: '#2563eb',
    fontSize: '13px', fontWeight: '500', cursor: 'pointer', padding: 0,
  },
  errorBox: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: '#fef2f2', border: '1px solid #fecaca',
    color: '#dc2626', padding: '10px 14px',
    borderRadius: '10px', fontSize: '13px',
  },
  btn: {
    padding: '13px',
    background: 'linear-gradient(135deg, #1e40af, #2563eb)',
    color: '#fff', border: 'none', borderRadius: '10px',
    fontSize: '15px', fontWeight: '600', cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
    transition: 'opacity 0.15s',
    marginTop: '4px',
  },
  spinnerWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  spinner: {
    width: '16px', height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'spin 0.7s linear infinite',
  },
  footer: { textAlign: 'center', color: '#94a3b8', fontSize: '12px', marginTop: '28px', marginBottom: 0 },
};
