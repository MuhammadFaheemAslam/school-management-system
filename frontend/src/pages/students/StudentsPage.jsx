import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const AVATAR_COLORS = ['#6366f1','#0891b2','#059669','#d97706','#db2777','#7c3aed','#dc2626','#0284c7'];
function avatarColor(name) { return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]; }
function initials(name) { return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }
function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : '—'; }

const LEAVING_REASONS = [
  { value: 'passout',     label: 'Passed Out',   icon: '🎓' },
  { value: 'left',        label: 'Left School',  icon: '🚶' },
  { value: 'expelled',    label: 'Expelled',     icon: '🚫' },
  { value: 'transferred', label: 'Transferred',  icon: '🔄' },
  { value: 'other',       label: 'Other',        icon: '📝' },
];
const REASON_META = Object.fromEntries(LEAVING_REASONS.map(r => [r.value, r]));

export default function StudentsPage() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const isSuperAdmin = user?.is_superuser || user?.role === 'super_admin';
  const canManage   = isSuperAdmin || ['school_admin', 'principal'].includes(user?.role);
  const isTeacher   = user?.role === 'teacher';

  const [students,      setStudents]      = useState([]);
  const [sections,      setSections]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');

  // Deactivate modal
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateForm,   setDeactivateForm]   = useState({ leaving_reason: '', leaving_note: '', leaving_date: '' });
  const [deactivateErr,    setDeactivateErr]     = useState('');
  const [deactivating,     setDeactivating]      = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  // Re-admit modal
  const [readmitTarget, setReadmitTarget] = useState(null);
  const [readmitForm,   setReadmitForm]   = useState({ session: '', course: '', class_section: '' });
  const [readmitErrors, setReadmitErrors] = useState({});
  const [readmitting,   setReadmitting]   = useState(false);
  const [sessions,      setSessions]      = useState([]);
  const [courses,       setCourses]       = useState([]);

  useEffect(() => {
    fetchStudents();
    if (canManage || user?.role === 'teacher') {
      api.get('/courses/sections/').then(r => setSections(r.data));
      api.get('/courses/sessions/').then(r => setSessions(r.data));
      api.get('/courses/').then(r => setCourses(r.data));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = filterSection ? `?section=${filterSection}` : '';
    api.get(`/students/${params}`).then(r => setStudents(r.data)).finally(() => setLoading(false));
  }, [filterSection]);

  const fetchStudents = () => {
    const params = filterSection ? `?section=${filterSection}` : '';
    api.get(`/students/${params}`).then(r => setStudents(r.data)).finally(() => setLoading(false));
  };

  const openDeactivate = (st, e) => {
    e.stopPropagation();
    setDeactivateTarget(st);
    setDeactivateForm({ leaving_reason: '', leaving_note: '', leaving_date: '' });
    setDeactivateErr('');
  };

  const handleDeactivate = async () => {
    if (!deactivateForm.leaving_reason) { setDeactivateErr('Please select a reason.'); return; }
    setDeactivating(true);
    try {
      const res = await api.post(`/students/${deactivateTarget.id}/deactivate/`, deactivateForm);
      setStudents(prev => prev.map(s => s.id === deactivateTarget.id ? res.data : s));
      setDeactivateTarget(null);
    } catch (err) {
      setDeactivateErr(err.response?.data?.leaving_reason || err.response?.data?.error || 'Failed to deactivate.');
    } finally {
      setDeactivating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/students/${deleteTarget.id}/`);
      setStudents(prev => prev.filter(s => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Could not delete student.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const openReadmit = (st, e) => {
    e.stopPropagation();
    setReadmitTarget(st);
    const activeSession = sessions.find(s => s.is_active);
    setReadmitForm({ session: activeSession?.id || '', course: '', class_section: '' });
    setReadmitErrors({});
  };

  const handleReadmit = async () => {
    const errs = {};
    if (!readmitForm.session) errs.session = 'Select an academic session.';
    if (!readmitForm.course)  errs.course  = 'Select a class.';
    if (Object.keys(errs).length) { setReadmitErrors(errs); return; }
    setReadmitting(true);
    try {
      const res = await api.post(`/students/${readmitTarget.id}/readmit/`, readmitForm);
      setStudents(prev => prev.map(s => s.id === readmitTarget.id ? res.data : s));
      setReadmitTarget(null);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') setReadmitErrors(data);
      else setReadmitErrors({ general: 'Re-admission failed.' });
    } finally {
      setReadmitting(false);
    }
  };

  // Sections filtered for re-admit form
  const readmitSections = sections.filter(sec =>
    String(sec.session) === String(readmitForm.session) &&
    String(sec.course)  === String(readmitForm.course)
  );

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const enr = s.current_enrollment;
    const matchSearch = !q || `${s.full_name} ${s.first_name} ${s.last_name} ${s.admission_number} ${enr?.roll_number || ''}`.toLowerCase().includes(q);
    const matchStatus = isTeacher ? s.is_active : (!filterStatus || (filterStatus === 'active' ? s.is_active : !s.is_active));
    return matchSearch && matchStatus;
  });

  const activeCount = students.filter(s => s.is_active).length;
  const maleCount   = students.filter(s => s.gender === 'male').length;
  const femaleCount = students.filter(s => s.gender === 'female').length;

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>Students</h1>
          <p style={s.pageSubtitle}>Manage enrolled students and their profiles</p>
        </div>
        {canManage && (
          <button style={s.enrollBtn} onClick={() => navigate('/students/enroll')}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Enroll Student
          </button>
        )}
      </div>

      {/* ── Stats ── */}
      <div style={s.statsRow}>
        {[
          { label: 'Total Students', value: students.length, color: '#6366f1', icon: '🎓', bg: '#eef2ff' },
          { label: 'Active',         value: activeCount,     color: '#059669', icon: '✅', bg: '#ecfdf5' },
          { label: 'Male',           value: maleCount,       color: '#0891b2', icon: '👦', bg: '#ecfeff' },
          { label: 'Female',         value: femaleCount,     color: '#db2777', icon: '👧', bg: '#fdf2f8' },
        ].map(stat => (
          <div key={stat.label} style={{ ...s.statCard, borderTop: `3px solid ${stat.color}` }}>
            <div style={{ ...s.statIconBox, background: stat.bg }}>{stat.icon}</div>
            <div>
              <div style={{ ...s.statNum, color: stat.color }}>{stat.value}</div>
              <div style={s.statLabel}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Table Card ── */}
      <div style={s.tableCard}>
        {/* Table Header / Controls */}
        <div style={s.tableHeader}>
          <div>
            <h2 style={s.tableTitle}>All Students</h2>
            <p style={s.tableSub}>{filtered.length} of {students.length} students</p>
          </div>
          <div style={s.controls}>
            <div style={s.searchWrap}>
              <svg style={s.searchIcon} width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
              </svg>
              <input style={s.searchInput} placeholder="Search name, admission no…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {sections.length > 0 && !isTeacher && (
              <select style={s.filterSelect} value={filterSection} onChange={e => setFilterSection(e.target.value)}>
                <option value="">All Classes</option>
                {sections.map(sec => (
                  <option key={sec.id} value={sec.id}>
                    {sec.course_name}{sec.name ? ` — Section ${sec.name}` : ''}{sec.session_name ? ` (${sec.session_name})` : ''}
                  </option>
                ))}
              </select>
            )}
            {!isTeacher && (
              <select style={s.filterSelect} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={s.centerMsg}><Spinner /><span style={{ color: '#94a3b8', marginLeft: 10 }}>Loading students…</span></div>
        ) : filtered.length === 0 ? (
          <div style={s.emptyState}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>🎓</div>
            <p style={{ color: '#94a3b8', margin: 0 }}>{search ? 'No students match your search.' : 'No students enrolled yet.'}</p>
            {search && <button style={s.clearBtn} onClick={() => { setSearch(''); setFilterSection(''); setFilterStatus(''); }}>Clear filters</button>}
          </div>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['#', 'Admission No.', 'Full Name', 'Class', 'Roll No.', 'Gender', 'Status', ''].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((st, i) => {
                  const enr = st.current_enrollment;
                  const className = enr
                    ? enr.course_name + (enr.section_name ? ` · ${enr.section_name}` : '')
                    : null;
                  return (
                    <tr
                      key={st.id}
                      style={{ ...s.tr, background: i % 2 === 0 ? '#fff' : '#fafbfc', cursor: 'pointer' }}
                      onClick={() => navigate(`/students/${st.id}`)}
                    >
                      {/* # */}
                      <td style={{ ...s.td, color: '#94a3b8', fontSize: 12, width: 40 }}>{i + 1}</td>

                      {/* Admission No */}
                      <td style={s.td}><code style={s.mono}>{st.admission_number || '—'}</code></td>

                      {/* Full Name */}
                      <td style={s.td}>
                        <div style={s.nameCell}>
                          <div style={{ ...s.avatar, background: avatarColor(st.first_name) }}>
                            {initials(`${st.first_name || ''} ${st.last_name || ''}`)}
                          </div>
                          <div>
                            <div style={s.studentName}>{st.full_name || `${st.first_name || ''} ${st.last_name || ''}`.trim() || '—'}</div>
                            {st.email && <div style={s.studentEmail}>{st.email}</div>}
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td style={s.td}>
                        {className
                          ? <span style={s.classChip}>{className}</span>
                          : <span style={s.emptyVal}>—</span>}
                      </td>

                      {/* Roll No */}
                      <td style={s.td}>
                        {enr?.roll_number
                          ? <code style={{ ...s.mono, background: '#f0fdf4', color: '#15803d' }}>{enr.roll_number}</code>
                          : <span style={s.emptyVal}>—</span>}
                      </td>

                      {/* Gender */}
                      <td style={s.td}>
                        {st.gender ? (
                          <span style={{ ...s.genderChip, ...(st.gender === 'male' ? s.genderMale : st.gender === 'female' ? s.genderFemale : s.genderOther) }}>
                            {st.gender === 'male' ? '👦' : st.gender === 'female' ? '👧' : '🧑'} {capitalize(st.gender)}
                          </span>
                        ) : <span style={s.emptyVal}>—</span>}
                      </td>

                      {/* Status */}
                      <td style={s.td}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ ...s.statusPill, ...(st.is_active ? s.statusActive : s.statusInactive) }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block', marginRight: 5 }} />
                            {st.is_active ? 'Active' : 'Inactive'}
                          </span>
                          {!st.is_active && st.leaving_reason && (
                            <span style={s.reasonBadge}>
                              {REASON_META[st.leaving_reason]?.icon} {REASON_META[st.leaving_reason]?.label || st.leaving_reason}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={s.td} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          <button style={s.viewBtn} onClick={() => navigate(`/students/${st.id}`)}>View</button>
                          {canManage && st.is_active && (
                            <button style={s.deactivateBtn} onClick={e => openDeactivate(st, e)} title="Mark as inactive">
                              🚫
                            </button>
                          )}
                          {canManage && !st.is_active && (
                            <button style={s.readmitBtn} onClick={e => openReadmit(st, e)} title="Re-admit student">
                              ↩ Re-admit
                            </button>
                          )}
                          {isSuperAdmin && (
                            <button style={s.deleteBtn} onClick={e => { e.stopPropagation(); setDeleteTarget(st); }} title="Delete permanently">
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Deactivate Modal ── */}
      {deactivateTarget && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setDeactivateTarget(null)}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <div style={{ fontSize: 32 }}>🚫</div>
              <div>
                <div style={s.modalTitle}>Mark Student Inactive</div>
                <div style={s.modalSub}>{deactivateTarget.first_name} {deactivateTarget.last_name} · {deactivateTarget.admission_number}</div>
              </div>
              <button style={s.closeBtn} onClick={() => setDeactivateTarget(null)}>✕</button>
            </div>

            <div style={s.modalBody}>
              {/* Reason buttons */}
              <div style={{ marginBottom: 16 }}>
                <label style={s.fieldLabel}>Reason <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {LEAVING_REASONS.map(r => {
                    const active = deactivateForm.leaving_reason === r.value;
                    return (
                      <button key={r.value} type="button"
                        onClick={() => { setDeactivateForm(f => ({...f, leaving_reason: r.value})); setDeactivateErr(''); }}
                        style={{
                          padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          background: active ? '#dc2626' : '#f8fafc',
                          color:      active ? '#fff'    : '#475569',
                          border:     `2px solid ${active ? '#dc2626' : '#e2e8f0'}`,
                        }}>
                        {r.icon} {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date */}
              <div style={{ marginBottom: 16 }}>
                <label style={s.fieldLabel}>Leaving Date</label>
                <input type="date" style={s.input}
                  value={deactivateForm.leaving_date}
                  onChange={e => setDeactivateForm(f => ({...f, leaving_date: e.target.value}))} />
              </div>

              {/* Note */}
              <div style={{ marginBottom: 16 }}>
                <label style={s.fieldLabel}>Additional Note (optional)</label>
                <textarea rows={3} style={{ ...s.input, resize: 'vertical' }}
                  placeholder="e.g. Student passed final exams and graduated…"
                  value={deactivateForm.leaving_note}
                  onChange={e => setDeactivateForm(f => ({...f, leaving_note: e.target.value}))} />
              </div>

              {deactivateErr && <div style={s.errBox}>{deactivateErr}</div>}
            </div>

            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={() => setDeactivateTarget(null)}>Cancel</button>
              <button style={{ ...s.confirmBtn, background: '#dc2626' }} disabled={deactivating} onClick={handleDeactivate}>
                {deactivating ? 'Saving…' : 'Mark Inactive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Re-admit Modal ── */}
      {readmitTarget && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setReadmitTarget(null)}>
          <div style={s.modal}>
            <div style={{ ...s.modalHeader, background: '#f0fdf4' }}>
              <div style={{ fontSize: 32 }}>↩</div>
              <div>
                <div style={s.modalTitle}>Re-admit Student</div>
                <div style={s.modalSub}>{readmitTarget.first_name} {readmitTarget.last_name} · {readmitTarget.admission_number}</div>
              </div>
              <button style={s.closeBtn} onClick={() => setReadmitTarget(null)}>✕</button>
            </div>

            <div style={s.modalBody}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#1d4ed8', marginBottom: 18 }}>
                The student's existing record, admission number, and previous history will be preserved. A new enrollment will be created for the selected session.
              </div>

              {/* Session */}
              <div style={{ marginBottom: 14 }}>
                <label style={s.fieldLabel}>Academic Session <span style={{ color: '#ef4444' }}>*</span></label>
                <select style={{ ...s.input, marginTop: 4 }}
                  value={readmitForm.session}
                  onChange={e => setReadmitForm(f => ({ ...f, session: e.target.value, course: '', class_section: '' }))}>
                  <option value="">— Select session —</option>
                  {sessions.map(sess => (
                    <option key={sess.id} value={sess.id}>{sess.name}{sess.is_active ? ' (Current)' : ''}</option>
                  ))}
                </select>
                {readmitErrors.session && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 3 }}>{readmitErrors.session}</div>}
              </div>

              {/* Class */}
              <div style={{ marginBottom: 14 }}>
                <label style={s.fieldLabel}>Class <span style={{ color: '#ef4444' }}>*</span></label>
                <select style={{ ...s.input, marginTop: 4 }}
                  value={readmitForm.course}
                  onChange={e => {
                    const courseId = e.target.value;
                    const sectionA = sections.find(sec =>
                      String(sec.session) === String(readmitForm.session) &&
                      String(sec.course)  === String(courseId) &&
                      sec.name === 'A'
                    );
                    setReadmitForm(f => ({ ...f, course: courseId, class_section: sectionA?.id || '' }));
                  }}>
                  <option value="">— Select class —</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {readmitErrors.course && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 3 }}>{readmitErrors.course}</div>}
              </div>

              {/* Section (optional) */}
              {readmitForm.course && (
                <div style={{ marginBottom: 14 }}>
                  <label style={s.fieldLabel}>Section <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                  <select style={{ ...s.input, marginTop: 4 }}
                    value={readmitForm.class_section}
                    onChange={e => setReadmitForm(f => ({ ...f, class_section: e.target.value }))}>
                    <option value="">— No section —</option>
                    {readmitSections.map(sec => (
                      <option key={sec.id} value={sec.id}>{sec.name ? `Section ${sec.name}` : sec.display_name}</option>
                    ))}
                  </select>
                </div>
              )}

              {readmitErrors.general && <div style={s.errBox}>{readmitErrors.general}</div>}
            </div>

            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={() => setReadmitTarget(null)}>Cancel</button>
              <button style={{ ...s.confirmBtn, background: '#059669' }} disabled={readmitting} onClick={handleReadmit}>
                {readmitting ? 'Processing…' : '↩ Re-admit Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div style={{ ...s.modal, maxWidth: 420 }}>
            <div style={{ fontSize: 40, textAlign: 'center', marginBottom: 12 }}>⚠️</div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', textAlign: 'center', margin: '0 0 8px' }}>
              Permanently Delete Student?
            </h3>
            <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 1.6, marginBottom: 6 }}>
              <strong>{deleteTarget.first_name} {deleteTarget.last_name}</strong> ({deleteTarget.admission_number})
            </p>
            <p style={{ fontSize: 13, color: '#ef4444', textAlign: 'center', marginBottom: 20, background: '#fef2f2', padding: '10px 14px', borderRadius: 8 }}>
              This will permanently delete the student record, all enrollments, attendance, results and fee records. This cannot be undone.
            </p>
            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button style={{ ...s.confirmBtn, background: '#7f1d1d' }} disabled={deleting} onClick={handleDelete}>
                {deleting ? 'Deleting…' : 'Yes, Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="10" stroke="#94a3b8" strokeOpacity="0.3" strokeWidth="4" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="#6366f1" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

const s = {
  page:        { padding: '28px', background: '#f1f5f9', minHeight: '100%' },
  pageHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  pageTitle:   { margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' },
  pageSubtitle:{ margin: '4px 0 0', fontSize: '14px', color: '#64748b' },
  enrollBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 20px', background: 'linear-gradient(135deg,#059669,#34d399)',
    color: '#fff', border: 'none', borderRadius: 10, fontSize: 14,
    fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(5,150,105,0.35)',
  },

  statsRow:    { display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' },
  statCard:    { flex: 1, minWidth: 130, background: '#fff', borderRadius: 12, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 14 },
  statIconBox: { width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  statNum:     { fontSize: 26, fontWeight: 800, lineHeight: 1 },
  statLabel:   { fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 },

  tableCard:   { background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden' },
  tableHeader: { padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  tableTitle:  { margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' },
  tableSub:    { margin: '2px 0 0', fontSize: 13, color: '#94a3b8' },
  controls:    { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },

  searchWrap:  { position: 'relative' },
  searchIcon:  { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' },
  searchInput: { paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', width: 220, fontFamily: 'inherit' },
  filterSelect:{ padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, background: '#fff', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' },

  centerMsg:   { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 },
  emptyState:  { padding: '60px 24px', textAlign: 'center' },
  clearBtn:    { marginTop: 12, padding: '8px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 13, cursor: 'pointer', color: '#475569' },

  tableWrap: { overflowX: 'auto' },
  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' },
  tr:        { transition: 'background 0.1s' },
  td:        { padding: '13px 16px', fontSize: 14, color: '#1e293b', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle' },

  nameCell:     { display: 'flex', alignItems: 'center', gap: 10 },
  avatar:       { width: 38, height: 38, borderRadius: '50%', color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  studentName:  { fontWeight: 600, color: '#1e293b', fontSize: 14 },
  studentEmail: { color: '#94a3b8', fontSize: 12, marginTop: 1 },
  mono:         { fontFamily: 'monospace', background: '#f1f5f9', padding: '3px 8px', borderRadius: 5, fontSize: 12, color: '#475569' },
  sectionChip:  { background: '#eff6ff', color: '#3b82f6', padding: '3px 9px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: '1px solid #bfdbfe', whiteSpace: 'nowrap' },
  classChip:    { background: '#eff6ff', color: '#1d4ed8', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, border: '1px solid #bfdbfe', whiteSpace: 'nowrap' },
  emptyVal:     { color: '#cbd5e1' },

  genderChip:   { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  genderMale:   { background: '#ecfeff', color: '#0891b2', border: '1px solid #a5f3fc' },
  genderFemale: { background: '#fdf2f8', color: '#db2777', border: '1px solid #fbcfe8' },
  genderOther:  { background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' },

  statusPill:     { display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  statusActive:   { background: '#dcfce7', color: '#15803d' },
  statusInactive: { background: '#fee2e2', color: '#dc2626' },

  viewBtn:       { padding: '5px 12px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  deactivateBtn: { padding: '5px 8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, cursor: 'pointer', fontSize: 14 },
  readmitBtn:    { padding: '5px 10px', background: '#f0fdf4', color: '#059669', border: '1px solid #86efac', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 700 },
  deleteBtn:     { padding: '5px 8px', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 7, cursor: 'pointer', fontSize: 14 },
  reasonBadge:   { fontSize: 11, fontWeight: 600, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' },

  overlay:     { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  modal:       { background: '#fff', borderRadius: 18, width: '100%', maxWidth: 500, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden' },
  modalHeader: { display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#fef2f2' },
  modalTitle:  { fontSize: 16, fontWeight: 800, color: '#1e293b' },
  modalSub:    { fontSize: 12, color: '#64748b', marginTop: 2 },
  closeBtn:    { marginLeft: 'auto', background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#94a3b8', padding: 4 },
  modalBody:   { padding: '20px 24px' },
  modalFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid #f1f5f9' },
  fieldLabel:  { fontSize: 13, fontWeight: 700, color: '#374151' },
  input:       { width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginTop: 4 },
  errBox:      { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626' },
  cancelBtn:   { padding: '9px 20px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#64748b' },
  confirmBtn:  { padding: '9px 22px', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#fff' },
};
