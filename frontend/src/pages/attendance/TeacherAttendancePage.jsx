import { useEffect, useState, useCallback, useMemo } from 'react';
import api from '../../services/api';

/* ─────────────────────────── shared constants ─────────────────────────── */
const STATUS_CFG = {
  present: { label: 'Present', color: '#15803d', bg: '#dcfce7', border: '#86efac', dot: '#22c55e', icon: '✓' },
  absent:  { label: 'Absent',  color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', dot: '#ef4444', icon: '✗' },
  late:    { label: 'Late',    color: '#d97706', bg: '#fef3c7', border: '#fcd34d', dot: '#f59e0b', icon: '⏰' },
  leave:   { label: 'Leave',   color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd', dot: '#8b5cf6', icon: '📋' },
};
const STATUSES = ['present', 'absent', 'late', 'leave'];
const STATUS_OPTIONS = STATUSES.map(k => ({ value: k, ...STATUS_CFG[k] }));

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

/* ═══════════════════════════ TAB WRAPPER ═══════════════════════════════ */
const TABS = [
  { key: 'mark',    label: 'Mark Attendance',    icon: '✅' },
  { key: 'history', label: 'Attendance History',  icon: '📊' },
];

export default function TeacherAttendancePage() {
  const [activeTab, setActiveTab] = useState('mark');

  return (
    <div style={s.page}>
      {/* Tab bar — identical pattern to StudentAttendancePage */}
      <div style={s.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            style={{ ...s.tab, ...(activeTab === tab.key ? s.tabActive : {}) }}
            onClick={() => setActiveTab(tab.key)}
          >
            <span style={{ fontSize: 15 }}>{tab.icon}</span>
            {tab.label}
            {activeTab === tab.key && <div style={s.tabUnderline} />}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={s.content}>
        {activeTab === 'mark'    && <MarkTeacherAttendance    onSwitchToHistory={() => setActiveTab('history')} />}
        {activeTab === 'history' && <TeacherAttendanceHistory onSwitchToMark={() => setActiveTab('mark')} />}
      </div>
    </div>
  );
}

/* ═══════════════════════ MARK ATTENDANCE TAB ═══════════════════════════ */
function MarkTeacherAttendance({ onSwitchToHistory }) {
  const today = localToday();
  const [date,       setDate]       = useState(today);
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [dirty,      setDirty]      = useState(false);
  const [error,      setError]      = useState('');
  const [search,     setSearch]     = useState('');
  const [changes,    setChanges]    = useState({});  // { teacherId: { status, note, arrival_time } }
  const [showMarked, setShowMarked] = useState(false);
  const [modal,      setModal]      = useState(null);
  const [modalTime,  setModalTime]  = useState('');
  const [modalNote,  setModalNote]  = useState('');

  const load = useCallback((d) => {
    setLoading(true);
    setError('');
    setDirty(false);
    api.get(`/attendance/teachers/?date=${d}`)
      .then(r => {
        setData(r.data);
        // Pre-populate changes with any statuses already saved in DB
        const initial = {};
        (r.data.teachers || []).forEach(t => {
          if (t.status) initial[t.teacher_id] = { status: t.status, note: t.note || '', arrival_time: t.arrival_time || '' };
        });
        setChanges(initial);
      })
      .catch(() => setError('Failed to load teacher attendance.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  /* ── Status click ── */
  const handleStatusClick = (teacherId, status) => {
    if (status === 'late') {
      const ex = changes[teacherId];
      setModalTime(ex?.arrival_time || '');
      setModalNote(ex?.note || '');
      setModal({ teacherId, status: 'late' });
    } else if (status === 'leave') {
      const ex = changes[teacherId];
      setModalNote(ex?.note || '');
      setModalTime('');
      setModal({ teacherId, status: 'leave' });
    } else {
      setChanges(prev => ({ ...prev, [teacherId]: { status, note: '', arrival_time: '' } }));
      setDirty(true);
    }
  };

  const confirmModal = () => {
    if (!modal) return;
    const { teacherId, status } = modal;
    if (status === 'late' && !modalTime) return;
    setChanges(prev => ({
      ...prev,
      [teacherId]: { status, note: modalNote, arrival_time: status === 'late' ? modalTime : '' },
    }));
    setDirty(true);
    setModal(null);
  };

  const undo = (teacherId) => {
    setChanges(prev => { const n = { ...prev }; delete n[teacherId]; return n; });
    setDirty(true);
  };

  const markAll = (status) => {
    if (!data) return;
    if (status === 'late' || status === 'leave') return;
    const bulk = { ...changes };
    // Only mark currently unmarked teachers
    unmatchedTeachers.forEach(t => { bulk[t.teacher_id] = { status, note: '', arrival_time: '' }; });
    setChanges(bulk);
    setDirty(true);
  };

  const getNote        = (t) => changes[t.teacher_id]?.note         ?? '';
  const getArrivalTime = (t) => changes[t.teacher_id]?.arrival_time ?? '';

  /* ── Split: unmarked vs marked ── */
  const allTeachers = data?.teachers ?? [];
  const matchSearch = (t) => !search || t.name.toLowerCase().includes(search.toLowerCase()) || (t.designation || '').toLowerCase().includes(search.toLowerCase());
  const unmatchedTeachers = allTeachers.filter(t => !changes[t.teacher_id]?.status);
  const markedTeachers    = allTeachers.filter(t => !!changes[t.teacher_id]?.status);
  const filteredUnmarked  = unmatchedTeachers.filter(matchSearch);
  const filteredMarked    = markedTeachers.filter(matchSearch);

  /* ── Local real-time summary ── */
  const localSummary = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, on_leave: 0, unmarked: 0 };
    allTeachers.forEach(t => {
      const st = changes[t.teacher_id]?.status;
      if      (st === 'present') c.present++;
      else if (st === 'absent')  c.absent++;
      else if (st === 'late')    c.late++;
      else if (st === 'leave')   c.on_leave++;
      else                       c.unmarked++;
    });
    return { ...c, total: allTeachers.length };
  }, [changes, allTeachers]);

  const totalMarked = localSummary.present + localSummary.absent + localSummary.late + localSummary.on_leave;
  const allDone     = localSummary.total > 0 && localSummary.unmarked === 0;

  /* ── Save ── */
  const save = async () => {
    if (!data) return;
    setSaving(true);
    setError('');
    const records = Object.entries(changes)
      .filter(([, v]) => v.status)
      .map(([teacherId, v]) => ({
        teacher_id:   Number(teacherId),
        status:       v.status,
        note:         v.note || '',
        arrival_time: v.arrival_time || null,
      }));
    try {
      await api.post('/attendance/teachers/mark/', { date, records });
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 3000);
      load(date);
    } catch {
      setError('Failed to save attendance. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const modalTeacher = modal ? allTeachers.find(t => t.teacher_id === modal.teacherId) : null;

  /* ── Teacher row renderer ── */
  const TeacherRow = ({ t, idx, showUndo }) => {
    const currentStatus = changes[t.teacher_id]?.status ?? null;
    const cfg = currentStatus ? STATUS_CFG[currentStatus] : null;
    return (
      <div style={{
        ...m.tableRow,
        background: idx % 2 === 0 ? '#fff' : '#fafafa',
        borderLeft: `4px solid ${cfg ? cfg.dot : '#e2e8f0'}`,
      }}>
        {/* Info */}
        <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ ...m.avatar, background: cfg ? `linear-gradient(135deg,${cfg.dot},${cfg.color})` : 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
            {t.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{t.name}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
              {t.designation || 'Teacher'}{t.employee_id ? ` · ${t.employee_id}` : ''}
            </div>
            {t.marked_by && !showUndo && (
              <div style={{ fontSize: 10, color: '#6366f1', marginTop: 2 }}>Marked by {t.marked_by}</div>
            )}
          </div>
        </div>

        {showUndo ? (
          /* Marked row: show status badge + details + undo */
          <>
            <div style={{ flex: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ background: cfg?.bg, color: cfg?.color, border: `1px solid ${cfg?.border}`, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {cfg?.icon} {cfg?.label}
              </span>
            </div>
            <div style={{ flex: 2, fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {getArrivalTime(t) && <span style={{ color: '#d97706', fontWeight: 600 }}>⏰ {getArrivalTime(t).slice(0,5)}</span>}
              {getNote(t)        && <span style={{ color: '#7c3aed' }}>📝 {getNote(t)}</span>}
              {(currentStatus === 'late' || currentStatus === 'leave') && (
                <button onClick={() => { setModalTime(getArrivalTime(t)||''); setModalNote(getNote(t)||''); setModal({ teacherId: t.teacher_id, status: currentStatus }); }}
                  style={{ padding: '2px 8px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 5, cursor: 'pointer', fontSize: 11, color: '#1d4ed8', fontWeight: 600 }}>
                  edit
                </button>
              )}
              <button onClick={() => undo(t.teacher_id)} style={m.undoBtn}>↩ Undo</button>
            </div>
          </>
        ) : (
          /* Unmarked row: show status buttons */
          <>
            <div style={{ flex: 1.5, display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
              {STATUSES.map(st => {
                const c = STATUS_CFG[st];
                const needsModal = st === 'late' || st === 'leave';
                return (
                  <button key={st} onClick={() => handleStatusClick(t.teacher_id, st)}
                    title={needsModal ? `${c.label} — click to add ${st === 'late' ? 'arrival time' : 'reason'}` : undefined}
                    style={{
                      padding: '5px 11px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      background: c.bg, color: c.color, border: `1.5px solid ${c.border}`,
                      display: 'flex', alignItems: 'center', gap: 2, transition: 'all 0.12s',
                    }}>
                    {c.label}
                    {needsModal && <span style={{ fontSize: 9, fontWeight: 900, opacity: 0.7 }}>+</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ flex: 2 }}><span style={{ color: '#cbd5e1', fontSize: 12, fontStyle: 'italic' }}>Not marked</span></div>
          </>
        )}
      </div>
    );
  };

  return (
    <div style={m.page}>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes toast { 0%{opacity:0;transform:translateX(-50%) translateY(10px)} 15%{opacity:1;transform:translateX(-50%) translateY(0)} 85%{opacity:1} 100%{opacity:0;transform:translateX(-50%) translateY(10px)} }
      `}</style>

      {saved && <div style={m.toast}>✓ Attendance saved successfully!</div>}

      {/* Controls row */}
      <div style={m.controls}>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} max={today} style={m.dateInput} />
        <input placeholder="Search teacher or designation…" value={search} onChange={e => setSearch(e.target.value)} style={m.searchInput} />
        {saved && !dirty && <span style={m.savedBadge}>✓ Saved</span>}
      </div>

      {error && <div style={m.errorBox}>{error}</div>}

      {/* Summary cards — real-time from local state */}
      {data && (
        <div style={m.summaryGrid}>
          {[
            { icon: '👥', label: 'Total',    value: localSummary.total,    color: '#1e293b', bg: '#f8fafc', border: '#e2e8f0' },
            { icon: '✅', label: 'Present',  value: localSummary.present,  color: '#15803d', bg: '#dcfce7', border: '#86efac' },
            { icon: '❌', label: 'Absent',   value: localSummary.absent,   color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
            { icon: '⏰', label: 'Late',     value: localSummary.late,     color: '#d97706', bg: '#fef3c7', border: '#fcd34d' },
            { icon: '🌿', label: 'Leave',    value: localSummary.on_leave, color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd' },
            { icon: '⏳', label: 'Unmarked', value: localSummary.unmarked,
              color: localSummary.unmarked > 0 ? '#dc2626' : '#15803d',
              bg:    localSummary.unmarked > 0 ? '#fee2e2' : '#dcfce7',
              border:localSummary.unmarked > 0 ? '#fca5a5' : '#86efac' },
          ].map(c => (
            <div key={c.label} style={{ flex: '1 1 110px', background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 14, padding: '20px 16px', textAlign: 'center', minWidth: 90 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{c.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: c.color, opacity: 0.8 }}>{c.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Progress bar */}
      {data && localSummary.total > 0 && (
        <div style={m.progressCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
              {allDone ? '✓ All teachers marked' : `${totalMarked} / ${localSummary.total} marked`}
            </span>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {localSummary.present} present · {localSummary.absent} absent · {localSummary.late} late
            </span>
          </div>
          <div style={m.progressTrack}>
            {[['present','#22c55e'],['late','#f59e0b'],['on_leave','#8b5cf6'],['absent','#ef4444']].map(([key, color]) => {
              const pct = localSummary.total ? (localSummary[key] / localSummary.total * 100) : 0;
              return pct > 0 ? <div key={key} style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width .4s' }} /> : null;
            })}
          </div>
        </div>
      )}

      {/* Quick-mark toolbar */}
      <div style={m.toolbar}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Mark All Pending:</span>
          {STATUSES.map(st => {
            const cfg = STATUS_CFG[st];
            const needsModal = st === 'late' || st === 'leave';
            return (
              <button key={st} onClick={() => markAll(st)}
                title={needsModal ? 'Use individual rows for Late/Leave' : undefined}
                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, cursor: needsModal ? 'not-allowed' : 'pointer', opacity: needsModal ? 0.4 : 1 }}>
                {cfg.label}
              </button>
            );
          })}
        </div>
        <button onClick={onSwitchToHistory} style={m.histBtn}>View History 📊</button>
      </div>

      {loading ? (
        <div style={m.emptyBox}><div style={m.spinner} /> Loading teachers…</div>
      ) : (
        <>
          {/* ── Unmarked section ── */}
          {filteredUnmarked.length > 0 ? (
            <div style={m.tableWrap}>
              <div style={m.tableHeader}>
                <span style={m.pendingLabel}>⏳ Pending — {filteredUnmarked.length} teacher{filteredUnmarked.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={m.colHead}>
                <div style={{ flex: 2 }}>Teacher</div>
                <div style={{ flex: 1.5, textAlign: 'center' }}>Mark Status</div>
                <div style={{ flex: 2 }}></div>
              </div>
              {filteredUnmarked.map((t, i) => <TeacherRow key={t.teacher_id} t={t} idx={i} showUndo={false} />)}
            </div>
          ) : (
            allDone && (
              <div style={m.allDoneBox}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#15803d' }}>All {localSummary.total} teachers marked!</div>
                <div style={{ fontSize: 13, color: '#86efac', marginTop: 4 }}>Review below and save.</div>
              </div>
            )
          )}

          {/* ── Marked section (collapsible) ── */}
          {filteredMarked.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <button onClick={() => setShowMarked(p => !p)} style={m.toggleBtn}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" style={{ transform: showMarked ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {showMarked ? 'Hide' : 'Show'} marked teachers ({filteredMarked.length})
              </button>
              {showMarked && (
                <div style={{ ...m.tableWrap, marginTop: 8 }}>
                  <div style={m.colHead}>
                    <div style={{ flex: 2 }}>Teacher</div>
                    <div style={{ flex: 1.5, textAlign: 'center' }}>Status</div>
                    <div style={{ flex: 2 }}>Details / Undo</div>
                  </div>
                  {filteredMarked.map((t, i) => <TeacherRow key={t.teacher_id} t={t} idx={i} showUndo={true} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Sticky save bar — only when user has unsaved changes */}
      {dirty && (
        <div style={m.stickyBar}>
          <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>
            {markedTeachers.length} marked · {localSummary.unmarked} pending
          </span>
          <button onClick={save} disabled={saving} style={m.saveBtnLg}>
            {saving ? 'Saving…' : '💾 Save Attendance'}
          </button>
        </div>
      )}

      {/* Late / Leave Modal */}
      {modal && (
        <div style={m.backdrop} onClick={() => setModal(null)}>
          <div style={m.modal} onClick={e => e.stopPropagation()}>
            <div style={m.modalHeader}>
              <div style={{ ...m.modalIcon, background: modal.status === 'late' ? '#fef3c7' : '#ede9fe' }}>
                {modal.status === 'late' ? '⏰' : '📋'}
              </div>
              <div>
                <h3 style={m.modalTitle}>{modal.status === 'late' ? 'Teacher Arrived Late' : 'Mark as Leave'}</h3>
                <p style={m.modalSub}>{modalTeacher?.name}</p>
              </div>
            </div>

            {modal.status === 'late' && (
              <>
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: '#92400e' }}>
                  Record the exact arrival time. Late arrival is logged and counted against the attendance rate.
                </div>
                <label style={m.fieldLabel}>Arrival Time <span style={{ color: '#dc2626' }}>*</span></label>
                <input type="time" value={modalTime} onChange={e => setModalTime(e.target.value)} style={m.timeInput} autoFocus />
              </>
            )}

            <label style={{ ...m.fieldLabel, marginTop: 14 }}>
              {modal.status === 'late' ? 'Note (optional)' : 'Reason / Note (optional)'}
            </label>
            {modal.status === 'late'
              ? <input type="text" value={modalNote} onChange={e => setModalNote(e.target.value)} placeholder="e.g. Traffic delay" style={m.textInput} />
              : <textarea value={modalNote} onChange={e => setModalNote(e.target.value)} placeholder="e.g. Medical leave, sick…" style={m.textarea} autoFocus />
            }

            <div style={m.modalBtns}>
              <button onClick={() => setModal(null)} style={m.cancelBtn}>Cancel</button>
              <button onClick={confirmModal} disabled={modal.status === 'late' && !modalTime}
                style={{ ...m.confirmBtn, background: modal.status === 'late' ? '#d97706' : '#7c3aed', opacity: (modal.status === 'late' && !modalTime) ? 0.5 : 1 }}>
                {modal.status === 'late' ? '⏰ Mark Late' : '📋 Mark Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ ATTENDANCE HISTORY TAB ════════════════════════ */
function TeacherAttendanceHistory({ onSwitchToMark }) {
  const today = localToday();
  const [filterDate,   setFilterDate]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search,       setSearch]       = useState('');
  const [records,      setRecords]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  const displayDate = filterDate || today;

  const loadRecords = useCallback(async (date) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/attendance/teachers/?date=${date}`);
      setRecords((res.data.teachers || []).filter(r => r.status));
    } catch {
      setError('Failed to load attendance records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRecords(displayDate); }, [displayDate, loadRecords]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter(r =>
      (!filterStatus || r.status === filterStatus) &&
      ((r.name || '').toLowerCase().includes(q) ||
       (r.designation || '').toLowerCase().includes(q))
    );
  }, [records, search, filterStatus]);

  const summary = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, leave: 0 };
    records.forEach(r => { if (r.status) counts[r.status] = (counts[r.status] || 0) + 1; });
    return counts;
  }, [records]);

  return (
    <div style={h.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Controls */}
      <div style={h.controls}>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          max={today} style={h.dateInput} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search teacher…" style={h.searchInput} />
        {filterDate && (
          <button onClick={() => setFilterDate('')} style={h.clearBtn}>✕ Clear date</button>
        )}
      </div>

      {error && <div style={h.errorBox}>{error}</div>}

      {/* Date heading */}
      <div style={h.dateHeading}>
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" stroke="#475569" strokeWidth="2"/>
          <path d="M16 2v4M8 2v4M3 10h18" stroke="#475569" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        {new Date(displayDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </div>

      {/* Summary cards — click to filter */}
      <div style={h.summaryGrid}>
        {STATUS_OPTIONS.map(opt => {
          const isActive = filterStatus === opt.value;
          return (
            <div key={opt.value}
              onClick={() => setFilterStatus(isActive ? '' : opt.value)}
              style={{
                ...h.summaryCard,
                border: `1.5px solid ${opt.border}`,
                background: opt.bg,
                cursor: 'pointer',
                outline: isActive ? `3px solid ${opt.color}` : 'none',
                outlineOffset: 2,
                transform: isActive ? 'scale(1.04)' : 'scale(1)',
                transition: 'all 0.15s',
              }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{opt.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: opt.color }}>{summary[opt.value] || 0}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: opt.color, opacity: 0.8 }}>{opt.label}</div>
              {isActive && <div style={{ fontSize: 10, fontWeight: 700, color: opt.color, marginTop: 4 }}>● Filtered</div>}
            </div>
          );
        })}
        <div onClick={() => setFilterStatus('')}
          style={{
            ...h.summaryCard,
            border: `1.5px solid ${filterStatus === '' ? '#94a3b8' : '#e2e8f0'}`,
            background: '#f8fafc',
            cursor: 'pointer',
            outline: filterStatus === '' ? '3px solid #64748b' : 'none',
            outlineOffset: 2,
            transform: filterStatus === '' ? 'scale(1.04)' : 'scale(1)',
            transition: 'all 0.15s',
          }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>👥</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{records.length}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>All Marked</div>
          {filterStatus === '' && <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginTop: 4 }}>● Showing All</div>}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={h.loadingWrap}>
          <div style={h.spinner} />
          Loading records…
        </div>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <div style={h.tableWrap}>
          <table style={h.table}>
            <thead>
              <tr style={h.thead}>
                <th style={h.th}>#</th>
                <th style={h.th}>Teacher</th>
                <th style={h.th}>Designation</th>
                <th style={h.th}>Status</th>
                <th style={h.th}>Arrival Time</th>
                <th style={h.th}>Note</th>
                <th style={h.th}>Marked By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const opt = STATUS_OPTIONS.find(o => o.value === row.status);
                return (
                  <tr key={row.teacher_id || i} style={h.tr}>
                    <td style={{ ...h.td, color: '#94a3b8', width: 40 }}>{i + 1}</td>
                    <td style={h.td}>
                      <div style={h.nameCell}>
                        <div style={{ ...h.avatarSmall, background: opt?.bg || '#f1f5f9', color: opt?.color || '#64748b' }}>
                          {(row.name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{row.name}</span>
                      </div>
                    </td>
                    <td style={{ ...h.td, fontSize: 13, color: '#64748b' }}>
                      {row.designation || '—'}
                    </td>
                    <td style={h.td}>
                      <span style={{ ...h.statusTag, background: opt?.bg, color: opt?.color, border: `1px solid ${opt?.border}` }}>
                        {opt?.icon} {opt?.label}
                      </span>
                    </td>
                    <td style={{ ...h.td, fontSize: 13 }}>
                      {row.arrival_time
                        ? <span style={{ color: '#d97706', fontWeight: 600 }}>⏰ {row.arrival_time.slice(0,5)}</span>
                        : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ ...h.td, color: '#64748b', fontSize: 13 }}>
                      {row.note || <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td style={{ ...h.td, color: '#6366f1', fontSize: 12 }}>
                      {row.marked_by || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={h.emptyBox}>
          {search ? (
            <>No teachers match "<strong>{search}</strong>"</>
          ) : filterStatus ? (
            <>No <strong>{STATUS_OPTIONS.find(o => o.value === filterStatus)?.label}</strong> teachers on this date.{' '}
              <button onClick={() => setFilterStatus('')} style={h.linkBtn}>Show all →</button></>
          ) : (
            <>No attendance marked for this date.{' '}
              <button onClick={onSwitchToMark} style={h.linkBtn}>Mark attendance →</button></>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════ STYLES ════════════════════════════════ */

/* Tab wrapper */
const s = {
  page: { minHeight: '100vh', background: '#f8fafc' },
  tabBar: {
    display: 'flex', gap: 4, background: '#fff', border: '1px solid #e2e8f0',
    borderRadius: 14, padding: '6px', marginBottom: 24, width: 'fit-content',
  },
  tab: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px',
    background: 'none', border: 'none', borderRadius: 10, cursor: 'pointer',
    fontSize: 14, fontWeight: 600, color: '#64748b', position: 'relative', transition: 'all 0.15s',
  },
  tabActive: { background: '#eff6ff', color: '#1d4ed8' },
  tabUnderline: { position: 'absolute', bottom: -2, left: '20%', right: '20%', height: 2, background: '#3b82f6', borderRadius: 2 },
  content: { minHeight: 400 },
};

/* Mark tab */
const m = {
  page:        { fontFamily: 'inherit' },
  controls:    { display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' },
  dateInput:   { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, background: '#fff', color: '#0f172a' },
  searchInput: { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, minWidth: 220, background: '#fff', color: '#0f172a' },
  savedBadge:  { background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 800 },
  toast:       { position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#16a34a', color: '#fff', padding: '11px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700, zIndex: 9999, animation: 'toast 3s ease forwards', whiteSpace: 'nowrap', boxShadow: '0 6px 20px rgba(22,163,74,0.35)' },
  errorBox:    { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, marginBottom: 24 },
  progressCard:{ background: '#fff', borderRadius: 12, padding: '14px 18px', marginBottom: 16, border: '1px solid #e2e8f0' },
  progressTrack:{ display: 'flex', height: 10, borderRadius: 8, overflow: 'hidden', background: '#f1f5f9' },
  toolbar:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
  histBtn:     { padding: '8px 16px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569' },
  emptyBox:    { display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', background: '#fff', borderRadius: 14, padding: 40, textAlign: 'center', border: '1px dashed #e2e8f0', color: '#94a3b8', gap: 8 },
  spinner:     { width: 20, height: 20, border: '2.5px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
  tableWrap:    { background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  tableHeader:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' },
  pendingLabel: { fontSize: 12, fontWeight: 700, color: '#f59e0b' },
  colHead:      { display: 'flex', gap: 12, padding: '10px 18px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' },
  tableRow:     { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderBottom: '1px solid #f1f5f9' },
  allDoneBox:   { padding: '36px', textAlign: 'center', background: '#f0fdf4', border: '2px dashed #bbf7d0', borderRadius: 14, marginBottom: 16 },
  toggleBtn:    { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569', width: '100%', justifyContent: 'flex-start' },
  undoBtn:      { padding: '3px 10px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' },
  avatar:      { width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0 },
  noteInput:   { width: '100%', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#334155', outline: 'none', background: '#fafafa' },
  stickyBar:   { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', borderRadius: 14, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.25)', zIndex: 100 },
  saveBtnLg:   { background: 'linear-gradient(135deg,#22c55e,#15803d)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 20px', fontSize: 13, fontWeight: 800, cursor: 'pointer' },
  backdrop:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998 },
  modal:       { background: '#fff', borderRadius: 16, padding: '26px', width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 },
  modalIcon:   { width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  modalTitle:  { margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' },
  modalSub:    { margin: '2px 0 0', fontSize: 12, color: '#64748b' },
  fieldLabel:  { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  timeInput:   { width: '100%', padding: '11px 13px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box', color: '#0f172a' },
  textInput:   { width: '100%', padding: '9px 13px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', color: '#0f172a' },
  textarea:    { width: '100%', minHeight: 90, padding: '10px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', color: '#0f172a' },
  modalBtns:   { display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' },
  cancelBtn:   { padding: '9px 16px', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#475569' },
  confirmBtn:  { padding: '9px 18px', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 },
};

/* History tab */
const h = {
  page:        { fontFamily: 'inherit' },
  controls:    { display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' },
  dateInput:   { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, background: '#fff', color: '#0f172a' },
  searchInput: { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, minWidth: 200, background: '#fff', color: '#0f172a' },
  clearBtn:    { padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  errorBox:    { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 14 },
  dateHeading: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#475569', marginBottom: 16 },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, marginBottom: 24 },
  summaryCard: { borderRadius: 14, padding: '20px 16px', textAlign: 'center' },
  loadingWrap: { display: 'flex', alignItems: 'center', gap: 12, padding: 24, color: '#64748b', fontSize: 14 },
  spinner:     { width: 20, height: 20, border: '2.5px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
  tableWrap:   { background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'auto', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' },
  table:       { width: '100%', borderCollapse: 'collapse' },
  thead:       { background: '#f8fafc' },
  th:          { padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.4 },
  tr:          { borderBottom: '1px solid #f1f5f9' },
  td:          { padding: '12px 16px', fontSize: 14, color: '#0f172a' },
  nameCell:    { display: 'flex', alignItems: 'center', gap: 10 },
  avatarSmall: { width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 },
  statusTag:   { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  emptyBox:    { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '40px', textAlign: 'center', color: '#64748b', fontSize: 14 },
  linkBtn:     { background: 'none', border: 'none', color: '#1e40af', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: 0 },
};
