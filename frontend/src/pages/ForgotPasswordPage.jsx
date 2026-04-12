import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password/', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h2 style={s.title}>Forgot Password</h2>

        {sent ? (
          <div>
            <div style={s.successBox}>
              If <strong>{email}</strong> is registered, a password reset link has been sent.
              Please check your inbox (and spam folder).
            </div>
            <p style={s.hint}>The link expires in <strong>1 hour</strong>.</p>
            <button onClick={() => navigate('/login')} style={s.btn}>Back to Login</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={s.form}>
            <p style={s.subtitle}>
              Enter your registered email address and we'll send you a link to reset your password.
            </p>
            <label style={s.label}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={s.input}
            />
            {error && <div style={s.errorBox}>{error}</div>}
            <button type="submit" disabled={loading} style={s.btn}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
            <button type="button" onClick={() => navigate('/login')} style={s.backLink}>
              &larr; Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const s = {
  page:       { minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  card:       { background: '#fff', padding: '40px 36px', borderRadius: '16px', boxShadow: '0 8px 40px rgba(0,0,0,0.1)', width: '100%', maxWidth: '420px' },
  title:      { margin: '0 0 8px 0', fontSize: '24px', color: '#1a1a2e', textAlign: 'center' },
  subtitle:   { margin: '0 0 20px 0', color: '#718096', fontSize: '14px', lineHeight: '1.5' },
  form:       { display: 'flex', flexDirection: 'column', gap: '14px' },
  label:      { fontSize: '13px', fontWeight: '600', color: '#555' },
  input:      { padding: '11px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '15px', outline: 'none' },
  btn:        { padding: '12px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '700', cursor: 'pointer' },
  backLink:   { background: 'none', border: 'none', color: '#718096', fontSize: '14px', cursor: 'pointer', textAlign: 'center', padding: '4px' },
  errorBox:   { background: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '10px 14px', borderRadius: '8px', fontSize: '14px' },
  successBox: { background: '#c6f6d5', border: '1px solid #9ae6b4', color: '#276749', padding: '14px 16px', borderRadius: '8px', fontSize: '14px', lineHeight: '1.5', marginBottom: '12px' },
  hint:       { color: '#718096', fontSize: '13px', margin: '0 0 16px 0' },
};
