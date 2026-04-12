import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const today = new Date();
today.setHours(0, 0, 0, 0);

function sessionStatus(sess) {
  if (sess.is_active) return 'active';
  const start = new Date(sess.start_date);
  const end   = new Date(sess.end_date);
  if (start > today) return 'upcoming';
  if (end < today)   return 'past';
  return 'inactive';
}

const STATUS_META = {
  active:   { label: 'Current',  color: '#059669', bg: '#f0fdf4', border: '#86efac', dot: '#059669' },
  upcoming: { label: 'Upcoming', color: '#0284c7', bg: '#eff6ff', border: '#93c5fd', dot: '#0284c7' },
  inactive: { label: 'Inactive', color: '#d97706', bg: '#fffbeb', border: '#fcd34d', dot: '#d97706' },
  past:     { label: 'Past',     color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', dot: '#94a3b8' },
};

const emptyForm = { name: '', start_date: '', end_date: '', is_active: false };

export default function SessionsPage() {
  const { user } = useAuth();
  const canManage = ['super_admin', 'school_admin', 'principal'].includes(user?.role);

  const [sessions,       setSessions]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [showModal,      setShowModal]      = useState(false);
  const [editSession,    setEditSession]    = useState(null);
  const [form,           setForm]           = useState(emptyForm);
  const [saving,         setSaving]         = useState(false);
  const [errors,         setErrors]         = useState({});
  const [confirmDelete,  setConfirmDelete]  = useState(null);   // session to delete
  const [confirmActivate,setConfirmActivate]= useState(null);   // session to activate
  const [activating,     setActivating]     = useState(null);
  const [expandedId,     setExpandedId]     = useState(null);   // session card expanded
  const [sectionMap,     setSectionMap]     = useState({});     // sessionId → sections[]
  const [loadingSections,setLoadingSections]= useState(null);

  useEffect(() => { fetchSessions(); }, []);

  const fetchSessions = async () => {
    try {
      const res = await api.get('/courses/sessions/');
      setSessions(res.data);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (sessId) => {
    if (expandedId === sessId) { setExpandedId(null); return; }
    setExpandedId(sessId);
    if (sectionMap[sessId]) return;   // already loaded
    setLoadingSections(sessId);
    try {
      const res = await api.get(`/courses/sections/?session=${sessId}`);
      setSectionMap(m => ({ ...m, [sessId]: res.data }));
    } finally {
      setLoadingSections(null);
    }
  };

  const openCreate = () => {
    setEditSession(null);
    setForm(emptyForm);
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (sess) => {
    setEditSession(sess);
    setForm({ name: sess.name, start_date: sess.start_date, end_date: sess.end_date, is_active: sess.is_active });
    setErrors({});
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.name.trim())  errs.name       = 'Session name is required.';
    if (!form.start_date)   errs.start_date = 'Start date is required.';
    if (!form.end_date)     errs.end_date   = 'End date is required.';
    if (form.start_date && form.end_date && form.end_date <= form.start_date)
      errs.end_date = 'End date must be after start date.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      if (editSession) {
        await api.put(`/courses/sessions/${editSession.id}/`, form);
      } else {
        await api.post('/courses/sessions/create/', form);
      }
      setShowModal(false);
      fetchSessions();
    } catch (err) {
      setErrors(err.response?.data || { general: 'Failed to save session.' });
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    if (!confirmActivate) return;
    setActivating(confirmActivate.id);
    setConfirmActivate(null);
    try {
      await api.post(`/courses/sessions/${confirmActivate.id}/activate/`);
      fetchSessions();
    } finally {
      setActivating(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/courses/sessions/${confirmDelete.id}/`);
      setSessions(s => s.filter(x => x.id !== confirmDelete.id));
    } catch (err) {
      alert(err.response?.data?.error || 'Could not delete this session.');
    } finally {
      setConfirmDelete(null);
    }
  };

  const sorted = [...sessions].sort((a, b) => {
    const order = { active: 0, upcoming: 1, inactive: 2, past: 3 };
    return (order[sessionStatus(a)] - order[sessionStatus(b)]) || new Date(b.start_date) - new Date(a.start_date);
  });

  const activeSession = sessions.find(s => s.is_active);
  const upcomingCount = sessions.filter(s => sessionStatus(s) === 'upcoming').length;
  const pastCount     = sessions.filter(s => sessionStatus(s) === 'past').length;

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Academic Sessions</h1>
          <p style={s.subtitle}>Manage school years — current, upcoming and past sessions</p>
        </div>
        {canManage && (
          <button style={s.addBtn} onClick={openCreate}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            New Session
          </button>
        )}
      </div>

      {/* ── Summary strip ── */}
      <div style={s.summaryRow}>
        <SummaryCard color="#059669" bg="#f0fdf4" border="#86efac" icon="📅"
          label="Current Session"
          value={activeSession ? activeSession.name : 'None set'}
          sub={activeSession ? `${fmt(activeSession.start_date)} – ${fmt(activeSession.end_date)}` : 'Activate a session to mark it current'}
        />
        <SummaryCard color="#0284c7" bg="#eff6ff" border="#93c5fd" icon="🔮"
          label="Upcoming" value={`${upcomingCount} session${upcomingCount !== 1 ? 's' : ''}`} sub="Scheduled for future"
        />
        <SummaryCard color="#64748b" bg="#f8fafc" border="#e2e8f0" icon="🗂️"
          label="Past Sessions" value={`${pastCount} session${pastCount !== 1 ? 's' : ''}`} sub="Completed school years"
        />
        <SummaryCard color="#7c3aed" bg="#f5f3ff" border="#c4b5fd" icon="📊"
          label="Total" value={sessions.length} sub="All time"
        />
      </div>

      {/* ── Sessions list ── */}
      {loading ? (
        <div style={s.empty}>Loading sessions…</div>
      ) : sorted.length === 0 ? (
        <div style={s.emptyBox}>
          <div style={s.emptyIcon}>📅</div>
          <div style={s.emptyTitle}>No sessions yet</div>
          <div style={s.emptySub}>Create your first academic session to get started.</div>
          {canManage && <button style={s.addBtn} onClick={openCreate}>+ Create Session</button>}
        </div>
      ) : (
        <div style={s.list}>
          {sorted.map(sess => {
            const st   = sessionStatus(sess);
            const meta = STATUS_META[st];
            const isExpanded = expandedId === sess.id;
            const sections   = sectionMap[sess.id] || [];

            // Group sections by course name
            const byClass = sections.reduce((acc, sec) => {
              const key = sec.course_name;
              if (!acc[key]) acc[key] = [];
              acc[key].push(sec);
              return acc;
            }, {});

            return (
              <div key={sess.id} style={{ ...s.card, borderLeft: `4px solid ${meta.color}`, background: st === 'active' ? '#fafffe' : '#fff' }}>

                {/* ── Card header ── */}
                <div style={s.cardHeader}>
                  <div style={s.cardLeft}>
                    <div style={{ ...s.badge, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}` }}>
                      <span style={{ ...s.dot, background: meta.dot }} />
                      {meta.label}
                    </div>
                    <div style={s.sessionName}>{sess.name}</div>
                    <div style={s.dateLine}>
                      {fmt(sess.start_date)} → {fmt(sess.end_date)}
                      <span style={s.duration}>{duration(sess.start_date, sess.end_date)}</span>
                    </div>
                  </div>

                  <div style={s.cardRight}>
                    {/* Stats */}
                    <div style={s.statsRow}>
                      <StatPill icon="🏫" label="Classes"  value={sess.section_count} color={meta.color} />
                      <StatPill icon="🎓" label="Students" value={sess.student_count} color={meta.color} />
                      {st === 'active' && <StatPill icon="📆" label="Days left" value={daysLeft(sess.end_date)} color="#d97706" />}
                      {st === 'upcoming' && <StatPill icon="⏳" label="Starts in" value={`${daysUntil(sess.start_date)}d`} color="#0284c7" />}
                    </div>

                    {/* Actions */}
                    <div style={s.actions}>
                      {/* Expand / collapse sections */}
                      <button
                        style={{ ...s.expandBtn, background: isExpanded ? meta.color : '#f8fafc', color: isExpanded ? '#fff' : '#64748b', border: `1px solid ${isExpanded ? meta.color : '#e2e8f0'}` }}
                        onClick={() => toggleExpand(sess.id)}
                      >
                        {loadingSections === sess.id ? '…' : isExpanded ? '▲ Hide Classes' : '▼ View Classes'}
                      </button>

                      {canManage && st !== 'active' && st !== 'past' && (
                        <button style={s.activateBtn} disabled={activating === sess.id}
                          onClick={() => setConfirmActivate(sess)}>
                          {activating === sess.id ? '…' : '⚡ Set Active'}
                        </button>
                      )}
                      {canManage && (
                        <button style={s.iconBtn} title="Edit" onClick={() => openEdit(sess)}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                      )}
                      {canManage && st !== 'active' && (
                        <button style={{ ...s.iconBtn, color: '#ef4444' }} title="Delete" onClick={() => setConfirmDelete(sess)}>
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Progress bar ── */}
                <div style={s.progressWrap}>
                  <div style={{ ...s.progressBar, width: `${progressPct(sess.start_date, sess.end_date)}%`, background: meta.color + (st === 'past' ? '55' : '') }} />
                </div>
                <div style={s.progressLabels}>
                  <span>{fmt(sess.start_date)}</span>
                  <span style={{ color: meta.color, fontWeight: 600 }}>{progressPct(sess.start_date, sess.end_date)}% complete</span>
                  <span>{fmt(sess.end_date)}</span>
                </div>

                {/* ── Expanded: Classes & Sections ── */}
                {isExpanded && (
                  <div style={s.classesPanel}>
                    <div style={s.classesPanelTitle}>
                      Classes & Sections in {sess.name}
                    </div>
                    {loadingSections === sess.id ? (
                      <div style={s.classesLoading}>Loading classes…</div>
                    ) : Object.keys(byClass).length === 0 ? (
                      <div style={s.classesEmpty}>
                        No classes set up for this session yet.
                        {canManage && <span style={{ color: '#6366f1', marginLeft: 6 }}>Go to Classes to add sections.</span>}
                      </div>
                    ) : (
                      <div style={s.classesGrid}>
                        {Object.entries(byClass).sort(([a],[b]) => a.localeCompare(b)).map(([className, secs]) => (
                          <div key={className} style={s.classCard}>
                            <div style={s.classCardHeader}>
                              <span style={s.classCardIcon}>🏫</span>
                              <span style={s.classCardName}>{className}</span>
                              <span style={s.classCardCount}>{secs.reduce((n, s) => n + (s.student_count || 0), 0)} students</span>
                            </div>
                            <div style={s.sectionsRow}>
                              {secs.map(sec => (
                                <div key={sec.id} style={s.sectionChip}>
                                  <span style={s.sectionChipLetter}>{sec.name || '—'}</span>
                                  <span style={s.sectionChipInfo}>
                                    {sec.student_count} student{sec.student_count !== 1 ? 's' : ''}
                                    {sec.class_teacher_name && <> · {sec.class_teacher_name}</>}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>{editSession ? 'Edit Session' : 'New Academic Session'}</h2>
              <button style={s.closeBtn} onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={s.fieldGroup}>
                <label style={s.label}>Session Name <span style={s.req}>*</span></label>
                <input style={{ ...s.input, ...(errors.name ? s.inputErr : {}) }}
                  value={form.name} placeholder="e.g. 2025-2026"
                  onChange={e => { setForm(f => ({...f, name: e.target.value})); setErrors(er => ({...er, name: ''})); }} />
                {errors.name && <div style={s.fieldErr}>{errors.name}</div>}
                <div style={s.hint}>Typically the school year range, e.g. "2025-2026"</div>
              </div>
              <div style={s.row2}>
                <div style={s.fieldGroup}>
                  <label style={s.label}>Start Date <span style={s.req}>*</span></label>
                  <input type="date" style={{ ...s.input, ...(errors.start_date ? s.inputErr : {}) }}
                    value={form.start_date}
                    onChange={e => { setForm(f => ({...f, start_date: e.target.value})); setErrors(er => ({...er, start_date: ''})); }} />
                  {errors.start_date && <div style={s.fieldErr}>{errors.start_date}</div>}
                </div>
                <div style={s.fieldGroup}>
                  <label style={s.label}>End Date <span style={s.req}>*</span></label>
                  <input type="date" style={{ ...s.input, ...(errors.end_date ? s.inputErr : {}) }}
                    value={form.end_date}
                    onChange={e => { setForm(f => ({...f, end_date: e.target.value})); setErrors(er => ({...er, end_date: ''})); }} />
                  {errors.end_date && <div style={s.fieldErr}>{errors.end_date}</div>}
                </div>
              </div>
              <div style={s.toggleRow}>
                <div>
                  <div style={s.toggleLabel}>⚡ Set as Current Session?</div>
                  <div style={s.toggleSub}>
                    {form.is_active ? 'All other sessions will be deactivated.' : 'Can be activated later.'}
                  </div>
                </div>
                <button type="button"
                  onClick={() => setForm(f => ({...f, is_active: !f.is_active}))}
                  style={{ ...s.toggle, background: form.is_active ? '#059669' : '#e2e8f0', flexShrink: 0 }}>
                  <div style={{ ...s.thumb, transform: form.is_active ? 'translateX(22px)' : 'translateX(2px)' }} />
                </button>
              </div>
              {errors.general && <div style={s.errorBox}>{errors.general}</div>}
              <div style={s.modalBtns}>
                <button type="button" style={s.cancelBtn} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" style={s.saveBtn} disabled={saving}>
                  {saving ? 'Saving…' : editSession ? 'Save Changes' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Activate Confirmation Modal (Fix 3) ── */}
      {confirmActivate && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setConfirmActivate(null)}>
          <div style={{ ...s.modal, maxWidth: 440 }}>
            <div style={s.confirmIconWrap}>⚡</div>
            <h3 style={s.confirmTitle}>Switch to {confirmActivate.name}?</h3>
            <p style={s.confirmText}>
              This will make <strong>{confirmActivate.name}</strong> the active session for the whole school.
            </p>
            <div style={s.confirmImpacts}>
              <div style={s.impactRow}><span style={s.impactIcon}>🎓</span> New student enrollments will be linked to <strong>{confirmActivate.name}</strong></div>
              <div style={s.impactRow}><span style={s.impactIcon}>✅</span> Attendance will be recorded under this session</div>
              <div style={s.impactRow}><span style={s.impactIcon}>📝</span> Exams and fees will reference this session</div>
              <div style={s.impactRow}><span style={s.impactIcon}>⚠️</span> The previous active session will be deactivated</div>
            </div>
            <div style={s.modalBtns}>
              <button style={s.cancelBtn} onClick={() => setConfirmActivate(null)}>Cancel</button>
              <button style={{ ...s.saveBtn, background: '#059669' }} onClick={handleActivate}>
                Yes, Switch to {confirmActivate.name}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {confirmDelete && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setConfirmDelete(null)}>
          <div style={{ ...s.modal, maxWidth: 420 }}>
            <div style={s.confirmIconWrap}>🗑️</div>
            <h3 style={s.confirmTitle}>Delete {confirmDelete.name}?</h3>
            <p style={s.confirmText}>
              This will permanently delete <strong>{confirmDelete.name}</strong>.
              If this session has any classes or student enrollment records, deletion will be blocked.
            </p>
            <div style={s.modalBtns}>
              <button style={s.cancelBtn} onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button style={{ ...s.saveBtn, background: '#ef4444' }} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Helpers ── */
function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}
function duration(start, end) {
  if (!start || !end) return '';
  const months = Math.round((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24 * 30.44));
  return `${months} months`;
}
function daysLeft(end) {
  const d = Math.ceil((new Date(end) - today) / 864e5);
  return d <= 0 ? 'Ended' : `${d}d`;
}
function daysUntil(start) {
  return Math.ceil((new Date(start) - today) / 864e5);
}
function progressPct(start, end) {
  const s = new Date(start), e = new Date(end);
  if (today <= s) return 0;
  if (today >= e) return 100;
  return Math.round(((today - s) / (e - s)) * 100);
}

/* ── Sub-components ── */
function SummaryCard({ color, bg, border, icon, label, value, sub }) {
  return (
    <div style={{ flex: 1, minWidth: 170, background: bg, border: `1.5px solid ${border}`, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 11, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 3 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b' }}>{sub}</div>
    </div>
  );
}
function StatPill({ icon, label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', minWidth: 64 }}>
      <span style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>{icon} {label}</span>
      <span style={{ fontSize: 15, fontWeight: 800, color }}>{value ?? '—'}</span>
    </div>
  );
}

/* ── Styles ── */
const s = {
  page:       { padding: '28px 32px', maxWidth: 1000, margin: '0 auto' },
  header:     { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 },
  title:      { fontSize: 26, fontWeight: 800, color: '#1e293b', margin: 0 },
  subtitle:   { fontSize: 14, color: '#64748b', marginTop: 4 },
  addBtn:     { display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg,#6366f1,#818cf8)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  summaryRow: { display: 'flex', gap: 14, marginBottom: 28, flexWrap: 'wrap' },
  empty:      { textAlign: 'center', color: '#94a3b8', padding: 40 },
  emptyBox:   { textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: 16, border: '2px dashed #e2e8f0' },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 6 },
  emptySub:   { fontSize: 14, color: '#64748b', marginBottom: 20 },

  list:       { display: 'flex', flexDirection: 'column', gap: 16 },
  card:       { borderRadius: 14, padding: '20px 24px', background: '#fff', boxShadow: '0 2px 12px #0000000a', border: '1px solid #f1f5f9' },
  cardHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12 },
  cardLeft:   { display: 'flex', flexDirection: 'column', gap: 6 },
  cardRight:  { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 },

  badge:      { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 },
  dot:        { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  sessionName:{ fontSize: 22, fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em' },
  dateLine:   { fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 },
  duration:   { background: '#f1f5f9', borderRadius: 6, padding: '1px 7px', fontSize: 11, fontWeight: 600, color: '#64748b' },

  statsRow:   { display: 'flex', gap: 8 },
  actions:    { display: 'flex', gap: 6, alignItems: 'center' },
  expandBtn:  { padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s' },
  activateBtn:{ background: '#f0fdf4', color: '#059669', border: '1px solid #86efac', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' },
  iconBtn:    { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 7, padding: '5px 7px', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center' },

  progressWrap:   { height: 5, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginBottom: 4 },
  progressBar:    { height: '100%', borderRadius: 99 },
  progressLabels: { display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginBottom: 0 },

  // Classes panel
  classesPanel:  { marginTop: 16, borderTop: '1.5px solid #f1f5f9', paddingTop: 16 },
  classesPanelTitle: { fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' },
  classesLoading:{ fontSize: 13, color: '#94a3b8' },
  classesEmpty:  { fontSize: 13, color: '#94a3b8', background: '#f8fafc', borderRadius: 8, padding: '10px 14px' },
  classesGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 },
  classCard:     { background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '12px 14px' },
  classCardHeader:{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 },
  classCardIcon: { fontSize: 15 },
  classCardName: { fontSize: 14, fontWeight: 800, color: '#1e293b', flex: 1 },
  classCardCount:{ fontSize: 11, color: '#94a3b8', fontWeight: 600 },
  sectionsRow:   { display: 'flex', flexWrap: 'wrap', gap: 6 },
  sectionChip:   { background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', display: 'flex', flexDirection: 'column' },
  sectionChipLetter: { fontSize: 14, fontWeight: 800, color: '#1e293b' },
  sectionChipInfo:   { fontSize: 10, color: '#94a3b8', marginTop: 1 },

  // Modal
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  modal:      { background: '#fff', borderRadius: 20, padding: '28px 32px', width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.18)' },
  modalHeader:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: 800, color: '#1e293b', margin: 0 },
  closeBtn:   { background: '#f1f5f9', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 14, color: '#64748b' },
  fieldGroup: { marginBottom: 16 },
  label:      { display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 },
  req:        { color: '#ef4444' },
  hint:       { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  input:      { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: '#1e293b' },
  inputErr:   { border: '1.5px solid #fca5a5', background: '#fff5f5' },
  fieldErr:   { fontSize: 12, color: '#ef4444', marginTop: 4 },
  row2:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 },
  toggleRow:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: 10, padding: '12px 16px', border: '1.5px solid #e2e8f0', marginBottom: 20, gap: 12 },
  toggleLabel:{ fontSize: 14, fontWeight: 700, color: '#1e293b' },
  toggleSub:  { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  toggle:     { width: 46, height: 26, borderRadius: 99, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', padding: 0 },
  thumb:      { position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px #0002', transition: 'transform 0.2s' },
  errorBox:   { background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 16 },
  modalBtns:  { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 },
  cancelBtn:  { padding: '10px 20px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  saveBtn:    { padding: '10px 24px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#6366f1,#818cf8)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' },

  // Confirm modals
  confirmIconWrap: { fontSize: 40, textAlign: 'center', marginBottom: 12 },
  confirmTitle:    { fontSize: 18, fontWeight: 800, color: '#1e293b', textAlign: 'center', margin: '0 0 8px' },
  confirmText:     { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 1.6, marginBottom: 16 },
  confirmImpacts:  { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 },
  impactRow:       { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151', lineHeight: 1.4 },
  impactIcon:      { flexShrink: 0, fontSize: 14 },
};
