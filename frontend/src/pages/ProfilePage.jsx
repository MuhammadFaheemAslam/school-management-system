import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function ProfilePage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm]         = useState({ first_name: '', last_name: '', middle_name: '', email: '' });
  const [saving, setSaving]     = useState(false);
  const [saveMsg, setSaveMsg]   = useState(null);   // { ok, text }
  const [errors, setErrors]     = useState({});

  const [uploading, setUploading] = useState(false);
  const [photoMsg, setPhotoMsg]   = useState(null);
  const fileRef = useRef();

  // Password change
  const [pwForm, setPwForm]     = useState({ new_password: '', confirm_password: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg]       = useState(null);
  const [showPw, setShowPw]     = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ first_name: user.first_name || '', last_name: user.last_name || '', middle_name: user.middle_name || '', email: user.email || '' });
    }
  }, [user]);

  const initials = user
    ? ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase() || user.username?.[0]?.toUpperCase()
    : '?';

  const joinDate = user?.date_joined
    ? new Date(user.date_joined).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  // ── Save profile info ──────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setErrors({});
    setSaveMsg(null);
    setSaving(true);
    try {
      const res = await api.patch('/auth/update-profile/', form);
      login(res.data);   // update AuthContext + localStorage
      setSaveMsg({ ok: true, text: 'Profile updated successfully.' });
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') setErrors(data);
      else setSaveMsg({ ok: false, text: 'Failed to save changes.' });
    } finally {
      setSaving(false);
    }
  };

  // ── Upload photo ───────────────────────────────────────────────────────────
  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setPhotoMsg(null);
    const fd = new FormData();
    fd.append('photo', file);
    try {
      const res = await api.post('/auth/upload-photo/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      login({ ...user, profile_photo: res.data.profile_photo });
      setPhotoMsg({ ok: true, text: 'Photo updated.' });
    } catch (err) {
      setPhotoMsg({ ok: false, text: err.response?.data?.error || 'Upload failed.' });
    } finally {
      setUploading(false);
    }
  };

  // ── Change password ────────────────────────────────────────────────────────
  const handlePwSave = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwMsg({ ok: false, text: 'Passwords do not match.' }); return;
    }
    if (pwForm.new_password.length < 8) {
      setPwMsg({ ok: false, text: 'Password must be at least 8 characters.' }); return;
    }
    setPwSaving(true);
    try {
      await api.post('/auth/change-password/', pwForm);
      setPwMsg({ ok: true, text: 'Password changed successfully.' });
      setPwForm({ new_password: '', confirm_password: '' });
    } catch (err) {
      setPwMsg({ ok: false, text: err.response?.data?.detail || 'Failed to change password.' });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <button onClick={() => navigate('/dashboard')} style={s.backBtn}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Dashboard
        </button>
        <h1 style={s.pageTitle}>My Profile</h1>
      </div>

      <div style={s.layout}>

        {/* ── Left: Avatar card ── */}
        <div style={s.avatarCard}>
          <div style={s.avatarWrap}>
            {user?.profile_photo
              ? <img src={user.profile_photo} alt="avatar" style={s.avatarImg} />
              : <div style={s.avatarFallback}>{initials}</div>
            }
            <button style={s.cameraBtn} onClick={() => fileRef.current.click()} title="Change photo">
              {uploading
                ? <span style={s.spin} />
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M23 19C23 20.1046 22.1046 21 21 21H3C1.89543 21 1 20.1046 1 19V8C1 6.89543 1.89543 6 3 6H7L9 3H15L17 6H21C22.1046 6 23 6.89543 23 8V19Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="13" r="4" stroke="white" strokeWidth="2"/>
                  </svg>
              }
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
          </div>

          {photoMsg && <div style={{ ...s.msg, ...(photoMsg.ok ? s.msgOk : s.msgErr) }}>{photoMsg.text}</div>}

          <div style={s.avatarName}>{user?.first_name} {user?.last_name}</div>
          <div style={s.avatarUsername}>@{user?.username}</div>
          <div style={s.roleBadge}>{user?.role?.replace(/_/g, ' ').toUpperCase()}</div>

          <div style={s.metaList}>
            <MetaRow icon="✉️" label="Email" value={user?.email} />
            <MetaRow icon="🗓️" label="Member since" value={joinDate || '—'} />
            <MetaRow icon="🔑" label="Username" value={user?.username} />
            <MetaRow
              icon="🔒"
              label="First login"
              value={user?.is_first_login ? 'Password not changed yet' : 'Password changed'}
              valueColor={user?.is_first_login ? '#dc2626' : '#059669'}
            />
          </div>
        </div>

        {/* ── Right: forms ── */}
        <div style={s.forms}>

          {/* Edit info */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <div style={s.cardIcon}>👤</div>
              <div>
                <div style={s.cardTitle}>Personal Information</div>
                <div style={s.cardSub}>Update your name and email address</div>
              </div>
            </div>

            <form onSubmit={handleSave} style={s.form}>
              <div style={s.row}>
                <Field label="First Name"  value={form.first_name}  onChange={v => setForm(f => ({ ...f, first_name: v }))}  error={errors.first_name}  placeholder="First name" />
                <Field label="Middle Name" value={form.middle_name} onChange={v => setForm(f => ({ ...f, middle_name: v }))} placeholder="Middle name (optional)" />
                <Field label="Last Name"   value={form.last_name}   onChange={v => setForm(f => ({ ...f, last_name: v }))}   error={errors.last_name}   placeholder="Last name" />
              </div>
              <Field label="Email Address" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} error={errors.email} placeholder="your@email.com" />

              <div style={s.readonlyField}>
                <label style={s.label}>Username</label>
                <div style={s.readonlyValue}>
                  <span style={s.lockIcon}>🔒</span>
                  {user?.username}
                  <span style={s.readonlyHint}>Cannot be changed</span>
                </div>
              </div>

              <div style={s.readonlyField}>
                <label style={s.label}>Role</label>
                <div style={s.readonlyValue}>
                  <span style={s.lockIcon}>🛡️</span>
                  {user?.role?.replace(/_/g, ' ').toUpperCase()}
                  <span style={s.readonlyHint}>Assigned by administrator</span>
                </div>
              </div>

              {saveMsg && <div style={{ ...s.msg, ...(saveMsg.ok ? s.msgOk : s.msgErr) }}>{saveMsg.text}</div>}

              <button type="submit" disabled={saving} style={s.saveBtn}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
          </div>

          {/* Change password */}
          <div style={s.card}>
            <div style={s.cardHeader}>
              <div style={s.cardIcon}>🔐</div>
              <div>
                <div style={s.cardTitle}>Change Password</div>
                <div style={s.cardSub}>Use a strong password with at least 8 characters</div>
              </div>
            </div>

            <form onSubmit={handlePwSave} style={s.form}>
              <div style={s.fieldWrap}>
                <label style={s.label}>New Password</label>
                <div style={s.pwWrap}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={pwForm.new_password}
                    onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                    required minLength={8}
                    placeholder="Min. 8 characters"
                    style={s.input}
                  />
                  <button type="button" style={s.eyeBtn} onClick={() => setShowPw(p => !p)}>
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <Field
                label="Confirm Password"
                type={showPw ? 'text' : 'password'}
                value={pwForm.confirm_password}
                onChange={v => setPwForm(f => ({ ...f, confirm_password: v }))}
                placeholder="Repeat new password"
              />

              {/* Strength indicator */}
              {pwForm.new_password && <PasswordStrength password={pwForm.new_password} />}

              {pwMsg && <div style={{ ...s.msg, ...(pwMsg.ok ? s.msgOk : s.msgErr) }}>{pwMsg.text}</div>}

              <button type="submit" disabled={pwSaving} style={{ ...s.saveBtn, background: 'linear-gradient(135deg,#1e3a5f,#1e40af)' }}>
                {pwSaving ? 'Changing…' : 'Change Password'}
              </button>
            </form>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function Field({ label, type = 'text', value, onChange, error, placeholder }) {
  return (
    <div style={s.fieldWrap}>
      <label style={s.label}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ ...s.input, borderColor: error ? '#fca5a5' : '#e2e8f0' }}
      />
      {error && <span style={s.errorText}>{error}</span>}
    </div>
  );
}

function MetaRow({ icon, label, value, valueColor }) {
  return (
    <div style={s.metaRow}>
      <span style={s.metaIcon}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={s.metaLabel}>{label}</div>
        <div style={{ ...s.metaValue, color: valueColor || '#1e293b' }}>{value}</div>
      </div>
    </div>
  );
}

function PasswordStrength({ password }) {
  let score = 0;
  if (password.length >= 8)  score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { label: 'Weak',   color: '#ef4444', bg: '#fecaca' },
    { label: 'Fair',   color: '#f59e0b', bg: '#fde68a' },
    { label: 'Good',   color: '#3b82f6', bg: '#bfdbfe' },
    { label: 'Strong', color: '#10b981', bg: '#a7f3d0' },
  ];
  const lvl = levels[Math.max(0, score - 1)];

  return (
    <div style={{ marginTop: '-8px' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ flex: 1, height: '4px', borderRadius: '4px', background: i < score ? lvl.color : '#e2e8f0', transition: 'background 0.3s' }} />
        ))}
      </div>
      <span style={{ fontSize: '11px', fontWeight: '600', color: lvl.color, background: lvl.bg, padding: '2px 8px', borderRadius: '20px' }}>
        {lvl.label} password
      </span>
    </div>
  );
}

const s = {
  page:    { minHeight: '100vh', background: '#f1f5f9', padding: '28px', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" },

  header:  { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' },
  backBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', color: '#64748b', fontWeight: '500' },
  pageTitle:{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#0f172a' },

  layout:  { display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' },

  // Avatar card
  avatarCard:    { background: '#fff', borderRadius: '16px', padding: '28px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  avatarWrap:    { position: 'relative', marginBottom: '16px' },
  avatarImg:     { width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #e2e8f0' },
  avatarFallback:{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg,#1e40af,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', fontWeight: '700', color: '#fff', border: '3px solid #e2e8f0' },
  cameraBtn:     { position: 'absolute', bottom: '2px', right: '2px', width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#1e40af,#2563eb)', border: '2px solid #fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  spin:          { width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' },
  avatarName:    { fontSize: '18px', fontWeight: '700', color: '#0f172a', textAlign: 'center' },
  avatarUsername:{ fontSize: '13px', color: '#94a3b8', marginBottom: '10px' },
  roleBadge:     { background: '#eff6ff', color: '#2563eb', fontSize: '11px', fontWeight: '700', padding: '4px 12px', borderRadius: '20px', marginBottom: '20px' },
  metaList:      { width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' },
  metaRow:       { display: 'flex', gap: '10px', alignItems: 'flex-start' },
  metaIcon:      { fontSize: '15px', marginTop: '1px', flexShrink: 0 },
  metaLabel:     { fontSize: '10px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' },
  metaValue:     { fontSize: '13px', fontWeight: '500', wordBreak: 'break-all' },

  // Forms
  forms:   { flex: 1, minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '20px' },
  card:    { background: '#fff', borderRadius: '16px', padding: '24px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' },
  cardIcon:   { fontSize: '28px' },
  cardTitle:  { fontSize: '16px', fontWeight: '700', color: '#0f172a' },
  cardSub:    { fontSize: '13px', color: '#94a3b8' },
  form:    { display: 'flex', flexDirection: 'column', gap: '16px' },
  row:     { display: 'flex', gap: '14px' },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 },
  label:   { fontSize: '13px', fontWeight: '600', color: '#374151' },
  input:   { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', color: '#0f172a', outline: 'none', width: '100%', boxSizing: 'border-box' },
  errorText: { fontSize: '12px', color: '#ef4444' },
  readonlyField: { display: 'flex', flexDirection: 'column', gap: '6px' },
  readonlyValue: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#f8fafc', border: '1.5px solid #f1f5f9', borderRadius: '10px', fontSize: '14px', color: '#64748b' },
  lockIcon:   { fontSize: '14px' },
  readonlyHint: { marginLeft: 'auto', fontSize: '11px', color: '#cbd5e1', fontStyle: 'italic' },
  pwWrap:  { position: 'relative', display: 'flex', alignItems: 'center' },
  eyeBtn:  { position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px' },
  msg:     { padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '500' },
  msgOk:   { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' },
  msgErr:  { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' },
  saveBtn: { padding: '12px', background: 'linear-gradient(135deg,#1e40af,#2563eb)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' },
};
