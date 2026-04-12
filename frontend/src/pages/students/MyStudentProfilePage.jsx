import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export default function MyStudentProfilePage() {
  const navigate = useNavigate();
  const { user, getMe } = useAuth();
  const fileRef = useRef();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoMsg, setPhotoMsg]             = useState('');

  useEffect(() => {
    api.get('/students/me/')
      .then(r => setProfile(r.data))
      .catch(() => setError('Could not load profile. Please contact your administrator.'))
      .finally(() => setLoading(false));
  }, []);

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoUploading(true);
    setPhotoMsg('');
    const fd = new FormData();
    fd.append('photo', file);
    try {
      await api.post('/auth/upload-photo/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await getMe();
      setPhotoMsg('Photo updated successfully.');
    } catch (err) {
      setPhotoMsg(err.response?.data?.error || 'Upload failed.');
    } finally {
      setPhotoUploading(false);
    }
  };

  if (loading) return <div style={styles.container}><p>Loading your profile...</p></div>;
  if (error) return <div style={styles.container}><div style={styles.errorBox}>{error}</div></div>;
  if (!profile) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>&larr; Dashboard</button>
        <h2 style={styles.title}>My Profile</h2>
      </div>

      <div style={styles.layout}>
        {/* Identity card */}
        <div style={styles.idCard}>
          {/* Profile photo */}
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            {user?.profile_photo
              ? <img src={user.profile_photo} alt="Profile" style={styles.avatarImg} />
              : <div style={styles.avatarLarge}>{profile.full_name[0]?.toUpperCase()}</div>
            }
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
            <button onClick={() => fileRef.current.click()} disabled={photoUploading}
              style={styles.photoBtn}>{photoUploading ? 'Uploading…' : 'Change Photo'}</button>
            {photoMsg && <p style={{ fontSize: '12px', color: '#276749', margin: '4px 0 0' }}>{photoMsg}</p>}
          </div>
          <h3 style={styles.name}>{profile.full_name}</h3>
          <p style={styles.email}>{profile.email}</p>
          <span style={styles.badge}>Student</span>
          <div style={styles.divider} />
          <Row label="Admission No." value={profile.admission_number} mono />
          <Row label="Enrolled On" value={profile.enrollment_date} />
          <Row label="Status" value={profile.is_active ? 'Active' : 'Inactive'} />
        </div>

        {/* Details */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div style={styles.card}>
            <h4 style={styles.sectionTitle}>Academic Details</h4>
            <Row label="Class Section" value={profile.class_section_name || 'Not assigned'} />
            <Row label="Parent / Guardian" value={profile.parent_name || 'Not assigned'} />
          </div>

          <div style={styles.card}>
            <h4 style={styles.sectionTitle}>Personal Details</h4>
            <Row label="Date of Birth" value={profile.date_of_birth || '—'} />
            <Row label="Gender" value={profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : '—'} />
            <Row label="Phone" value={profile.phone_number || '—'} />
            <Row label="Address" value={profile.address || '—'} />
          </div>

        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: '1px solid #f7f7f7' }}>
      <span style={{ fontSize: '13px', color: '#718096', flexShrink: 0, marginRight: '16px' }}>{label}</span>
      <span style={{ fontSize: '14px', fontWeight: '600', color: '#2d3748', fontFamily: mono ? 'monospace' : 'inherit', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f0f2f5', padding: '24px' },
  header: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' },
  backBtn: { padding: '8px 14px', background: '#fff', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  title: { margin: 0, fontSize: '22px', color: '#1a1a2e' },
  errorBox: { background: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '16px', borderRadius: '8px' },
  layout: { display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' },
  idCard: { background: '#fff', padding: '28px 24px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', minWidth: '220px', maxWidth: '260px' },
  avatarImg:   { width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #c6f6d5', display: 'block', margin: '0 auto' },
  avatarLarge: { width: '72px', height: '72px', borderRadius: '50%', background: '#c6f6d5', color: '#276749', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: '700', margin: '0 auto' },
  photoBtn:    { marginTop: '8px', padding: '5px 12px', background: '#f7fafc', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },
  name: { margin: '0 0 4px 0', textAlign: 'center', fontSize: '18px', color: '#1a1a2e' },
  email: { margin: '0 0 8px 0', textAlign: 'center', color: '#718096', fontSize: '13px' },
  badge: { display: 'block', margin: '0 auto 4px', background: '#c6f6d5', color: '#276749', padding: '2px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', width: 'fit-content' },
  divider: { height: '1px', background: '#f0f0f0', margin: '14px 0' },
  card: { background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' },
  sectionTitle: { margin: '0 0 8px 0', fontSize: '15px', color: '#2d3748', fontWeight: '700' },
};
