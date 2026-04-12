import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present', icon: '✓', color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
  { value: 'absent',  label: 'Absent',  icon: '✗', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
  { value: 'late',    label: 'Late',    icon: '⏰', color: '#d97706', bg: '#fef3c7', border: '#fcd34d' },
  { value: 'leave',   label: 'Leave',   icon: '📋', color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd' },
];

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

export default function AttendanceHistoryPage({ inTab = false, onSwitchToMark } = {}) {
  const navigate     = useNavigate();
  const { user }     = useAuth();
  const isTeacher    = user?.role === 'teacher';
  const isManagement = ['super_admin', 'school_admin', 'principal'].includes(user?.role);
  const today        = localToday();

  const [sections,        setSections]        = useState([]);
  const [selectedSection, setSelectedSection] = useState(isManagement ? 'all' : '');
  const [filterDate,      setFilterDate]      = useState('');
  const [filterStatus,    setFilterStatus]    = useState('');
  const [search,          setSearch]          = useState('');
  const [records,         setRecords]         = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');

  /* ── Load sections ── */
  useEffect(() => {
    if (isTeacher) {
      api.get('/teachers/me/').then(r => {
        const teacherSections = r.data.class_teacher_of || [];
        setSections(teacherSections);
        if (teacherSections.length === 1) setSelectedSection(String(teacherSections[0].id));
      });
    } else {
      api.get('/courses/sections/').then(r => setSections(r.data));
    }
  }, []);

  /* ── Load attendance records ── */
  const loadRecords = async () => {
    if (!selectedSection) return;
    if (selectedSection === 'all' && sections.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const dateParam = filterDate ? `&date=${filterDate}` : `&date=${today}`;
      if (selectedSection === 'all') {
        const results = await Promise.all(
          sections.map(sec =>
            api.get(`/attendance/?section=${sec.id}${dateParam}`)
              .then(r => (r.data.records || [])
                .filter(rec => rec.status)
                .map(rec => ({ ...rec, section_name: `${sec.course_name} — ${sec.name}` }))
              )
          )
        );
        setRecords(results.flat());
      } else {
        const res = await api.get(`/attendance/?section=${selectedSection}${dateParam}`);
        setRecords((res.data.records || []).filter(r => r.status));
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSection === 'all' && sections.length > 0) { loadRecords(); return; }
    if (selectedSection && selectedSection !== 'all') loadRecords();
  }, [selectedSection, filterDate, sections.length]);

  /* ── Filtered records ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return records.filter(r =>
      (!filterStatus || r.status === filterStatus) &&
      ((r.student_name || '').toLowerCase().includes(q) ||
       (r.roll_number  || '').toLowerCase().includes(q))
    );
  }, [records, search, filterStatus]);

  /* ── Today summary from records ── */
  const summary = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, leave: 0 };
    records.forEach(r => { if (r.status) counts[r.status] = (counts[r.status] || 0) + 1; });
    return counts;
  }, [records]);

  const sectionLabel = (s) => `${s.course_name} — Section ${s.name}${s.session_name ? ` (${s.session_name})` : ''}`;

  const displayDate = filterDate || today;

  return (
    <div style={s.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* Header */}
      {!inTab && (
        <div style={s.header}>
          <div style={s.headerLeft}>
            <button onClick={() => navigate('/attendance/mark')} style={s.backBtn}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Mark Attendance
            </button>
            <div>
              <h2 style={s.title}>Attendance History</h2>
              <p style={s.subtitle}>View and search past attendance records</p>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div style={s.controls}>
        {isTeacher && sections.length === 1 ? (
          <div style={s.sectionBadge}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#1d4ed8" strokeWidth="2"/><polyline points="9,22 9,12 15,12 15,22" stroke="#1d4ed8" strokeWidth="2"/></svg>
            {sections[0] ? sectionLabel(sections[0]) : 'Your class'}
          </div>
        ) : (
          <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)} style={s.select}>
            {isManagement && <option value="all">All Sections</option>}
            <option value="">— Select class section —</option>
            {sections.map(sec => (
              <option key={sec.id} value={sec.id}>{sectionLabel(sec)}</option>
            ))}
          </select>
        )}

        <input
          type="date"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          max={today}
          style={s.dateInput}
        />

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search student..."
          style={s.searchInput}
        />

        {filterDate && (
          <button onClick={() => setFilterDate('')} style={s.clearBtn}>
            ✕ Clear date
          </button>
        )}
      </div>

      {error && <div style={s.errorBox}>{error}</div>}

      {loading && (
        <div style={s.loadingWrap}>
          <div style={s.spinner} />
          Loading records...
        </div>
      )}

      {!loading && selectedSection && (
        <>
          {/* Date heading */}
          <div style={s.dateHeading}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" stroke="#475569" strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="#475569" strokeWidth="2" strokeLinecap="round"/></svg>
            {new Date(displayDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>

          {/* Summary cards — click to filter by status */}
          <div style={s.summaryGrid}>
            {STATUS_OPTIONS.map(opt => {
              const isActive = filterStatus === opt.value;
              return (
                <div
                  key={opt.value}
                  onClick={() => setFilterStatus(isActive ? '' : opt.value)}
                  style={{
                    ...s.summaryCard,
                    border: `1.5px solid ${opt.border}`,
                    background: opt.bg,
                    cursor: 'pointer',
                    outline: isActive ? `3px solid ${opt.color}` : 'none',
                    outlineOffset: 2,
                    transform: isActive ? 'scale(1.04)' : 'scale(1)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{opt.icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: opt.color }}>{summary[opt.value] || 0}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: opt.color, opacity: 0.8 }}>{opt.label}</div>
                  {isActive && <div style={{ fontSize: 10, fontWeight: 700, color: opt.color, marginTop: 4 }}>● Filtered</div>}
                </div>
              );
            })}
            <div
              onClick={() => setFilterStatus('')}
              style={{
                ...s.summaryCard,
                border: `1.5px solid ${filterStatus === '' ? '#94a3b8' : '#e2e8f0'}`,
                background: '#f8fafc',
                cursor: 'pointer',
                outline: filterStatus === '' ? '3px solid #64748b' : 'none',
                outlineOffset: 2,
                transform: filterStatus === '' ? 'scale(1.04)' : 'scale(1)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>👥</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{records.length}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>All Marked</div>
              {filterStatus === '' && <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginTop: 4 }}>● Showing All</div>}
            </div>
          </div>

          {/* Table */}
          {filtered.length > 0 ? (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    <th style={s.th}>#</th>
                    <th style={s.th}>Student</th>
                    <th style={s.th}>Roll No.</th>
                    {selectedSection === 'all' && <th style={s.th}>Section</th>}
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Arrival Time</th>
                    <th style={s.th}>Note</th>
                    <th style={s.th}>Marked By</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => {
                    const opt = STATUS_OPTIONS.find(o => o.value === row.status);
                    return (
                      <tr key={row.id || row.student} style={s.tr}>
                        <td style={{ ...s.td, color: '#94a3b8', width: 40 }}>{i + 1}</td>
                        <td style={s.td}>
                          <div style={s.nameCell}>
                            <div style={{ ...s.avatarSmall, background: opt?.bg || '#f1f5f9', color: opt?.color || '#64748b' }}>
                              {(row.student_name || '?')[0].toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{row.student_name}</span>
                          </div>
                        </td>
                        <td style={s.td}>
                          <span style={s.rollTag}>{row.roll_number || '—'}</span>
                        </td>
                        {selectedSection === 'all' && (
                          <td style={{ ...s.td, fontSize: 12, color: '#475569' }}>{row.section_name || '—'}</td>
                        )}
                        <td style={s.td}>
                          <span style={{ ...s.statusTag, background: opt?.bg, color: opt?.color, border: `1px solid ${opt?.border}` }}>
                            {opt?.icon} {opt?.label}
                          </span>
                        </td>
                        <td style={{ ...s.td, fontSize: 13 }}>
                          {row.arrival_time
                            ? <span style={{ color: '#d97706', fontWeight: 600 }}>⏰ {row.arrival_time.slice(0,5)}</span>
                            : <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                        <td style={{ ...s.td, color: '#64748b', fontSize: 13 }}>
                          {row.note || <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                        <td style={{ ...s.td, color: '#64748b', fontSize: 12 }}>
                          {row.marked_by_name || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={s.emptyBox}>
              {search ? (
                <>No records match "<strong>{search}</strong>"</>
              ) : filterStatus ? (
                <>No <strong>{STATUS_OPTIONS.find(o => o.value === filterStatus)?.label}</strong> students on this date. <button onClick={() => setFilterStatus('')} style={s.linkBtn}>Show all →</button></>
              ) : (
                <>No attendance records for this date. <button onClick={() => onSwitchToMark ? onSwitchToMark() : navigate('/attendance/mark')} style={s.linkBtn}>Mark attendance →</button></>
              )}
            </div>
          )}
        </>
      )}

      {!loading && !selectedSection && !isManagement && (
        <div style={s.emptyState}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
          <p style={{ fontSize: 15, color: '#94a3b8' }}>Select a section to view attendance history.</p>
        </div>
      )}
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#f8fafc' },

  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  headerLeft: { display: 'flex', alignItems: 'flex-start', gap: 16 },
  backBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#475569', fontWeight: 500 },
  title: { margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#94a3b8' },

  controls: { display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' },
  sectionBadge: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#eff6ff', border: '1.5px solid #bfdbfe', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#1d4ed8' },
  select: { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, minWidth: 280, background: '#fff', color: '#0f172a' },
  dateInput: { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, background: '#fff', color: '#0f172a' },
  searchInput: { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, minWidth: 200, background: '#fff', color: '#0f172a' },
  clearBtn: { padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 },

  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 14 },

  loadingWrap: { display: 'flex', alignItems: 'center', gap: 12, padding: 24, color: '#64748b', fontSize: 14 },
  spinner: { width: 20, height: 20, border: '2.5px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },

  dateHeading: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#475569', marginBottom: 16 },

  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, marginBottom: 24 },
  summaryCard: { borderRadius: 14, padding: '20px 16px', textAlign: 'center' },

  tableWrap: { background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'auto', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f8fafc' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.4 },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px 16px', fontSize: 14, color: '#0f172a' },
  nameCell: { display: 'flex', alignItems: 'center', gap: 10 },
  avatarSmall: { width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 },
  rollTag: { background: '#f1f5f9', padding: '2px 8px', borderRadius: 6, fontFamily: 'monospace', fontSize: 12, color: '#475569' },
  statusTag: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 },

  emptyBox: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '40px', textAlign: 'center', color: '#64748b', fontSize: 14 },
  linkBtn: { background: 'none', border: 'none', color: '#1e40af', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: 0 },
  emptyState: { textAlign: 'center', padding: '60px 0', color: '#94a3b8' },
};
