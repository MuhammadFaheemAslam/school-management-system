import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const DESIGNATION_META = {
  head_teacher:       { label: 'Head Teacher',       bg: '#fef3c7', color: '#92400e', icon: '👑' },
  senior_teacher:     { label: 'Senior Teacher',     bg: '#ede9fe', color: '#6d28d9', icon: '🎓' },
  junior_teacher:     { label: 'Junior Teacher',     bg: '#eff6ff', color: '#1d4ed8', icon: '📚' },
  subject_specialist: { label: 'Subject Specialist', bg: '#ecfdf5', color: '#065f46', icon: '🔬' },
  visiting_teacher:   { label: 'Visiting Teacher',   bg: '#fff7ed', color: '#c2410c', icon: '🔄' },
};

const AVATAR_COLORS = ['#6366f1','#0891b2','#059669','#d97706','#db2777','#7c3aed','#dc2626','#0284c7'];
function avatarColor(name) { return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]; }
function initials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function TeacherDetailPage() {
  const { id }    = useParams();
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const canManage = ['super_admin', 'school_admin', 'principal'].includes(user?.role);
  const isSelf    = user?.role === 'teacher';

  const [teacher,  setTeacher]  = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [form,     setForm]     = useState({});
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');

  useEffect(() => {
    api.get(`/teachers/${id}/`).then(r => {
      setTeacher(r.data);
      setForm({ ...r.data, class_section: r.data.class_teacher_of?.[0]?.id ?? '' });
    }).finally(() => setLoading(false));
    if (canManage) {
      api.get('/courses/subjects/').then(r => setSubjects(r.data));
      api.get('/courses/sections/').then(r => setSections(r.data));
    }
  }, [id]);

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      // Update name/email on user account
      const userFields = {};
      ['first_name','last_name','email'].forEach(k => { if (form[k] !== undefined) userFields[k] = form[k]; });

      // Teachers can only update their own personal/contact fields
      const payload = isSelf && !canManage ? {
        gender: form.gender, date_of_birth: form.date_of_birth || null,
        phone_number: form.phone_number, address: form.address,
        ...userFields,
      } : {
        designation: form.designation, qualification: form.qualification,
        gender: form.gender, date_of_birth: form.date_of_birth || null,
        cnic: form.cnic || null, phone_number: form.phone_number,
        address: form.address, date_of_joining: form.date_of_joining || null,
        is_active: form.is_active,
        subjects: form.subjects,
        basic_salary:        form.basic_salary        || null,
        payment_mode:        form.payment_mode        || 'cash',
        bank_name:           form.bank_name           || '',
        bank_account_number: form.bank_account_number || '',
        ...userFields,
      };
      const res = await api.put(`/teachers/${id}/`, payload);
      const updatedTeacher = res.data;

      // Handle class incharge change — only admins can do this
      if (canManage) {
        const prevSectionId = teacher.class_teacher_of?.[0]?.id;
        const newSectionId  = form.class_section ? Number(form.class_section) : null;

        if (prevSectionId && prevSectionId !== newSectionId) {
          await api.put(`/courses/sections/${prevSectionId}/`, { class_teacher: null });
        }
        if (newSectionId && newSectionId !== prevSectionId) {
          await api.put(`/courses/sections/${newSectionId}/`, { class_teacher: Number(id) });
        }
      }

      // Refresh teacher data to get updated class_teacher_of
      const refreshed = await api.get(`/teachers/${id}/`);
      setTeacher(refreshed.data);
      setForm({ ...refreshed.data, class_section: refreshed.data.class_teacher_of?.[0]?.id ?? '' });
      setEditing(false);
      setSuccess('Profile updated successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const d = err.response?.data;
      setError(d ? (d.error || Object.values(d).flat().join(' ')) : 'Failed to save changes.');
    } finally { setSaving(false); }
  };

  const toggleSubject = (sid) => {
    setForm(f => ({
      ...f,
      subjects: Array.isArray(f.subjects)
        ? (f.subjects.includes(sid) ? f.subjects.filter(x => x !== sid) : [...f.subjects, sid])
        : [sid],
    }));
  };

  if (loading) return <div style={s.center}><div style={s.spinner}/></div>;
  if (!teacher) return <div style={s.center}><p>Teacher not found.</p></div>;

  const des   = DESIGNATION_META[teacher.designation] || DESIGNATION_META.junior_teacher;
  const color = avatarColor(teacher.full_name);
  const selectedSubjectIds = Array.isArray(form.subjects)
    ? form.subjects.map(x => (typeof x === 'object' ? x.id : x))
    : [];

  return (
    <div style={s.page}>
      <style>{`@keyframes slideInToast{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}`}</style>

      {/* Back — only show for admins/principal who came from the teachers list */}
      {canManage && (
        <button style={s.backBtn} onClick={() => navigate('/teachers')}>
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          Teachers
        </button>
      )}

      {/* Hero */}
      <div style={s.hero}>
        <div style={{ ...s.heroAccent, background: `linear-gradient(135deg, ${color}, ${color}cc)` }} />
        <div style={s.heroContent}>
          <div style={{ ...s.heroAvatar, background: color }}>
            {initials(teacher.full_name)}
          </div>
          <div style={s.heroInfo}>
            <div style={s.heroName}>{teacher.full_name}</div>
            <div style={s.heroEmpId}>{teacher.employee_id}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              <span style={{ ...s.badge, background: des.bg, color: des.color }}>{des.icon} {des.label}</span>
              {teacher.qualification && (
                <span style={{ ...s.badge, background: '#f0fdf4', color: '#166534' }}>🎓 {teacher.qualification.toUpperCase()}</span>
              )}
              <span style={{ ...s.badge, ...(teacher.is_active ? { background: '#ecfdf5', color: '#166534' } : { background: '#fef2f2', color: '#991b1b' }) }}>
                {teacher.is_active ? '● Active' : '● Inactive'}
              </span>
            </div>
          </div>
          {(canManage || isSelf) && !editing && (
            <button style={s.editBtn} onClick={() => setEditing(true)}>✏ Edit</button>
          )}
          {editing && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={s.saveBtn} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : '✓ Save'}</button>
              <button style={s.cancelBtn} onClick={() => { setEditing(false); setForm(teacher); setError(''); }}>Cancel</button>
            </div>
          )}
        </div>
        {error && <div style={s.errorBanner}>⚠ {error}</div>}
        {success && (
          <div style={s.toast}>
            <div style={s.toastIcon}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="#059669"/>
                <path d="M7 13l3 3 7-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div style={s.toastTitle}>Profile Updated</div>
              <div style={s.toastSub}>Your changes have been saved successfully.</div>
            </div>
          </div>
        )}
      </div>

      {/* Cards grid */}
      <div style={s.grid}>

        {/* Employment */}
        <Card title="Employment Details" icon="💼">
          <Row label="Employee ID">
            <code style={s.code}>{teacher.employee_id}</code>
          </Row>
          <Row label="Designation">
            {editing ? (
              <select style={s.inlineSelect} value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}>
                {Object.entries(DESIGNATION_META).map(([v, m]) => (
                  <option key={v} value={v}>{m.icon} {m.label}</option>
                ))}
              </select>
            ) : <span style={{ ...s.badge, background: des.bg, color: des.color }}>{des.icon} {des.label}</span>}
          </Row>
          <Row label="Date of Joining">
            {editing
              ? <input style={s.inlineInput} type="date" value={form.date_of_joining || ''} onChange={e => setForm(f => ({ ...f, date_of_joining: e.target.value }))} />
              : <span>{teacher.date_of_joining || <Null />}</span>}
          </Row>
          <Row label="Status">
            {editing && canManage ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                <span style={{ fontSize: 13, fontWeight: 600, color: form.is_active ? '#059669' : '#dc2626' }}>
                  {form.is_active ? 'Active' : 'Inactive'}
                </span>
              </label>
            ) : (
              <span style={{ ...s.badge, ...(teacher.is_active ? { background: '#ecfdf5', color: '#166534' } : { background: '#fef2f2', color: '#991b1b' }) }}>
                {teacher.is_active ? '● Active' : '● Inactive'}
              </span>
            )}
          </Row>
        </Card>

        {/* Personal */}
        <Card title="Personal Information" icon="👤">
          <Row label="Full Name">
            {editing ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...s.inlineInput, flex: 1 }} value={form.first_name || ''} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="First name" />
                <input style={{ ...s.inlineInput, flex: 1 }} value={form.last_name  || ''} onChange={e => setForm(f => ({ ...f, last_name:  e.target.value }))} placeholder="Last name" />
              </div>
            ) : <span>{teacher.full_name}</span>}
          </Row>
          <Row label="Gender">
            {editing ? (
              <select style={s.inlineSelect} value={form.gender || ''} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                <option value="">— Select —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            ) : <span style={{ textTransform: 'capitalize' }}>{teacher.gender || <Null />}</span>}
          </Row>
          <Row label="Date of Birth">
            {editing
              ? <input style={s.inlineInput} type="date" value={form.date_of_birth || ''} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
              : <span>{teacher.date_of_birth || <Null />}</span>}
          </Row>
          <Row label="CNIC">
            {editing && canManage
              ? <input style={s.inlineInput} value={form.cnic || ''} onChange={e => setForm(f => ({ ...f, cnic: e.target.value }))} placeholder="12345-1234567-1" />
              : <span>{teacher.cnic || <Null />}</span>}
          </Row>
          <Row label="Qualification">
            {editing && canManage ? (
              <select style={s.inlineSelect} value={form.qualification || ''} onChange={e => setForm(f => ({ ...f, qualification: e.target.value }))}>
                <option value="">— Select —</option>
                {[['matric','Matric'],['intermediate','Intermediate'],['ba','BA'],['bsc','BSc'],['bed','B.Ed'],['ma','MA'],['msc','MSc'],['med','M.Ed'],['mphil','M.Phil'],['phd','PhD'],['other','Other']].map(([v,l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            ) : <span style={{ textTransform: 'uppercase' }}>{teacher.qualification || <Null />}</span>}
          </Row>
        </Card>

        {/* Contact */}
        <Card title="Contact Details" icon="📞">
          <Row label="Email">
            {editing
              ? <input style={s.inlineInput} type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              : <span>{teacher.email || <Null />}</span>}
          </Row>
          <Row label="Phone">
            {editing
              ? <input style={s.inlineInput} value={form.phone_number || ''} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} placeholder="+92 300 0000000" />
              : <span>{teacher.phone_number || <Null />}</span>}
          </Row>
          <Row label="Address">
            {editing
              ? <textarea style={{ ...s.inlineInput, minHeight: 60, resize: 'vertical' }} value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              : <span>{teacher.address || <Null />}</span>}
          </Row>
        </Card>

        {/* Subjects */}
        <Card title="Assigned Subjects" icon="📚">
          {editing && canManage ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {subjects.map(sub => {
                const on = selectedSubjectIds.includes(sub.id);
                return (
                  <button key={sub.id} type="button" onClick={() => toggleSubject(sub.id)}
                    style={{ ...s.subToggle, ...(on ? s.subToggleOn : {}) }}>
                    {sub.name}
                  </button>
                );
              })}
            </div>
          ) : teacher.subjects_detail?.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {teacher.subjects_detail.map(sub => (
                <span key={sub.id} style={s.subBadge}>{sub.name}
                  {sub.course_name && <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>({sub.course_name})</span>}
                </span>
              ))}
            </div>
          ) : <span style={s.nullVal}>No subjects assigned yet.</span>}
        </Card>

        {/* Salary */}
        <Card title="Salary & Payment" icon="💰">
          {editing && canManage ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Row label="Monthly Basic Salary">
                <input style={s.inlineInput} type="number" min="0" value={form.basic_salary ?? ''}
                  onChange={e => setForm(f => ({ ...f, basic_salary: e.target.value }))} placeholder="e.g. 25000" />
              </Row>
              <Row label="Payment Mode">
                <select style={s.inlineSelect} value={form.payment_mode || 'cash'} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))}>
                  <option value="cash">💵 Cash</option>
                  <option value="bank_transfer">🏦 Bank Transfer</option>
                </select>
              </Row>
              {form.payment_mode === 'bank_transfer' && (
                <>
                  <Row label="Bank Name">
                    <input style={s.inlineInput} value={form.bank_name || ''} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="e.g. HBL, UBL" />
                  </Row>
                  <Row label="Account Number">
                    <input style={s.inlineInput} value={form.bank_account_number || ''} onChange={e => setForm(f => ({ ...f, bank_account_number: e.target.value }))} placeholder="Account number" />
                  </Row>
                </>
              )}
            </div>
          ) : teacher.basic_salary != null ? (
            <>
              <div style={{ background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '1px solid #ddd6fe', borderRadius: 12, padding: '14px 20px', textAlign: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly Salary</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed', marginTop: 4 }}>Rs {Number(teacher.basic_salary).toLocaleString()}</div>
              </div>
              <Row label="Payment Mode"><span>{teacher.payment_mode === 'bank_transfer' ? '🏦 Bank Transfer' : '💵 Cash'}</span></Row>
              {teacher.payment_mode === 'bank_transfer' && teacher.bank_name && (
                <Row label="Bank"><span>{teacher.bank_name}</span></Row>
              )}
              {teacher.payment_mode === 'bank_transfer' && teacher.bank_account_number && (
                <Row label="Account No."><code style={s.code}>{teacher.bank_account_number}</code></Row>
              )}
            </>
          ) : (
            <span style={s.nullVal}>No salary set yet.</span>
          )}
        </Card>

        {/* Class Incharge */}
        <Card title="Class Incharge" icon="🏫">
          {editing && canManage ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <select style={s.inlineSelect} value={form.class_section || ''}
                onChange={e => setForm(f => ({ ...f, class_section: e.target.value }))}>
                <option value="">— Not assigned —</option>
                {sections.map(sec => {
                  const label = [sec.course_name, sec.name ? `Section ${sec.name}` : null, sec.session_name].filter(Boolean).join(' · ');
                  const isCurrent = sec.id === (teacher.class_teacher_of?.[0]?.id);
                  return (
                    <option key={sec.id} value={sec.id}>
                      {label}{sec.class_teacher_name && !isCurrent ? ` (currently: ${sec.class_teacher_name})` : ''}
                    </option>
                  );
                })}
              </select>
              {form.class_section && (() => {
                const sec = sections.find(s => s.id === Number(form.class_section));
                const isCurrent = sec?.id === teacher.class_teacher_of?.[0]?.id;
                return sec?.class_teacher_name && !isCurrent ? (
                  <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', padding: '7px 12px', borderRadius: 8 }}>
                    ⚠ <strong>{sec.class_teacher_name}</strong> is currently incharge of this class. They will be replaced.
                  </div>
                ) : null;
              })()}
            </div>
          ) : teacher.class_teacher_of?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {teacher.class_teacher_of.map(sec => (
                <div key={sec.id} style={s.sectionItem}>
                  <div style={s.sectionDot} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
                      {sec.course_name}{sec.name ? ` — Section ${sec.name}` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{sec.session_name}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <span style={s.nullVal}>Not assigned as class incharge.</span>
          )}
        </Card>

      </div>
    </div>
  );
}

function Card({ title, icon, children }) {
  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <span style={s.cardIcon}>{icon}</span>
        <span style={s.cardTitle}>{title}</span>
      </div>
      <div style={s.cardBody}>{children}</div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      <span style={s.rowVal}>{children}</span>
    </div>
  );
}

function Null() { return <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>—</span>; }

const s = {
  page:   { fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", maxWidth: 1100 },
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 },
  spinner:{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },

  backBtn:{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 14, fontWeight: 600, padding: '0 0 16px', fontFamily: 'inherit' },

  hero:       { background: '#fff', borderRadius: 16, marginBottom: 24, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  heroAccent: { height: 6 },
  heroContent:{ display: 'flex', alignItems: 'flex-start', gap: 18, padding: '24px 28px', flexWrap: 'wrap' },
  heroAvatar: { width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 26, flexShrink: 0 },
  heroInfo:   { flex: 1, minWidth: 200 },
  heroName:   { fontSize: 22, fontWeight: 800, color: '#0f172a' },
  heroEmpId:  { fontSize: 13, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 },
  badge:      { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  editBtn:    { padding: '8px 16px', background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#334155', fontFamily: 'inherit', alignSelf: 'flex-start' },
  saveBtn:    { padding: '8px 16px', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  cancelBtn:  { padding: '8px 14px', background: '#f1f5f9', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#64748b', fontFamily: 'inherit' },
  errorBanner:{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13, padding: '8px 28px', borderTop: '1px solid #fecaca' },
  toast: {
    position: 'fixed', top: 24, right: 24, zIndex: 9999,
    display: 'flex', alignItems: 'center', gap: 14,
    background: '#fff', borderRadius: 14,
    boxShadow: '0 8px 30px rgba(0,0,0,0.14), 0 2px 8px rgba(5,150,105,0.15)',
    border: '1.5px solid #a7f3d0',
    padding: '16px 20px',
    minWidth: 280,
    animation: 'slideInToast 0.3s cubic-bezier(0.34,1.56,0.64,1)',
  },
  toastIcon: { flexShrink: 0 },
  toastTitle: { fontSize: 14, fontWeight: 700, color: '#065f46', marginBottom: 2 },
  toastSub:   { fontSize: 12, color: '#6b7280' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 18 },
  card: { background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid #f1f5f9' },
  cardIcon:   { fontSize: 18 },
  cardTitle:  { fontSize: 14, fontWeight: 700, color: '#0f172a' },
  cardBody:   { padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 12 },

  row:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, minHeight: 28 },
  rowLabel: { fontSize: 13, color: '#64748b', fontWeight: 500, flexShrink: 0, paddingTop: 2 },
  rowVal:   { fontSize: 13, color: '#1e293b', fontWeight: 500, textAlign: 'right', flex: 1 },
  nullVal:  { color: '#cbd5e1', fontStyle: 'italic', fontSize: 13 },

  code:        { background: '#f1f5f9', padding: '2px 8px', borderRadius: 5, fontFamily: 'monospace', fontSize: 13, color: '#6d28d9' },
  inlineInput: { padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', color: '#1e293b', width: '100%', boxSizing: 'border-box', outline: 'none' },
  inlineSelect:{ padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', color: '#1e293b', background: '#fff' },

  subBadge:    { background: '#ede9fe', color: '#6d28d9', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  subToggle:   { padding: '5px 12px', borderRadius: 20, border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: 12, fontWeight: 600, color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' },
  subToggleOn: { background: '#ede9fe', border: '1.5px solid #c4b5fd', color: '#6d28d9' },

  sectionItem: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', background: '#f8fafc', borderRadius: 8 },
  sectionDot:  { width: 8, height: 8, borderRadius: '50%', background: '#0891b2', marginTop: 5, flexShrink: 0 },
};
