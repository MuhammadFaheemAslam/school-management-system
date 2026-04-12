import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

if (typeof document !== 'undefined' && !document.getElementById('efp-spin')) {
  const st = document.createElement('style');
  st.id = 'efp-spin';
  st.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(st);
}

export default function EnrollmentFeesPage({ embedded = false }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.is_superuser || user?.role === 'super_admin';

  const [packages, setPackages]           = useState([]);
  const [sections, setSections]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [filterSection, setFilterSection] = useState('');
  const [search, setSearch]               = useState('');
  const [searchInput, setSearchInput]     = useState('');
  const [deletingId, setDeletingId]       = useState(null);

  useEffect(() => {
    api.get('/courses/sections/').then(r => setSections(r.data));
    fetchPackages();
  }, []);

  useEffect(() => { fetchPackages(); }, [filterSection, search]);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSection) params.append('section', filterSection);
      if (search)        params.append('search', search);
      const res = await api.get(`/fees/enrollment-packages/?${params}`);
      setPackages(res.data);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePackage = async (id) => {
    if (!window.confirm('Permanently delete this enrollment fee package?\n\nThis cannot be undone.')) return;
    setDeletingId(id);
    try {
      await api.delete(`/fees/enrollment-packages/${id}/`);
      setPackages(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed.');
    } finally {
      setDeletingId(null);
    }
  };

  const summary = {
    total:        packages.length,
    custom:       packages.filter(p => p.is_custom).length,
    withMonthly:  packages.filter(p => parseFloat(p.total_monthly || 0) > 0).length,
    withOnetime:  packages.filter(p => parseFloat(p.total_onetime || 0) > 0).length,
  };

  return (
    <div style={s.page}>

      {!embedded && (
        <div style={s.topBar}>
          <button onClick={() => navigate('/fees')} style={s.backBtn}>← Back</button>
          <div>
            <h1 style={s.pageTitle}>Enrollment Fee Packages</h1>
            <p style={s.pageSubtitle}>Per-student fee assignments used for voucher generation</p>
          </div>
        </div>
      )}

      {/* ── Summary strip ── */}
      <div style={s.summaryGrid}>
        <StatCard icon="👥" label="Total Students"  value={summary.total}       accent="#6366f1" />
        <StatCard icon="🔁" label="With Monthly Fee" value={summary.withMonthly} accent="#0891b2" />
        <StatCard icon="1️⃣" label="With One-time Fee" value={summary.withOnetime} accent="#d97706" />
        <StatCard icon="✏️" label="Custom Overrides"  value={summary.custom}      accent="#7c3aed" />
      </div>

      {/* ── Filters ── */}
      <div style={s.filterCard}>
        <div style={s.filterInner}>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Section</label>
            <select value={filterSection} onChange={e => setFilterSection(e.target.value)} style={s.select}>
              <option value="">All Sections</option>
              {sections.map(sec => (
                <option key={sec.id} value={sec.id}>{sec.course_name} — {sec.name}</option>
              ))}
            </select>
          </div>
          <div style={{ ...s.filterGroup, flex: 2 }}>
            <label style={s.filterLabel}>Search</label>
            <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); }} style={s.searchRow}>
              <input
                placeholder="Name, admission no. or roll no."
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                style={s.searchInput}
              />
              <button type="submit" style={s.searchBtn}>Search</button>
              {search && (
                <button type="button" style={s.clearBtn}
                  onClick={() => { setSearch(''); setSearchInput(''); }}>✕</button>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={s.emptyBox}>
          <div style={s.spinner} />
          <p style={s.emptyText}>Loading records…</p>
        </div>
      ) : packages.length === 0 ? (
        <div style={s.emptyBox}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <p style={s.emptyText}>No fee packages found.</p>
        </div>
      ) : (
        <div style={s.tableCard}>
          <div style={s.tableHeader}>
            <span style={s.tableCount}>{packages.length} student{packages.length !== 1 ? 's' : ''}</span>
            <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 12 }}>Fee amounts used when generating monthly/admission vouchers</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  <th style={s.th}>Student</th>
                  <th style={s.th}>Adm. No.</th>
                  <th style={s.th}>Roll</th>
                  <th style={s.th}>Class / Section</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Tuition</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Transport</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Registration</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Books</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Exam</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Monthly Total</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Type</th>
                  {isSuperAdmin && <th style={{ ...s.th, textAlign: 'center' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg, idx) => (
                  <tr key={pkg.id} style={s.tr}>
                    <td style={{ ...s.td, color: '#94a3b8', fontSize: 12 }}>{idx + 1}</td>
                    <td style={s.td}>
                      <div style={s.studentCell}>
                        <div style={s.avatar}>{(pkg.student_name || '?')[0].toUpperCase()}</div>
                        <div style={s.studentName}>{pkg.student_name}</div>
                      </div>
                    </td>
                    <td style={s.td}><span style={s.codeBadge}>{pkg.admission_number}</span></td>
                    <td style={s.td}>
                      {pkg.roll_number
                        ? <span style={s.codeBadge}>{pkg.roll_number}</span>
                        : <span style={s.dash}>—</span>}
                    </td>
                    <td style={s.td}>
                      {pkg.class_name   && <div style={s.className}>{pkg.class_name}</div>}
                      {pkg.section_name && <div style={s.sectionName}>{pkg.section_name}</div>}
                    </td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{fmt(pkg.tuition_fee)}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{fmt(pkg.transport_fee)}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{fmt(pkg.registration_fee)}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{fmt(pkg.books_fee)}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{fmt(pkg.exam_fee)}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                      PKR {Number(pkg.total_monthly).toLocaleString()}
                    </td>
                    <td style={{ ...s.td, textAlign: 'center' }}>
                      {pkg.is_custom
                        ? <span style={s.customBadge}>✏️ Custom</span>
                        : <span style={s.autoBadge}>Auto</span>}
                    </td>
                    {isSuperAdmin && (
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeletePackage(pkg.id)}
                          disabled={deletingId === pkg.id}
                          style={s.deleteBtn}
                          title="Delete fee package"
                        >
                          {deletingId === pkg.id ? '…' : '🗑'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div style={{ ...s.statCard, borderTop: `3px solid ${accent}` }}>
      <div style={{ ...s.statIcon, background: accent + '18', color: accent }}>{icon}</div>
      <div>
        <div style={s.statValue}>{value}</div>
        <div style={s.statLabel}>{label}</div>
      </div>
    </div>
  );
}

function fmt(n) {
  const num = Number(n);
  if (!num) return <span style={{ color: '#cbd5e1' }}>—</span>;
  return <span>{num.toLocaleString()}</span>;
}

const s = {
  page:         { minHeight: '100vh', background: '#f8fafc', padding: '24px' },
  topBar:       { display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 },
  backBtn:      { padding: '8px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 14, color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' },
  pageTitle:    { margin: 0, fontSize: 26, fontWeight: 800, color: '#0f172a' },
  pageSubtitle: { margin: '4px 0 0', fontSize: 14, color: '#94a3b8' },

  summaryGrid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 },
  statCard:     { background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', gap: 14, alignItems: 'flex-start' },
  statIcon:     { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 },
  statValue:    { fontSize: 20, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 },
  statLabel:    { fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 },

  filterCard:   { background: '#fff', borderRadius: 12, padding: '16px 20px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  filterInner:  { display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' },
  filterGroup:  { display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 160 },
  filterLabel:  { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' },
  select:       { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', background: '#fff', outline: 'none', cursor: 'pointer' },
  searchRow:    { display: 'flex', gap: 6 },
  searchInput:  { flex: 1, padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', outline: 'none', minWidth: 0 },
  searchBtn:    { padding: '9px 18px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' },
  clearBtn:     { padding: '9px 12px', background: '#f1f5f9', color: '#64748b', border: '1.5px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontWeight: 700 },

  emptyBox:     { background: '#fff', borderRadius: 12, padding: '60px 24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  emptyText:    { color: '#94a3b8', fontSize: 15, margin: 0 },
  spinner:      { width: 36, height: 36, border: '3px solid #e2e8f0', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' },

  tableCard:    { background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  tableHeader:  { padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center' },
  tableCount:   { fontSize: 13, color: '#94a3b8', fontWeight: 600 },
  table:        { width: '100%', borderCollapse: 'collapse', minWidth: 900 },
  th:           { padding: '10px 14px', background: '#f8fafc', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' },
  tr:           { borderBottom: '1px solid #f8fafc' },
  td:           { padding: '12px 14px', fontSize: 13, color: '#334155', verticalAlign: 'middle' },

  studentCell:  { display: 'flex', alignItems: 'center', gap: 10 },
  avatar:       { width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 },
  studentName:  { fontWeight: 600, color: '#0f172a', fontSize: 13 },
  codeBadge:    { background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 5, fontFamily: 'monospace', fontSize: 11, fontWeight: 600 },
  dash:         { color: '#cbd5e1' },
  className:    { fontWeight: 600, color: '#334155', fontSize: 13 },
  sectionName:  { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  customBadge:  { background: '#f5f3ff', color: '#7c3aed', border: '1px solid #c4b5fd', borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700 },
  autoBadge:    { background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  deleteBtn:    { width: 28, height: 28, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};
