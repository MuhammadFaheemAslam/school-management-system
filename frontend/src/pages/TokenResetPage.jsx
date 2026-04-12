import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

export default function TokenResetPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [form, setForm]       = useState({ new_password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState('');

  if (!token) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <h2 style={s.title}>Invalid Link</h2>
          <p style={{ color: '#718096', marginBottom: '20px' }}>
            This reset link is missing or malformed. Please request a new one.
          </p>
          <button onClick={() => navigate('/forgot-password')} style={s.btn}>Request New Link</button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.new_password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    if (form.new_password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-via-token/', { token, ...form });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.successBox}>
            Your password has been reset successfully.
          </div>
          <button onClick={() => navigate('/login')} style={{ ...s.btn, marginTop: '16px' }}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h2 style={s.title}>Set New Password</h2>
        <form onSubmit={handleSubmit} style={s.form}>
          <div>
            <label style={s.label}>New Password</label>
            <input
              type="password"
              value={form.new_password}
              onChange={e => setForm({ ...form, new_password: e.target.value })}
              required minLength={8}
              placeholder="Min. 8 characters"
              style={s.input}
            />
          </div>
          <div>
            <label style={s.label}>Confirm Password</label>
            <input
              type="password"
              value={form.confirm_password}
              onChange={e => setForm({ ...form, confirm_password: e.target.value })}
              required minLength={8}
              placeholder="Repeat password"
              style={s.input}
            />
          </div>
          {error && <div style={s.errorBox}>{error}</div>}
          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s = {
  page:       { minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  card:       { background: '#fff', padding: '40px 36px', borderRadius: '16px', boxShadow: '0 8px 40px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' },
  title:      { margin: '0 0 20px 0', fontSize: '22px', color: '#1a1a2e', textAlign: 'center' },
  form:       { display: 'flex', flexDirection: 'column', gap: '16px' },
  label:      { display: 'block', fontSize: '13px', fontWeight: '600', color: '#555', marginBottom: '5px' },
  input:      { width: '100%', padding: '11px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box' },
  btn:        { width: '100%', padding: '12px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' },
  errorBox:   { background: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '10px 14px', borderRadius: '8px', fontSize: '14px' },
  successBox: { background: '#c6f6d5', border: '1px solid #9ae6b4', color: '#276749', padding: '14px 16px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', textAlign: 'center' },
};
