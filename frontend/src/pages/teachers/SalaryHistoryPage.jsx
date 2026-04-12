import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

if (typeof document !== 'undefined' && !document.getElementById('sal-hist-spin')) {
  const style = document.createElement('style');
  style.id = 'sal-hist-spin';
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}

const STATUS_CFG = {
  pending: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: 'Pending' },
  partial: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Partial' },
  paid:    { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Paid'    },
};

const METHOD_LABELS = { cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque' };

const fmtMonth = (m) => {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

export default function SalaryHistoryPage() {
  const navigate = useNavigate();

  const [sheets, setSheets]       = useState([]);
  const [teachers, setTeachers]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState(null);

  const [filterMonth, setFilterMonth]     = useState('');
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterStatus, setFilterStatus]   = useState('');
  const [search, setSearch]               = useState('');

  useEffect(() => {
    api.get('/teachers/').then(r => setTeachers(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchSheets(); }, [filterMonth, filterTeacher, filterStatus]);

  const fetchSheets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterMonth)   params.append('month', filterMonth);
      if (filterTeacher) params.append('teacher', filterTeacher);
      const res = await api.get(`/teachers/salaries/?${params}`);
      let data = res.data;
      if (filterStatus) data = data.filter(s => s.status === filterStatus);
      setSheets(data);
    } finally {
      setLoading(false);
    }
  };

  const filtered = search.trim()
    ? sheets.filter(s =>
        s.teacher_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
        fmtMonth(s.month).toLowerCase().includes(search.toLowerCase())
      )
    : sheets;

  // Group by month for timeline display
  const grouped = filtered.reduce((acc, s) => {
    if (!acc[s.month]) acc[s.month] = [];
    acc[s.month].push(s);
    return acc;
  }, {});
  const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const totalNet     = filtered.reduce((a, s) => a + Number(s.net_salary), 0);
  const totalPaid    = filtered.reduce((a, s) => a + Number(s.amount_paid), 0);
  const totalBalance = Math.max(0, totalNet - totalPaid);
  const paidCount    = filtered.filter(s => s.status === 'paid').length;
  const pendingCount = filtered.filter(s => s.status === 'pending').length;
  const partialCount = filtered.filter(s => s.status === 'partial').length;

  return (
    <div style={st.page}>
      {/* Header */}
      <div style={st.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => navigate('/salary')} style={st.backBtn}>← Current Month</button>
          <div>
            <h1 style={st.title}>Salary History</h1>
            <p style={st.subtitle}>All salary sheets across all months</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={st.summaryRow}>
        <SCard label="Total Net Salary" value={`PKR ${totalNet.toLocaleString()}`}   color="#1d4ed8" bg="#eff6ff" />
        <SCard label="Total Paid Out"   value={`PKR ${totalPaid.toLocaleString()}`}  color="#15803d" bg="#f0fdf4" />
        <SCard label="Balance Due"      value={`PKR ${totalBalance.toLocaleString()}`} color={totalBalance > 0 ? '#991b1b' : '#15803d'} bg={totalBalance > 0 ? '#fef2f2' : '#f0fdf4'} />
        <SCard label="Paid"    value={paidCount}    color="#15803d" bg="#f0fdf4" />
        <SCard label="Pending" value={pendingCount} color="#c2410c" bg="#fff7ed" />
        <SCard label="Partial" value={partialCount} color="#1d4ed8" bg="#eff6ff" />
      </div>

      {/* Filters */}
      <div style={st.filterCard}>
        <div style={st.filterRow}>
          <div style={st.filterGroup}>
            <label style={st.filterLabel}>Month</label>
            <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={st.input} />
          </div>
          <div style={st.filterGroup}>
            <label style={st.filterLabel}>Teacher</label>
            <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)} style={st.input}>
              <option value="">All Teachers</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.full_name} ({t.employee_id})</option>
              ))}
            </select>
          </div>
          <div style={st.filterGroup}>
            <label style={st.filterLabel}>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={st.input}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div style={{ ...st.filterGroup, flex: 2 }}>
            <label style={st.filterLabel}>Search</label>
            <input
              placeholder="Name, employee ID or month…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={st.input}
            />
          </div>
          <div style={{ ...st.filterGroup, justifyContent: 'flex-end' }}>
            <label style={st.filterLabel}>&nbsp;</label>
            <button style={st.clearBtn} onClick={() => { setFilterMonth(''); setFilterTeacher(''); setFilterStatus(''); setSearch(''); }}>
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={st.empty}><div style={st.spinner} /><p style={{ color: '#94a3b8', margin: 0 }}>Loading…</p></div>
      ) : filtered.length === 0 ? (
        <div style={st.empty}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📂</div>
          <p style={{ color: '#94a3b8', margin: 0 }}>No salary history found.</p>
        </div>
      ) : (
        sortedMonths.map(month => (
          <div key={month} style={st.monthSection}>
            {/* Month header */}
            <div style={st.monthHeader}>
              <span style={st.monthLabel}>{fmtMonth(month)}</span>
              <span style={st.monthCount}>{grouped[month].length} teacher{grouped[month].length !== 1 ? 's' : ''}</span>
              <span style={st.monthTotal}>
                PKR {grouped[month].reduce((a, s) => a + Number(s.net_salary), 0).toLocaleString()} net
              </span>
            </div>

            {/* Sheets for this month */}
            <div style={st.list}>
              {grouped[month].map(s => {
                const sc   = STATUS_CFG[s.status] || STATUS_CFG.pending;
                const open = expanded === s.id;
                return (
                  <div key={s.id} style={st.card}>
                    <div style={st.cardTop} onClick={() => setExpanded(open ? null : s.id)}>
                      <div style={st.cardLeft}>
                        <div style={st.avatar}>{(s.teacher_name || '?')[0].toUpperCase()}</div>
                        <div>
                          <div style={st.teacherName}>{s.teacher_name}</div>
                          <div style={st.employeeId}>{s.employee_id} · {s.designation?.replace(/_/g, ' ')}</div>
                        </div>
                        <span style={{ ...st.statusPill, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                          {sc.label}
                        </span>
                      </div>
                      <div style={st.cardRight}>
                        <div style={st.amtGroup}>
                          <span style={st.amtLabel}>Net Salary</span>
                          <span style={st.amtVal}>PKR {Number(s.net_salary).toLocaleString()}</span>
                        </div>
                        <div style={st.amtGroup}>
                          <span style={st.amtLabel}>Paid</span>
                          <span style={{ ...st.amtVal, color: '#15803d' }}>PKR {Number(s.amount_paid).toLocaleString()}</span>
                        </div>
                        {s.balance > 0 && (
                          <div style={st.amtGroup}>
                            <span style={st.amtLabel}>Balance</span>
                            <span style={{ ...st.amtVal, color: '#dc2626' }}>PKR {Number(s.balance).toLocaleString()}</span>
                          </div>
                        )}
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>{open ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {open && (
                      <div style={st.cardBody}>
                        <div style={st.sectionTitle}>Salary Breakdown</div>
                        <Row label="Basic Salary" value={`PKR ${Number(s.basic_salary).toLocaleString()}`} />
                        {s.components.filter(c => c.component_type === 'allowance').map((c, i) => (
                          <Row key={i} label={`+ ${c.label}`} value={`PKR ${Number(c.amount).toLocaleString()}`} color="#15803d" />
                        ))}
                        {s.components.filter(c => c.component_type === 'deduction').map((c, i) => (
                          <Row key={i} label={`− ${c.label}`} value={`PKR ${Number(c.amount).toLocaleString()}`} color="#dc2626" />
                        ))}
                        <Row label="Net Salary"   value={`PKR ${Number(s.net_salary).toLocaleString()}`}  bold />
                        <Row label="Amount Paid"  value={`PKR ${Number(s.amount_paid).toLocaleString()}`} color="#15803d" />
                        {s.balance > 0 && <Row label="Balance" value={`PKR ${Number(s.balance).toLocaleString()}`} color="#dc2626" bold />}

                        {s.payments?.length > 0 && (
                          <>
                            <div style={{ ...st.sectionTitle, marginTop: 14 }}>Payment History</div>
                            {s.payments.map((p, i) => (
                              <div key={i} style={st.payRow}>
                                <span style={st.payMethod}>{METHOD_LABELS[p.payment_method] || p.payment_method}</span>
                                <span style={st.payAmt}>PKR {Number(p.amount).toLocaleString()}</span>
                                <span style={st.payDate}>{p.payment_date}</span>
                                {p.transaction_id && <span style={st.payTxn}>Ref: {p.transaction_id}</span>}
                                {p.paid_by_name && <span style={st.payBy}>by {p.paid_by_name}</span>}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function SCard({ label, value, color, bg }) {
  return (
    <div style={{ flex: '1 1 130px', background: bg, borderRadius: 12, padding: '14px 16px', minWidth: 120 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}

function Row({ label, value, color, bold }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, borderBottom: '1px solid #f8fafc' }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ color: color || '#0f172a', fontWeight: bold ? 700 : 500 }}>{value}</span>
    </div>
  );
}

const st = {
  page:        { padding: '24px', minHeight: '100vh', background: '#f8fafc' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  backBtn:     { padding: '8px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#475569', fontWeight: 600 },
  title:       { margin: 0, fontSize: 26, fontWeight: 800, color: '#0f172a' },
  subtitle:    { margin: '4px 0 0', fontSize: 14, color: '#94a3b8' },

  summaryRow:  { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 },

  filterCard:  { background: '#fff', borderRadius: 12, padding: '16px 20px', marginBottom: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  filterRow:   { display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 140 },
  filterLabel: { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' },
  input:       { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box' },
  clearBtn:    { padding: '9px 16px', background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#475569' },

  empty:       { background: '#fff', borderRadius: 12, padding: '60px 24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  spinner:     { width: 36, height: 36, border: '3px solid #e2e8f0', borderTop: '3px solid #1d4ed8', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' },

  monthSection: { marginBottom: 28 },
  monthHeader:  { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 },
  monthLabel:   { fontSize: 16, fontWeight: 800, color: '#0f172a' },
  monthCount:   { fontSize: 12, color: '#94a3b8', background: '#f1f5f9', padding: '2px 8px', borderRadius: 20, fontWeight: 600 },
  monthTotal:   { fontSize: 12, color: '#1d4ed8', background: '#eff6ff', padding: '2px 8px', borderRadius: 20, fontWeight: 600 },

  list:        { display: 'flex', flexDirection: 'column', gap: 8 },
  card:        { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  cardTop:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', cursor: 'pointer', gap: 12, flexWrap: 'wrap' },
  cardLeft:    { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  cardRight:   { display: 'flex', alignItems: 'center', gap: 14 },
  avatar:      { width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#1d4ed8,#7c3aed)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 },
  teacherName: { fontWeight: 700, fontSize: 13, color: '#0f172a' },
  employeeId:  { fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' },
  statusPill:  { padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 },
  amtGroup:    { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  amtLabel:    { fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' },
  amtVal:      { fontSize: 14, fontWeight: 700, color: '#0f172a' },

  cardBody:    { padding: '4px 18px 14px', borderTop: '1px solid #f1f5f9' },
  sectionTitle:{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, marginTop: 12 },
  payRow:      { display: 'flex', gap: 12, alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f8fafc', fontSize: 13, flexWrap: 'wrap' },
  payMethod:   { background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600 },
  payAmt:      { fontWeight: 700, color: '#15803d' },
  payDate:     { color: '#94a3b8', fontSize: 12 },
  payTxn:      { color: '#6366f1', fontSize: 12 },
  payBy:       { color: '#94a3b8', fontSize: 12 },
};
