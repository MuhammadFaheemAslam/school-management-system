import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present', full: 'Present', color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
  { value: 'absent',  label: 'Absent',  full: 'Absent',  color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
  { value: 'late',    label: 'Late',    full: 'Late',    color: '#d97706', bg: '#fef3c7', border: '#fcd34d' },
  { value: 'leave',   label: 'Leave',   full: 'Leave',   color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd' },
];

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

export default function MarkAttendancePage({ inTab = false, onSwitchToHistory } = {}) {
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const isTeacher  = user?.role === 'teacher';
  const isManagement = ['super_admin', 'school_admin', 'principal'].includes(user?.role);
  const today      = localToday();

  const [sections,        setSections]        = useState([]);
  const [selectedSection, setSelectedSection] = useState(isManagement ? 'all' : '');
  const [sectionStartTime,setSectionStartTime]= useState('08:00');
  const [date,            setDate]            = useState(today);
  const [allRows,         setAllRows]         = useState([]);
  const [marked,          setMarked]          = useState({});
  const [search,          setSearch]          = useState('');
  const [loading,         setLoading]         = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [saved,           setSaved]           = useState(false);
  const [dirty,           setDirty]           = useState(false);
  const [error,           setError]           = useState('');
  const [showMarked,      setShowMarked]      = useState(false);

  // Modal for Late (time) and Leave (note)
  const [modal,     setModal]     = useState(null);
  const [modalTime, setModalTime] = useState('');
  const [modalNote, setModalNote] = useState('');

  /* ── Load sections ── */
  useEffect(() => {
    if (isTeacher) {
      api.get('/teachers/me/').then(r => {
        const s = r.data.class_teacher_of || [];
        setSections(s);
        if (s.length === 1) {
          setSelectedSection(String(s[0].id));
          setSectionStartTime(s[0].school_start_time || '08:00');
        }
      });
    } else {
      api.get('/courses/sections/').then(r => {
        setSections(r.data);
      });
    }
  }, []);

  /* ── Load students ── */
  const loadAttendance = async () => {
    if (!selectedSection || !date) return;
    if (selectedSection === 'all' && sections.length === 0) return;
    setLoading(true); setSaved(false); setDirty(false); setError('');
    try {
      let rows = [];
      if (selectedSection === 'all') {
        const results = await Promise.all(
          sections.map(sec =>
            api.get(`/attendance/?section=${sec.id}&date=${date}`)
              .then(r => r.data.records.map(record => ({
                student:       record.student,
                student_name:  record.student_name,
                father_name:   record.father_name || '',
                roll_number:   record.roll_number || '',
                status:        record.status || null,
                note:          record.note || '',
                arrival_time:  record.arrival_time || '',
                section_id:    sec.id,
                section_name:  sectionLabel(sec),
              })))
              .catch(() => [])
          )
        );
        rows = results.flat();
      } else {
        const res = await api.get(`/attendance/?section=${selectedSection}&date=${date}`);
        rows = res.data.records.map(r => ({
          student:      r.student,
          student_name: r.student_name,
          father_name:  r.father_name || '',
          roll_number:  r.roll_number || '',
          status:       r.status || null,
          note:         r.note || '',
          arrival_time: r.arrival_time || '',
          section_id:   Number(selectedSection),
          section_name: '',
        }));
      }
      setAllRows(rows);
      const pre = {};
      rows.forEach(r => { if (r.status) pre[r.student] = { status: r.status, note: r.note, arrival_time: r.arrival_time }; });
      setMarked(pre);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to load students.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedSection || !date) return;
    if (selectedSection === 'all' && sections.length === 0) return;
    loadAttendance();
  }, [selectedSection, date, sections.length]);

  /* ── Status click ── */
  const handleStatusClick = (studentId, status) => {
    if (status === 'late') {
      const ex = marked[studentId];
      setModalTime(ex?.arrival_time || ''); setModalNote(ex?.note || '');
      setModal({ studentId, status: 'late' });
    } else if (status === 'leave') {
      const ex = marked[studentId];
      setModalNote(ex?.note || ''); setModalTime('');
      setModal({ studentId, status: 'leave' });
    } else {
      setMarked(prev => ({ ...prev, [studentId]: { status, note: '', arrival_time: '' } }));
      setDirty(true);
    }
  };

  const confirmModal = () => {
    if (!modal) return;
    const { studentId, status } = modal;
    if (status === 'late' && !modalTime) return;
    setMarked(prev => ({ ...prev, [studentId]: { status, note: modalNote, arrival_time: status === 'late' ? modalTime : '' } }));
    setDirty(true);
    setModal(null);
  };

  const unmark = (studentId) => {
    setMarked(prev => { const n = { ...prev }; delete n[studentId]; return n; });
    setDirty(true);
  };

  /* ── Filtered unmarked ── */
  const unmarkedRows = useMemo(() => {
    const q = search.toLowerCase();
    return allRows.filter(r => !marked[r.student] && (
      r.student_name.toLowerCase().includes(q) || r.roll_number.toLowerCase().includes(q)
    ));
  }, [allRows, marked, search]);

  /* ── Summary ── */
  const summary = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, leave: 0, unmarked: 0 };
    allRows.forEach(r => { const m = marked[r.student]; if (m) c[m.status] = (c[m.status]||0)+1; else c.unmarked++; });
    return c;
  }, [allRows, marked]);

  /* ── Save ── */
  const handleSave = async () => {
    if (!Object.keys(marked).length) { setError('No students marked yet.'); return; }
    setSaving(true); setSaved(false); setError('');
    try {
      if (selectedSection === 'all') {
        // Group marked students by section and submit separately
        const bySection = {};
        allRows.forEach(row => {
          if (marked[row.student]) {
            if (!bySection[row.section_id]) bySection[row.section_id] = [];
            bySection[row.section_id].push({ student: row.student, ...marked[row.student] });
          }
        });
        // Sequential saves to avoid SQLite "database is locked" on concurrent writes
        for (const [sectionId, records] of Object.entries(bySection)) {
          await api.post('/attendance/mark/', {
            class_section: Number(sectionId), date,
            records: records.map(r => ({ student: r.student, status: r.status, arrival_time: r.arrival_time || null, note: r.note || '' })),
          });
        }
      } else {
        await api.post('/attendance/mark/', {
          class_section: selectedSection, date,
          records: Object.entries(marked).map(([id, m]) => ({ student: Number(id), status: m.status, arrival_time: m.arrival_time || null, note: m.note || '' })),
        });
      }
      setSaved(true); setDirty(false); setTimeout(() => setSaved(false), 3000);
    } catch (err) { setError(err.response?.data?.error || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const sectionLabel = s => `${s.course_name} — Section ${s.name}${s.session_name ? ` (${s.session_name})` : ''}`;
  const currentStudent = modal ? allRows.find(r => r.student === modal.studentId) : null;
  const markedCount = Object.keys(marked).length;

  return (
    <div style={s.page}>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes toast { 0%{opacity:0;transform:translateX(-50%) translateY(10px)} 15%{opacity:1;transform:translateX(-50%) translateY(0)} 85%{opacity:1} 100%{opacity:0;transform:translateX(-50%) translateY(10px)} }
        .status-btn:hover { filter: brightness(0.93); transform: scale(1.04); }
      `}</style>

      {/* ── Header ── */}
      {!inTab && (
        <div style={s.header}>
          <div style={s.headerLeft}>
            <div>
              <h2 style={s.title}>Mark Attendance</h2>
              <p style={s.subtitle}>One click to mark — marked students move to the bottom</p>
            </div>
          </div>
          <button onClick={() => onSwitchToHistory ? onSwitchToHistory() : navigate('/attendance/history')} style={s.historyBtn}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 8v4l3 3M3.05 11A9 9 0 1012 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            History
          </button>
        </div>
      )}

      {/* ── Controls ── */}
      <div style={s.controls}>
        {isTeacher && sections.length === 1 ? (
          <div style={s.sectionBadge}>
            🏫 {sections[0] ? sectionLabel(sections[0]) : 'Your class'}
          </div>
        ) : (
          <select value={selectedSection} onChange={e => {
            setSelectedSection(e.target.value);
            const sec = sections.find(s => String(s.id) === e.target.value);
            setSectionStartTime(sec?.school_start_time || '08:00');
          }} style={s.select}>
            {isManagement && <option value="all">— All Sections —</option>}
            {!isManagement && <option value="">— Select class section —</option>}
            {sections.map(sec => <option key={sec.id} value={sec.id}>{sectionLabel(sec)}</option>)}
          </select>
        )}
        <input type="date" value={date} onChange={e => setDate(e.target.value)} max={today} style={s.dateInput} />
        {allRows.length > 0 && (
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search name or roll..." style={s.searchInput} />
        )}
      </div>

      {error && <div style={s.errorBox}>{error}</div>}

      {saved && (
        <div style={s.toast}>✓ Attendance saved successfully!</div>
      )}

      {loading && (
        <div style={s.loadingRow}><div style={s.spinner} /> Loading students...</div>
      )}

      {!loading && allRows.length > 0 && (
        <div style={s.mainPanel}>

          {/* ── Summary bar ── */}
          <div style={s.summaryBar}>
            <div style={s.summaryLeft}>
              <span style={s.totalPill}>{allRows.length} students</span>
              {STATUS_OPTIONS.map(opt => summary[opt.value] > 0 && (
                <span key={opt.value} style={{ ...s.pill, background: opt.bg, color: opt.color, border: `1px solid ${opt.border}` }}>
                  {opt.full} <strong>{summary[opt.value]}</strong>
                </span>
              ))}
              {summary.unmarked > 0 && (
                <span style={{ ...s.pill, background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
                  Pending <strong>{summary.unmarked}</strong>
                </span>
              )}
            </div>
            <button onClick={handleSave} disabled={saving || !markedCount} style={{ ...s.saveBtn, opacity: (!markedCount || saving) ? 0.5 : 1 }}>
              {saving ? 'Saving...' : `Save (${markedCount})`}
            </button>
          </div>

          {/* ── Unmarked table ── */}
          {unmarkedRows.length > 0 ? (
            <div style={s.tableBox}>
              <div style={s.tableHeader}>
                <span style={s.tableHeadLabel}>
                  ⏳ Pending — {unmarkedRows.length} student{unmarkedRows.length !== 1 ? 's' : ''}
                </span>
                <div style={s.quickBtns}>
                  <span style={s.quickLabel}>Quick mark all:</span>
                  {STATUS_OPTIONS.map(opt => (
                    <button key={opt.value}
                      onClick={() => {
                        if (opt.value === 'late' || opt.value === 'leave') return; // bulk skip for late/leave
                        const updates = {};
                        unmarkedRows.forEach(r => { updates[r.student] = { status: opt.value, note: '', arrival_time: '' }; });
                        setMarked(prev => ({ ...prev, ...updates }));
                      }}
                      title={opt.value === 'late' || opt.value === 'leave' ? 'Use individual rows' : `Mark all as ${opt.full}`}
                      style={{ ...s.quickBtn, background: opt.bg, color: opt.color, border: `1px solid ${opt.border}`, opacity: (opt.value === 'late' || opt.value === 'leave') ? 0.4 : 1, cursor: (opt.value === 'late' || opt.value === 'leave') ? 'not-allowed' : 'pointer' }}
                    >
                      {opt.full}
                    </button>
                  ))}
                </div>
              </div>

              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    <th style={{ ...s.th, width: 44 }}>#</th>
                    <th style={{ ...s.th, width: 44 }}></th>
                    <th style={s.th}>Student Name</th>
                    <th style={s.th}>Father Name</th>
                    <th style={{ ...s.th, width: 90 }}>Roll No.</th>
                    {selectedSection === 'all' && <th style={s.th}>Section</th>}
                    <th style={{ ...s.th, textAlign: 'center' }}>Mark Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {unmarkedRows.map((row, i) => (
                    <tr key={row.student} style={s.tr}>
                      <td style={s.tdNum}>{i + 1}</td>
                      <td style={s.tdAvatar}>
                        <div style={s.avatar}>{row.student_name?.[0]?.toUpperCase()}</div>
                      </td>
                      <td style={s.tdName}>
                        <span style={s.nameText}>{row.student_name}</span>
                      </td>
                      <td style={{ ...s.tdName, color: '#64748b', fontSize: 13 }}>
                        {row.father_name || <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={s.tdRoll}>
                        {row.roll_number ? <span style={s.rollTag}>{row.roll_number}</span> : '—'}
                      </td>
                      {selectedSection === 'all' && (
                        <td style={{ ...s.tdName, fontSize: 12, color: '#6d28d9' }}>{row.section_name}</td>
                      )}
                      <td style={s.tdStatus}>
                        <div style={s.statusRow}>
                          {STATUS_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              className="status-btn"
                              onClick={() => handleStatusClick(row.student, opt.value)}
                              style={{ ...s.statusBtn, background: opt.bg, color: opt.color, border: `1.5px solid ${opt.border}` }}
                              title={opt.full + (opt.value === 'late' ? ' (+ arrival time)' : opt.value === 'leave' ? ' (+ note)' : '')}
                            >
                              {opt.label}
                              {(opt.value === 'late' || opt.value === 'leave') && <span style={s.plusHint}>+</span>}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            search ? (
              <div style={s.emptySearch}>No pending students match "<strong>{search}</strong>"</div>
            ) : (
              <div style={s.allDoneBox}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#15803d' }}>All {allRows.length} students marked!</div>
                <div style={{ fontSize: 13, color: '#86efac', marginTop: 4 }}>Review below and save.</div>
              </div>
            )
          )}

          {/* ── Marked section ── */}
          {markedCount > 0 && (
            <div style={{ marginTop: 20 }}>
              <button onClick={() => setShowMarked(p => !p)} style={s.toggleMarked}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" style={{ transform: showMarked ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {showMarked ? 'Hide' : 'Show'} marked students ({markedCount})
              </button>

              {showMarked && (
                <div style={{ ...s.tableBox, marginTop: 8 }}>
                  <table style={s.table}>
                    <thead>
                      <tr style={s.thead}>
                        <th style={{ ...s.th, width: 44 }}>#</th>
                        <th style={{ ...s.th, width: 44 }}></th>
                        <th style={s.th}>Student Name</th>
                        <th style={s.th}>Father Name</th>
                        <th style={{ ...s.th, width: 90 }}>Roll No.</th>
                        <th style={{ ...s.th, width: 130 }}>Status</th>
                        <th style={s.th}>Details</th>
                        <th style={{ ...s.th, width: 70 }}>Undo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allRows.filter(r => marked[r.student]).map((row, i) => {
                        const m = marked[row.student];
                        const opt = STATUS_OPTIONS.find(o => o.value === m.status);
                        return (
                          <tr key={row.student} style={{ ...s.tr, background: '#fafafa' }}>
                            <td style={s.tdNum}>{i + 1}</td>
                            <td style={s.tdAvatar}>
                              <div style={{ ...s.avatar, background: opt?.bg, color: opt?.color, fontSize: 13 }}>{opt?.label}</div>
                            </td>
                            <td style={s.tdName}><span style={s.nameText}>{row.student_name}</span></td>
                            <td style={{ ...s.tdName, color: '#64748b', fontSize: 13 }}>{row.father_name || <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                            <td style={s.tdRoll}>{row.roll_number ? <span style={s.rollTag}>{row.roll_number}</span> : '—'}</td>
                            <td style={{ ...s.tdRoll }}>
                              <span style={{ ...s.statusTag, background: opt?.bg, color: opt?.color, border: `1px solid ${opt?.border}` }}>
                                {opt?.full}
                              </span>
                            </td>
                            <td style={{ ...s.tdName, fontSize: 12, color: '#64748b' }}>
                              {m.arrival_time && <span style={{ color: '#d97706', marginRight: 8 }}>⏰ {m.arrival_time}</span>}
                              {m.note && <span style={{ color: '#7c3aed' }}>📝 {m.note}</span>}
                              {/* Edit button for late/leave */}
                              {(m.status === 'late' || m.status === 'leave') && (
                                <button
                                  onClick={() => { setModalTime(m.arrival_time||''); setModalNote(m.note||''); setModal({ studentId: row.student, status: m.status }); }}
                                  style={s.editBtn}
                                >edit</button>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <button onClick={() => unmark(row.student)} style={s.undoBtn}>↩ Undo</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {!loading && !selectedSection && !isManagement && (
        <div style={s.emptyState}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <p style={{ fontSize: 14, color: '#94a3b8' }}>Select a section and date to start marking attendance.</p>
        </div>
      )}

      {/* ── Sticky floating save bar ── */}
      {dirty && (
        <div style={s.stickyBar}>
          <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>
            {markedCount} marked · {allRows.length - markedCount} pending
          </span>
          <button onClick={handleSave} disabled={saving || !markedCount}
            style={{ ...s.saveBtnLg, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : '💾 Save Attendance'}
          </button>
        </div>
      )}

      {/* ── Late / Leave Modal ── */}
      {modal && (
        <div style={s.backdrop} onClick={() => setModal(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={{ ...s.modalIcon, background: modal.status === 'late' ? '#fef3c7' : '#ede9fe' }}>
                {modal.status === 'late' ? '⏰' : '📋'}
              </div>
              <div>
                <h3 style={s.modalTitle}>{modal.status === 'late' ? 'Student Arrived Late' : 'Mark as Leave'}</h3>
                <p style={s.modalSub}>{currentStudent?.student_name}</p>
              </div>
            </div>

            {modal.status === 'late' && (
              <>
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#92400e' }}>
                  School starts at <strong>{sectionStartTime}</strong> · ≤30 min late = full day · 30–120 min = half day · &gt;120 min = absent
                </div>
                <label style={s.fieldLabel}>Arrival Time <span style={{ color: '#dc2626' }}>*</span></label>
                <input type="time" value={modalTime} onChange={e => setModalTime(e.target.value)} style={s.timeInput} autoFocus />
              </>
            )}

            <label style={{ ...s.fieldLabel, marginTop: 14 }}>
              {modal.status === 'late' ? 'Note (optional)' : 'Reason / Note (optional)'}
            </label>
            {modal.status === 'late'
              ? <input type="text" value={modalNote} onChange={e => setModalNote(e.target.value)} placeholder="e.g. Traffic delay" style={s.textInput} />
              : <textarea value={modalNote} onChange={e => setModalNote(e.target.value)} placeholder="e.g. Medical leave, sick..." style={s.textarea} autoFocus />
            }

            <div style={s.modalBtns}>
              <button onClick={() => setModal(null)} style={s.cancelBtn}>Cancel</button>
              <button
                onClick={confirmModal}
                disabled={modal.status === 'late' && !modalTime}
                style={{ ...s.confirmBtn, background: modal.status === 'late' ? '#d97706' : '#7c3aed', opacity: (modal.status === 'late' && !modalTime) ? 0.5 : 1 }}
              >
                {modal.status === 'late' ? '⏰ Mark Late' : '📋 Mark Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: { background: '#f8fafc', minHeight: '100vh' },

  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' },
  headerLeft: { display: 'flex', alignItems: 'flex-start', gap: 14 },
  backBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#475569', fontWeight: 500, whiteSpace: 'nowrap' },
  title: { margin: 0, fontSize: 20, fontWeight: 800, color: '#0f172a' },
  subtitle: { margin: '3px 0 0', fontSize: 12, color: '#94a3b8' },
  historyBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },

  controls: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  sectionBadge: { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 9, fontSize: 13, fontWeight: 600, color: '#1d4ed8' },
  select: { padding: '9px 14px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 13, minWidth: 260, background: '#fff', color: '#0f172a' },
  dateInput: { padding: '9px 14px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 13, background: '#fff', color: '#0f172a' },
  searchInput: { padding: '9px 14px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 13, minWidth: 200, background: '#fff', color: '#0f172a', flex: 1 },

  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 9, marginBottom: 14, fontSize: 13 },
  toast: { position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#16a34a', color: '#fff', padding: '11px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700, zIndex: 9999, animation: 'toast 3s ease forwards', whiteSpace: 'nowrap', boxShadow: '0 6px 20px rgba(22,163,74,0.35)' },
  loadingRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '24px 0', color: '#64748b', fontSize: 13 },
  spinner: { width: 18, height: 18, border: '2.5px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },

  mainPanel: { background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden' },

  summaryBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 8, background: '#fafafa' },
  summaryLeft: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  totalPill: { fontSize: 12, fontWeight: 700, color: '#0f172a', padding: '3px 10px', background: '#f1f5f9', borderRadius: 20, border: '1px solid #e2e8f0' },
  pill: { fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 },
  saveBtn: { padding: '8px 18px', background: 'linear-gradient(135deg,#1e40af,#6d28d9)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', transition: 'opacity 0.15s' },

  tableBox: { overflow: 'auto' },
  tableHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 8 },
  tableHeadLabel: { fontSize: 12, fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 },
  quickBtns: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  quickLabel: { fontSize: 11, color: '#94a3b8', fontWeight: 600 },
  quickBtn: { padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, transition: 'filter 0.15s' },

  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f8fafc', borderBottom: '2px solid #e2e8f0' },
  th: { padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' },

  tdNum:    { padding: '10px 12px', fontSize: 12, color: '#cbd5e1', fontWeight: 700, width: 44, textAlign: 'center' },
  tdAvatar: { padding: '8px 6px', width: 44 },
  avatar:   { width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#6d28d9)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 },
  tdName:   { padding: '10px 12px', fontSize: 14 },
  nameText: { fontWeight: 600, color: '#0f172a' },
  tdRoll:   { padding: '10px 12px' },
  rollTag:  { background: '#f1f5f9', padding: '2px 8px', borderRadius: 5, fontFamily: 'monospace', fontSize: 12, color: '#475569', whiteSpace: 'nowrap' },
  tdStatus: { padding: '8px 12px' },
  statusRow:{ display: 'flex', gap: 5, alignItems: 'center' },
  statusBtn:{ padding: '6px 12px', borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 3, transition: 'filter 0.1s, transform 0.1s', whiteSpace: 'nowrap' },
  plusHint: { fontSize: 10, fontWeight: 900, opacity: 0.7 },
  statusTag:{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' },

  emptySearch: { padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: 14 },
  allDoneBox: { padding: '36px', textAlign: 'center', background: '#f0fdf4', border: '2px dashed #bbf7d0' },

  toggleMarked: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569', width: '100%', justifyContent: 'flex-start' },
  editBtn: { marginLeft: 8, padding: '1px 8px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 5, cursor: 'pointer', fontSize: 11, color: '#1d4ed8', fontWeight: 600 },
  undoBtn: { padding: '4px 10px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' },

  saveBar: { display: 'flex', justifyContent: 'flex-end', padding: '14px 16px', borderTop: '1px solid #f1f5f9', background: '#fafafa' },

  emptyState: { textAlign: 'center', padding: '60px 0', color: '#94a3b8' },

  stickyBar: { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', borderRadius: 14, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.25)', zIndex: 100, whiteSpace: 'nowrap' },
  saveBtnLg: { background: 'linear-gradient(135deg,#22c55e,#15803d)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 20px', fontSize: 13, fontWeight: 800, cursor: 'pointer', transition: 'opacity 0.15s' },
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998 },
  modal: { background: '#fff', borderRadius: 16, padding: '26px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  modalIcon: { width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  modalTitle: { margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' },
  modalSub: { margin: '2px 0 0', fontSize: 12, color: '#64748b' },
  fieldLabel: { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  timeInput: { width: '100%', padding: '11px 13px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box', color: '#0f172a' },
  textInput: { width: '100%', padding: '9px 13px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', color: '#0f172a' },
  textarea: { width: '100%', minHeight: 90, padding: '10px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', color: '#0f172a' },
  modalBtns: { display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' },
  cancelBtn: { padding: '9px 16px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569' },
  confirmBtn: { padding: '9px 18px', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, transition: 'opacity 0.15s' },
};
