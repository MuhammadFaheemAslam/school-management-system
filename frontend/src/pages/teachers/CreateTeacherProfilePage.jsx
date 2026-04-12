import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const emptyForm = { user: '', employee_id: '', phone_number: '', address: '', date_of_joining: '', subjects: [] };

export default function CreateTeacherProfilePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [users, setUsers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    api.get('/auth/users/').then(r => setUsers(r.data.filter(u => u.role === 'teacher')));
    api.get('/courses/subjects/').then(r => setSubjects(r.data));
  }, []);

  const toggleSubject = (id) => {
    setForm(prev => ({
      ...prev,
      subjects: prev.subjects.includes(id)
        ? prev.subjects.filter(s => s !== id)
        : [...prev.subjects, id],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const res = await api.post('/teachers/create/', form);
      setSuccess(res.data);
      setForm(emptyForm);
    } catch (err) {
      setErrors(err.response?.data || { general: 'Failed to create profile.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/teachers')} style={styles.backBtn}>&larr; Teachers</button>
        <h2 style={styles.title}>Create Teacher Profile</h2>
      </div>

      <div style={styles.layout}>
        <div style={styles.card}>
          <p style={styles.hint}>
            Select a user with the <strong>teacher</strong> role and fill in their employment details.
          </p>

          <form onSubmit={handleSubmit} style={styles.form}>

            <Field label="Teacher User *" error={errors.user}>
              <select name="user" value={form.user} onChange={e => setForm({ ...form, user: e.target.value })} required style={styles.input}>
                <option value="">-- Select teacher user --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.username})</option>
                ))}
              </select>
            </Field>

            <Field label="Employee ID *" error={errors.employee_id}>
              <input value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} required placeholder="e.g. EMP-001" style={styles.input} />
            </Field>

            <div style={styles.row}>
              <Field label="Phone Number" error={errors.phone_number}>
                <input value={form.phone_number} onChange={e => setForm({ ...form, phone_number: e.target.value })} placeholder="+1234567890" style={styles.input} />
              </Field>
              <Field label="Date of Joining" error={errors.date_of_joining}>
                <input type="date" value={form.date_of_joining} onChange={e => setForm({ ...form, date_of_joining: e.target.value })} style={styles.input} />
              </Field>
            </div>

            <Field label="Address" error={errors.address}>
              <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2} placeholder="Home address" style={{ ...styles.input, resize: 'vertical' }} />
            </Field>

            {subjects.length > 0 && (
              <div>
                <label style={styles.label}>Assign Subjects</label>
                <div style={styles.subjectGrid}>
                  {subjects.map(s => (
                    <label key={s.id} style={styles.subjectItem}>
                      <input
                        type="checkbox"
                        checked={form.subjects.includes(s.id)}
                        onChange={() => toggleSubject(s.id)}
                      />
                      {' '}{s.name} <span style={styles.subjectCourse}>({s.course})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {errors.general && <div style={styles.errorBox}>{errors.general}</div>}

            <button type="submit" disabled={loading} style={styles.submitBtn}>
              {loading ? 'Creating...' : 'Create Teacher Profile'}
            </button>
          </form>
        </div>

        {success && (
          <div style={styles.successCard}>
            <div style={styles.successIcon}>✓</div>
            <h3 style={styles.successTitle}>Profile Created!</h3>
            <div style={styles.credBox}>
              <CredRow label="Name" value={success.full_name} />
              <CredRow label="Employee ID" value={success.employee_id} highlight />
              <CredRow label="Subjects" value={success.subjects_detail?.map(s => s.name).join(', ') || '—'} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setSuccess(null)} style={styles.anotherBtn}>Add Another</button>
              <button onClick={() => navigate('/teachers')} style={styles.listBtn}>View All</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
      <label style={{ fontSize: '14px', fontWeight: '600', color: '#333' }}>{label}</label>
      {children}
      {error && <span style={{ color: '#e53e3e', fontSize: '12px' }}>{Array.isArray(error) ? error[0] : error}</span>}
    </div>
  );
}

function CredRow({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '13px', color: '#718096' }}>{label}</span>
      <span style={{ fontSize: '14px', fontWeight: '600', color: highlight ? '#6b46c1' : '#2d3748', background: highlight ? '#e9d8fd' : 'none', padding: highlight ? '2px 8px' : 0, borderRadius: '4px' }}>{value}</span>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f0f2f5', padding: '24px' },
  header: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' },
  backBtn: { padding: '8px 14px', background: '#fff', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  title: { margin: 0, fontSize: '22px', color: '#1a1a2e' },
  layout: { display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' },
  card: { background: '#fff', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', flex: 1, minWidth: '320px', maxWidth: '560px' },
  hint: { color: '#666', fontSize: '14px', marginTop: 0, marginBottom: '20px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  row: { display: 'flex', gap: '16px' },
  input: { padding: '10px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' },
  label: { fontSize: '14px', fontWeight: '600', color: '#333', display: 'block', marginBottom: '8px' },
  subjectGrid: { display: 'flex', flexDirection: 'column', gap: '6px', background: '#f7fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' },
  subjectItem: { fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' },
  subjectCourse: { color: '#718096', fontSize: '12px' },
  errorBox: { background: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '10px 14px', borderRadius: '8px', fontSize: '14px' },
  submitBtn: { padding: '12px', background: '#6b46c1', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' },
  successCard: { background: '#fff', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', minWidth: '280px', maxWidth: '340px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' },
  successIcon: { width: '56px', height: '56px', borderRadius: '50%', background: '#e9d8fd', color: '#6b46c1', fontSize: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  successTitle: { margin: 0, fontSize: '20px', color: '#6b46c1' },
  credBox: { width: '100%', background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
  anotherBtn: { padding: '10px 16px', background: '#6b46c1', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' },
  listBtn: { padding: '10px 16px', background: '#fff', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer' },
};
