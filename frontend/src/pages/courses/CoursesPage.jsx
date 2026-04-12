import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

// Cycle through these gradient pairs for course cards
const CARD_GRADIENTS = [
  ['#6366f1', '#818cf8'], ['#0891b2', '#22d3ee'], ['#059669', '#34d399'],
  ['#d97706', '#fbbf24'], ['#db2777', '#f472b6'], ['#7c3aed', '#a78bfa'],
  ['#dc2626', '#f87171'], ['#0284c7', '#38bdf8'],
];

function getGradient(index) {
  const [a, b] = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

export default function CoursesPage() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const canManage = ['super_admin', 'school_admin', 'principal'].includes(user?.role);

  const [courses, setCourses]   = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]         = useState({ name: '', description: '' });
  const [sections, setSections] = useState([{ name: 'A', session: '' }]);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [confirmId, setConfirmId]   = useState(null);

  useEffect(() => {
    fetchCourses();
    api.get('/courses/sessions/').then(r => {
      setSessions(r.data);
      const active = r.data.find(s => s.is_active);
      if (active) setSections([{ name: 'A', session: active.id }]);
    });
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await api.get('/courses/');
      setCourses(res.data);
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setError('');
    setForm({ name: '', description: '' });
    const active = sessions.find(s => s.is_active);
    setSections([{ name: 'A', session: active?.id || '' }]);
    setShowModal(true);
  };

  const addSectionRow = () => {
    const active = sessions.find(s => s.is_active);
    const nextLetter = String.fromCharCode(65 + sections.length); // A, B, C…
    setSections(prev => [...prev, { name: nextLetter, session: active?.id || '' }]);
  };

  const updateSection = (i, field, value) =>
    setSections(prev => prev.map((sec, idx) => idx === i ? { ...sec, [field]: value } : sec));

  const removeSection = (i) =>
    setSections(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const courseRes = await api.post('/courses/create/', form);
      const courseId  = courseRes.data.id;
      // Create sections in parallel (skip rows with no session selected)
      const validSections = sections.filter(sec => sec.session);
      await Promise.all(
        validSections.map(sec =>
          api.post('/courses/sections/create/', { name: sec.name, session: sec.session, course: courseId })
        )
      );
      setShowModal(false);
      fetchCourses();
    } catch (err) {
      setError(err.response?.data?.name?.[0] || err.response?.data?.non_field_errors?.[0] || 'Failed to create class.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    setConfirmId(null);
    try {
      await api.delete(`/courses/${id}/`);
      setCourses(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete class.');
    } finally {
      setDeletingId(null);
    }
  };

  const totalSubjects  = courses.reduce((s, c) => s + (c.subjects?.length || 0), 0);
  const totalSections  = courses.reduce((s, c) => s + (c.section_count || 0), 0);

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>Classes</h1>
          <p style={s.pageSubtitle}>Manage grade levels, subjects and class sections</p>
        </div>
        {canManage && (
          <button style={s.addBtn} onClick={openModal}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Class
          </button>
        )}
      </div>

      {/* ── Summary Stats ── */}
      <div style={s.statsRow}>
        {[
          { label: 'Total Classes',  value: courses.length,  color: '#6366f1', icon: '🎓' },
          { label: 'Total Subjects', value: totalSubjects,   color: '#0891b2', icon: '📖' },
          { label: 'Total Sections', value: totalSections,   color: '#059669', icon: '🏫' },
        ].map(stat => (
          <div key={stat.label} style={{ ...s.statCard, borderTop: `3px solid ${stat.color}` }}>
            <span style={s.statEmoji}>{stat.icon}</span>
            <div style={{ ...s.statNum, color: stat.color }}>{stat.value}</div>
            <div style={s.statLabel}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Course Grid ── */}
      {loading ? (
        <div style={s.centerMsg}>
          <Spinner /> <span style={{ color: '#94a3b8', marginLeft: 10 }}>Loading classes…</span>
        </div>
      ) : courses.length === 0 ? (
        <div style={s.emptyState}>
          <div style={s.emptyIcon}>📚</div>
          <h3 style={s.emptyTitle}>No classes yet</h3>
          <p style={s.emptyText}>Create your first class to get started.</p>
          {canManage && (
            <button style={s.addBtn} onClick={openModal}>+ Add First Class</button>
          )}
        </div>
      ) : (
        <div style={s.grid}>
          {courses.map((course, i) => (
            <CourseCard
              key={course.id}
              course={course}
              gradient={getGradient(i)}
              canManage={canManage}
              isDeleting={deletingId === course.id}
              confirmDelete={confirmId === course.id}
              onOpen={() => navigate(`/courses/${course.id}`)}
              onDeleteClick={e => { e.stopPropagation(); setConfirmId(course.id); }}
              onDeleteConfirm={e => { e.stopPropagation(); handleDelete(course.id); }}
              onDeleteCancel={e => { e.stopPropagation(); setConfirmId(null); }}
            />
          ))}
        </div>
      )}

      {/* ── Add Course Modal ── */}
      {showModal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <div style={s.modalIconWrap}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={s.modalTitle}>New Class</h2>
                <p style={s.modalSub}>Add a new grade level to the system</p>
              </div>
              <button style={s.closeBtn} onClick={() => setShowModal(false)}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form style={s.modalForm} onSubmit={handleSubmit}>
              <div style={s.field}>
                <label style={s.label}>Class Name <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  style={s.input}
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Grade 7, Class 1, O-Level…"
                  required
                />
              </div>
              <div style={s.field}>
                <label style={s.label}>Description <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                <textarea
                  style={{ ...s.input, resize: 'none', height: '70px', lineHeight: '1.5' }}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of this course…"
                />
              </div>

              {/* Sections */}
              <div style={s.field}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={s.label}>Sections <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                  <button type="button" style={s.addSectionBtn} onClick={addSectionRow}>+ Add Section</button>
                </div>
                {sections.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>No sections — you can add them later from the class page.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {sections.map((sec, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <div style={s.sectionLetterBadge}>{sec.name || '?'}</div>
                        <input
                          style={{ ...s.input, width: 70, flexShrink: 0, textTransform: 'uppercase' }}
                          value={sec.name}
                          onChange={e => updateSection(i, 'name', e.target.value.toUpperCase())}
                          placeholder="A"
                          maxLength={5}
                        />
                        <select
                          style={{ ...s.input, flex: 1 }}
                          value={sec.session}
                          onChange={e => updateSection(i, 'session', e.target.value)}
                        >
                          <option value="">— Select Session —</option>
                          {sessions.map(sess => (
                            <option key={sess.id} value={sess.id}>
                              {sess.name}{sess.is_active ? ' (Active)' : ''}
                            </option>
                          ))}
                        </select>
                        <button type="button" style={s.removeSectionBtn} onClick={() => removeSection(i)} title="Remove">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && <div style={s.errorBox}>{error}</div>}
              <div style={s.modalActions}>
                <button type="button" style={s.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" disabled={saving} style={{ ...s.submitBtn, opacity: saving ? 0.7 : 1 }}>
                  {saving
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Spinner color="#fff" /> Saving…</span>
                    : `Create Class${sections.filter(s => s.session).length > 0 ? ` + ${sections.filter(s => s.session).length} Section${sections.filter(s => s.session).length > 1 ? 's' : ''}` : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CourseCard({ course, gradient, canManage, isDeleting, confirmDelete, onOpen, onDeleteClick, onDeleteConfirm, onDeleteCancel }) {
  return (
    <div style={s.card} onClick={onOpen}>
      {/* Gradient top banner */}
      <div style={{ ...s.cardBanner, background: gradient }}>
        <div style={s.cardBannerIcon}>🎓</div>
        <h3 style={s.cardName}>{course.name}</h3>
      </div>

      {/* Body */}
      <div style={s.cardBody}>
        <p style={s.cardDesc}>{course.description || 'No description provided.'}</p>

        {/* Stats chips */}
        <div style={s.cardChips}>
          <span style={s.chip}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {course.subjects?.length || 0} Subjects
          </span>
          <span style={s.chip}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            {course.section_count || 0} Sections
          </span>
        </div>

        {/* Subjects preview */}
        {course.subjects?.length > 0 && (
          <div style={s.subjectPills}>
            {course.subjects.slice(0, 3).map(sub => (
              <span key={sub.id} style={s.subjectPill}>{sub.name}</span>
            ))}
            {course.subjects.length > 3 && (
              <span style={{ ...s.subjectPill, background: '#f1f5f9', color: '#64748b' }}>
                +{course.subjects.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={s.cardFooter}>
          <span style={s.viewLink}>View Details →</span>
          {canManage && !confirmDelete && (
            <button style={s.deleteBtn} onClick={onDeleteClick} disabled={isDeleting}>
              {isDeleting ? '…' : 'Delete'}
            </button>
          )}
          {confirmDelete && (
            <div style={s.confirmRow} onClick={e => e.stopPropagation()}>
              <span style={s.confirmText}>Sure?</span>
              <button style={s.confirmYes} onClick={onDeleteConfirm}>Yes</button>
              <button style={s.confirmNo}  onClick={onDeleteCancel}>No</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Spinner({ color = '#6366f1' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeOpacity="0.25" strokeWidth="4" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

const s = {
  page:        { padding: '28px', background: '#f1f5f9', minHeight: '100%' },
  pageHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  pageTitle:   { margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' },
  pageSubtitle:{ margin: '4px 0 0', fontSize: '14px', color: '#64748b' },
  addBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 20px', background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
    color: '#fff', border: 'none', borderRadius: '10px',
    fontSize: '14px', fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(59,130,246,0.35)',
  },

  statsRow:  { display: 'flex', gap: '14px', marginBottom: '28px', flexWrap: 'wrap' },
  statCard:  { flex: 1, minWidth: '130px', background: '#fff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  statEmoji: { fontSize: '22px' },
  statNum:   { fontSize: '26px', fontWeight: 800, lineHeight: 1 },
  statLabel: { fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },

  centerMsg: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: '#94a3b8' },

  emptyState: { textAlign: 'center', padding: '80px 24px', background: '#fff', borderRadius: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  emptyIcon:  { fontSize: '56px', marginBottom: '12px' },
  emptyTitle: { margin: '0 0 8px', fontSize: '20px', fontWeight: 700, color: '#1e293b' },
  emptyText:  { margin: '0 0 20px', color: '#64748b' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '20px' },

  card: {
    background: '#fff', borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    cursor: 'pointer', overflow: 'hidden',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  cardBanner: { padding: '24px 20px 20px', position: 'relative' },
  cardBannerIcon: { fontSize: '28px', marginBottom: '8px' },
  cardName: { margin: 0, fontSize: '18px', fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.2)' },
  cardBody: { padding: '16px 20px 18px' },
  cardDesc: { margin: '0 0 12px', fontSize: '13px', color: '#64748b', lineHeight: '1.5', minHeight: '38px' },

  cardChips: { display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '4px 10px', background: '#f1f5f9', borderRadius: '20px',
    fontSize: '12px', fontWeight: 600, color: '#475569',
  },

  subjectPills: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' },
  subjectPill: { padding: '3px 9px', background: '#eff6ff', color: '#3b82f6', borderRadius: '20px', fontSize: '11px', fontWeight: 600, border: '1px solid #bfdbfe' },

  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' },
  viewLink: { fontSize: '13px', color: '#3b82f6', fontWeight: 600 },
  deleteBtn: { background: 'none', border: '1px solid #fecaca', color: '#ef4444', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 },
  confirmRow: { display: 'flex', alignItems: 'center', gap: '6px' },
  confirmText: { fontSize: '12px', color: '#ef4444', fontWeight: 600 },
  confirmYes: { padding: '3px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 },
  confirmNo:  { padding: '3px 10px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '5px', fontSize: '12px', cursor: 'pointer' },

  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  modal: { background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '460px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden' },
  modalHeader: { background: 'linear-gradient(135deg, #1e40af, #3b82f6)', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '14px' },
  modalIconWrap: { width: 40, height: 40, background: 'rgba(255,255,255,0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  modalTitle: { margin: 0, fontSize: '17px', fontWeight: 700, color: '#fff' },
  modalSub: { margin: '3px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.75)' },
  closeBtn: { background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },

  modalForm: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '13px', fontWeight: 600, color: '#374151' },
  input: { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  cancelBtn: { padding: '10px 20px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  submitBtn: { padding: '10px 24px', background: 'linear-gradient(135deg, #1e40af, #3b82f6)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },

  addSectionBtn: { padding: '5px 12px', background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  sectionLetterBadge: { width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 },
  removeSectionBtn: { width: 28, height: 28, background: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 },
};
