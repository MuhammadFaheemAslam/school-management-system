import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export default function CourseDetailPage() {
  const { id }    = useParams();
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const canManage = ['super_admin', 'school_admin', 'principal'].includes(user?.role);

  const [course,   setCourse]   = useState(null);
  const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const [subjectForm,    setSubjectForm]    = useState({ name: '', code: '' });
  const [sectionForm,    setSectionForm]    = useState({ name: 'A', session: '', class_teacher: '' });
  const [savingSubject,  setSavingSubject]  = useState(false);
  const [savingSection,  setSavingSection]  = useState(false);
  const [subjectError,   setSubjectError]   = useState('');
  const [sectionError,   setSectionError]   = useState('');
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [showSectionForm, setShowSectionForm] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/courses/${id}/`),
      api.get(`/courses/sections/?course=${id}`),
      api.get('/courses/sessions/'),
    ]).then(([cRes, sRes, sessRes]) => {
      setCourse(cRes.data);
      setSections(sRes.data);
      setSessions(sessRes.data);
      // Pre-select the active session
      const active = sessRes.data.find(s => s.is_active);
      if (active) setSectionForm(f => ({ ...f, session: active.id }));
    }).finally(() => setLoading(false));

    if (canManage) api.get('/teachers/').then(r => setTeachers(r.data));
  }, [id]);

  const handleAddSubject = async (e) => {
    e.preventDefault();
    setSubjectError('');
    setSavingSubject(true);
    try {
      await api.post('/courses/subjects/create/', { ...subjectForm, course: id });
      setSubjectForm({ name: '', code: '' });
      setShowSubjectForm(false);
      const res = await api.get(`/courses/${id}/`);
      setCourse(res.data);
    } catch (err) {
      const d = err.response?.data;
      setSubjectError(d?.name?.[0] || d?.code?.[0] || d?.non_field_errors?.[0] || 'Failed to add subject.');
    } finally {
      setSavingSubject(false);
    }
  };

  const handleAddSection = async (e) => {
    e.preventDefault();
    setSectionError('');
    setSavingSection(true);
    try {
      const payload = { ...sectionForm, course: id };
      if (!payload.class_teacher) delete payload.class_teacher;
      await api.post('/courses/sections/create/', payload);
      const active = sessions.find(s => s.is_active);
      setSectionForm({ name: 'A', session: active?.id || '', class_teacher: '' });
      setShowSectionForm(false);
      const res = await api.get(`/courses/sections/?course=${id}`);
      setSections(res.data);
    } catch (err) {
      const d = err.response?.data;
      setSectionError(d?.non_field_errors?.[0] || d?.name?.[0] || 'Failed to add section.');
    } finally {
      setSavingSection(false);
    }
  };

  const deleteSubject = async (subjectId) => {
    if (!window.confirm('Delete this subject?')) return;
    try {
      await api.delete(`/courses/subjects/${subjectId}/`);
      const res = await api.get(`/courses/${id}/`);
      setCourse(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete subject.');
    }
  };

  const deleteSection = async (sectionId) => {
    if (!window.confirm('Delete this section?')) return;
    try {
      await api.delete(`/courses/sections/${sectionId}/`);
      setSections(prev => prev.filter(s => s.id !== sectionId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete section.');
    }
  };

  if (loading) return (
    <div style={s.page}>
      <div style={s.loadingWrap}>
        <Spinner size={28} color="#3b82f6" />
        <p style={{ color: '#94a3b8', marginTop: 12 }}>Loading class…</p>
      </div>
    </div>
  );

  if (!course) return (
    <div style={s.page}>
      <div style={s.loadingWrap}>
        <p style={{ color: '#94a3b8' }}>Class not found.</p>
        <button style={s.backBtn} onClick={() => navigate('/courses')}>← Back to Classes</button>
      </div>
    </div>
  );

  const totalStudents = sections.reduce((sum, sec) => sum + (sec.student_count || 0), 0);

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <div style={s.pageHeader}>
        <button style={s.backBtn} onClick={() => navigate('/courses')}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Classes
        </button>
        <div style={s.headerCenter}>
          <h1 style={s.pageTitle}>{course.name}</h1>
          {course.description && <p style={s.pageSubtitle}>{course.description}</p>}
        </div>
      </div>

      {/* ── Quick Stats ── */}
      <div style={s.statsRow}>
        {[
          { label: 'Subjects',  value: course.subjects?.length || 0, color: '#6366f1', icon: '📖' },
          { label: 'Sections',  value: sections.length,              color: '#0891b2', icon: '🏫' },
          { label: 'Students',  value: totalStudents,                color: '#059669', icon: '🎓' },
        ].map(stat => (
          <div key={stat.label} style={{ ...s.statCard, borderTop: `3px solid ${stat.color}` }}>
            <span style={s.statEmoji}>{stat.icon}</span>
            <div style={{ ...s.statNum, color: stat.color }}>{stat.value}</div>
            <div style={s.statLabel}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Two Column Layout ── */}
      <div style={s.layout}>

        {/* ── Subjects Panel ── */}
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <div style={s.panelTitleRow}>
              <div style={{ ...s.panelIcon, background: '#eff6ff' }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <h2 style={s.panelTitle}>Subjects</h2>
                <p style={s.panelSub}>{course.subjects?.length || 0} subjects in this class</p>
              </div>
            </div>
            {canManage && (
              <button style={s.panelAddBtn} onClick={() => { setSubjectError(''); setShowSubjectForm(v => !v); }}>
                {showSubjectForm ? '✕ Cancel' : '+ Add Subject'}
              </button>
            )}
          </div>

          {/* Inline Add Subject Form */}
          {showSubjectForm && (
            <form style={s.inlineForm} onSubmit={handleAddSubject}>
              <div style={s.inlineRow}>
                <input style={s.inlineInput} value={subjectForm.name} onChange={e => setSubjectForm({ ...subjectForm, name: e.target.value })} placeholder="Subject name *" required />
                <input style={{ ...s.inlineInput, width: '120px', flexShrink: 0 }} value={subjectForm.code} onChange={e => setSubjectForm({ ...subjectForm, code: e.target.value })} placeholder="Code *" required />
                <button type="submit" disabled={savingSubject} style={s.inlineSubmit}>
                  {savingSubject ? <Spinner color="#fff" /> : 'Add'}
                </button>
              </div>
              {subjectError && <p style={s.err}>{subjectError}</p>}
            </form>
          )}

          {/* Subject List */}
          {!course.subjects?.length ? (
            <div style={s.emptyPanel}>
              <span style={{ fontSize: 32 }}>📖</span>
              <p>No subjects yet. Add one above.</p>
            </div>
          ) : (
            <div style={s.itemList}>
              {course.subjects.map((sub, i) => (
                <div key={sub.id} style={s.subjectItem}>
                  <div style={s.subjectIndex}>{i + 1}</div>
                  <div style={s.subjectInfo}>
                    <span style={s.subjectName}>{sub.name}</span>
                    <code style={s.subjectCode}>{sub.code}</code>
                  </div>
                  {canManage && (
                    <button style={s.delBtn} onClick={() => deleteSubject(sub.id)} title="Delete subject">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Sections Panel ── */}
        <div style={s.panel}>
          <div style={s.panelHeader}>
            <div style={s.panelTitleRow}>
              <div style={{ ...s.panelIcon, background: '#ecfdf5' }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h2 style={s.panelTitle}>Sections</h2>
                <p style={s.panelSub}>{sections.length} class sections</p>
              </div>
            </div>
            {canManage && (
              <button style={{ ...s.panelAddBtn, background: '#ecfdf5', color: '#059669', border: '1.5px solid #6ee7b7' }}
                onClick={() => { setSectionError(''); setShowSectionForm(v => !v); }}>
                {showSectionForm ? '✕ Cancel' : '+ Add Section'}
              </button>
            )}
          </div>

          {/* Inline Add Section Form */}
          {showSectionForm && (
            <form style={s.inlineForm} onSubmit={handleAddSection}>
              <div style={s.inlineRow}>
                <input style={{ ...s.inlineInput, width: '80px', flexShrink: 0 }} value={sectionForm.name} onChange={e => setSectionForm({ ...sectionForm, name: e.target.value })} placeholder="Section *" required />
                <select style={s.inlineInput} value={sectionForm.session} onChange={e => setSectionForm({ ...sectionForm, session: e.target.value })} required>
                  <option value="">— Select Session *—</option>
                  {sessions.map(sess => (
                    <option key={sess.id} value={sess.id}>
                      {sess.name}{sess.is_active ? ' (Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div style={s.inlineRow}>
                <select style={s.inlineInput} value={sectionForm.class_teacher} onChange={e => setSectionForm({ ...sectionForm, class_teacher: e.target.value })}>
                  <option value="">No class teacher (optional)</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name} — {t.employee_id}</option>)}
                </select>
                <button type="submit" disabled={savingSection} style={{ ...s.inlineSubmit, background: 'linear-gradient(135deg,#059669,#34d399)', flexShrink: 0 }}>
                  {savingSection ? <Spinner color="#fff" /> : 'Add'}
                </button>
              </div>
              {sectionError && <p style={s.err}>{sectionError}</p>}
            </form>
          )}

          {/* Section List */}
          {!sections.length ? (
            <div style={s.emptyPanel}>
              <span style={{ fontSize: 32 }}>🏫</span>
              <p>No sections yet. Add one above.</p>
            </div>
          ) : (
            <div style={s.itemList}>
              {sections.map(sec => (
                <div key={sec.id} style={s.sectionItem}>
                  <div style={s.sectionBadge}>
                    {sec.name}
                  </div>
                  <div style={s.sectionInfo}>
                    <div style={s.sectionName}>Section {sec.name}</div>
                    <div style={s.sectionMeta}>
                      <span style={s.metaChip}>📅 {sec.session_name || '—'}</span>
                      <span style={s.metaChip}>👩‍🏫 {sec.class_teacher_name || 'No teacher'}</span>
                      <span style={s.metaChip}>🎓 {sec.student_count || 0} students</span>
                    </div>
                  </div>
                  {canManage && (
                    <button style={s.delBtn} onClick={() => deleteSection(sec.id)} title="Delete section">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function Spinner({ size = 14, color = '#3b82f6' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeOpacity="0.25" strokeWidth="4" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

const s = {
  page:       { padding: '28px', background: '#f1f5f9', minHeight: '100%' },
  loadingWrap:{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px' },

  pageHeader: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' },
  backBtn: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '9px 16px', background: '#fff', border: '1.5px solid #e2e8f0',
    borderRadius: '9px', cursor: 'pointer', fontSize: '14px', color: '#475569', fontWeight: 600,
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  headerCenter: { flex: 1 },
  pageTitle:    { margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' },
  pageSubtitle: { margin: '4px 0 0', fontSize: '14px', color: '#64748b' },

  statsRow:  { display: 'flex', gap: '14px', marginBottom: '24px', flexWrap: 'wrap' },
  statCard:  { flex: 1, minWidth: '120px', background: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  statEmoji: { fontSize: '22px' },
  statNum:   { fontSize: '26px', fontWeight: 800, lineHeight: 1 },
  statLabel: { fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },

  layout: { display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' },

  // Panel
  panel: { flex: 1, minWidth: '300px', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', overflow: 'hidden' },
  panelHeader: { padding: '18px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' },
  panelTitleRow: { display: 'flex', alignItems: 'center', gap: '12px' },
  panelIcon: { width: 38, height: 38, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  panelTitle: { margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' },
  panelSub:   { margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' },
  panelAddBtn: { padding: '7px 14px', background: '#eff6ff', color: '#3b82f6', border: '1.5px solid #bfdbfe', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },

  // Inline form
  inlineForm: { padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '10px' },
  inlineRow:  { display: 'flex', gap: '8px', alignItems: 'center' },
  inlineInput: { flex: 1, padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'inherit', background: '#fff' },
  inlineSubmit: { padding: '9px 18px', background: 'linear-gradient(135deg,#1e40af,#3b82f6)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 },
  err: { margin: 0, fontSize: '12px', color: '#ef4444' },

  // Lists
  itemList: { display: 'flex', flexDirection: 'column' },
  emptyPanel: { padding: '40px 20px', textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },

  // Subject item
  subjectItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 20px', borderBottom: '1px solid #f8fafc' },
  subjectIndex: { width: 26, height: 26, borderRadius: '50%', background: '#eff6ff', color: '#3b82f6', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  subjectInfo: { flex: 1, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  subjectName: { fontWeight: 600, fontSize: '14px', color: '#1e293b' },
  subjectCode: { background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontFamily: 'monospace' },

  // Section item
  sectionItem: { display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '14px 20px', borderBottom: '1px solid #f8fafc' },
  sectionBadge: { width: 36, height: 36, background: 'linear-gradient(135deg,#059669,#34d399)', borderRadius: '10px', color: '#fff', fontWeight: 800, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sectionInfo: { flex: 1 },
  sectionName: { fontWeight: 700, fontSize: '14px', color: '#1e293b', marginBottom: '6px' },
  sectionMeta: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  metaChip: { fontSize: '12px', color: '#64748b', background: '#f8fafc', padding: '2px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' },

  delBtn: { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '5px', display: 'flex', alignItems: 'center', flexShrink: 0, transition: 'color 0.15s' },
};
