import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

if (typeof document !== 'undefined' && !document.getElementById('sal-spin')) {
  const st = document.createElement('style');
  st.id = 'sal-spin';
  st.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(st);
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

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function SalaryPage() {
  const navigate = useNavigate();
  const [sheets, setSheets]         = useState([]);
  const [teachers, setTeachers]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filterTeacher, setFilterTeacher] = useState('');
  const [filterStatus, setFilterStatus]   = useState('');
  const [expanded, setExpanded]     = useState(null);

  // Auto-generate status panel
  const [autoStatus, setAutoStatus] = useState(null);
  const [autoOpen, setAutoOpen]     = useState(false);

  // Pay modal
  const [paySheet, setPaySheet]     = useState(null);
  const [payAmount, setPayAmount]   = useState('');
  const [payMethod, setPayMethod]   = useState('cash');
  const [payDate, setPayDate]       = useState('');
  const [payTxn, setPayTxn]         = useState('');
  const [payNote, setPayNote]       = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError]     = useState('');

  useEffect(() => {
    api.get('/teachers/').then(r => setTeachers(r.data)).catch(() => {});
    api.get('/teachers/salaries/autogenerate/status/').then(r => setAutoStatus(r.data)).catch(() => {});
  }, []);

  useEffect(() => { fetchSheets(); }, [filterTeacher, filterStatus]);

  const fetchSheets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('month', currentMonth());
      if (filterTeacher) params.append('teacher', filterTeacher);
      const res = await api.get(`/teachers/salaries/?${params}`);
      let data = res.data;
      if (filterStatus) data = data.filter(s => s.status === filterStatus);
      setSheets(data);
    } finally {
      setLoading(false);
    }
  };

  // ── Payment ──
  const openPay = (sheet) => {
    setPaySheet(sheet);
    setPayAmount(sheet.balance > 0 ? String(sheet.balance) : '');
    setPayMethod(sheet.teacher_payment_mode || 'cash');
    setPayDate('');
    setPayTxn('');
    setPayNote('');
    setPayError('');
  };

  const handlePay = async () => {
    setPayLoading(true);
    setPayError('');
    try {
      await api.post(`/teachers/salaries/${paySheet.id}/pay/`, {
        amount: parseFloat(payAmount),
        payment_method: payMethod,
        payment_date:   payDate || undefined,
        transaction_id: payTxn,
        note:           payNote,
      });
      setPaySheet(null);
      fetchSheets();
    } catch (err) {
      setPayError(err.response?.data?.error || 'Payment failed.');
    } finally {
      setPayLoading(false);
    }
  };

  // ── Delete ──
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this salary sheet? This cannot be undone.')) return;
    try {
      await api.delete(`/teachers/salaries/${id}/`);
      setSheets(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed.');
    }
  };

  // ── Summary ──
  const totalNet     = sheets.reduce((a, s) => a + Number(s.net_salary), 0);
  const totalPaid    = sheets.reduce((a, s) => a + Number(s.amount_paid), 0);
  const totalBalance = totalNet - totalPaid;
  const paidCount    = sheets.filter(s => s.status === 'paid').length;
  const pendingCount = sheets.filter(s => s.status === 'pending').length;

  return (
    <div style={st.page}>
      {/* ── Header ── */}
      <div style={st.header}>
        <div>
          <h1 style={st.title}>Teacher Salaries</h1>
          <p style={st.subtitle}>{fmtMonth(currentMonth())} — current month salary sheets</p>
        </div>
        <button style={st.historyBtn} onClick={() => navigate('/salary/history')}>
          📋 View History
        </button>
      </div>

      {/* ── Auto-Generate Status Panel ── */}
      <div style={st.autoPanel}>
        <div style={st.autoPanelHeader} onClick={() => setAutoOpen(o => !o)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🤖</span>
            <div>
              <div style={st.autoPanelTitle}>Auto-Generate Scheduler</div>
              <div style={st.autoPanelSub}>
                {autoStatus?.scheduler?.running
                  ? `Running — next run: ${autoStatus.scheduler.next_run ? new Date(autoStatus.scheduler.next_run).toLocaleString() : 'unknown'}`
                  : 'Scheduler not running'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: autoStatus?.scheduler?.running ? '#f0fdf4' : '#fef2f2',
              color: autoStatus?.scheduler?.running ? '#15803d' : '#dc2626',
              border: `1px solid ${autoStatus?.scheduler?.running ? '#bbf7d0' : '#fecaca'}`,
            }}>
              {autoStatus?.scheduler?.running ? 'Active' : 'Inactive'}
            </span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>{autoOpen ? '▲' : '▼'}</span>
          </div>
        </div>

        {autoOpen && (
          <div style={st.autoPanelBody}>
            <p style={st.autoInfo}>
              Salary sheets are automatically generated on the <strong>1st of every month</strong>.
              A teacher receives their first salary sheet in the month <strong>after</strong> they join.
              Teachers without a <em>date of joining</em> or <em>basic salary</em> are skipped.
            </p>

            {/* Recent logs */}
            {autoStatus?.recent_logs?.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={st.sectionTitle}>Recent Runs</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Month', 'Created', 'Skipped', 'Status', 'Ran At'].map(h => (
                        <th key={h} style={st.logTh}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {autoStatus.recent_logs.map((l, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={st.logTd}>{fmtMonth(l.month)}</td>
                        <td style={st.logTd}>{l.created}</td>
                        <td style={st.logTd}>{l.skipped}</td>
                        <td style={st.logTd}>
                          <span style={{ color: l.success ? '#15803d' : '#dc2626', fontWeight: 700 }}>
                            {l.success ? '✓ OK' : '✗ Failed'}
                          </span>
                          {l.error && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 2 }}>{l.error}</div>}
                        </td>
                        <td style={st.logTd}>{new Date(l.ran_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Summary ── */}
      <div style={st.summaryRow}>
        <SCard label="Total Net Salary" value={`PKR ${totalNet.toLocaleString()}`}  color="#1d4ed8" bg="#eff6ff" />
        <SCard label="Total Paid"        value={`PKR ${totalPaid.toLocaleString()}`} color="#15803d" bg="#f0fdf4" />
        <SCard label="Balance Due"       value={`PKR ${totalBalance.toLocaleString()}`} color={totalBalance > 0 ? '#991b1b' : '#15803d'} bg={totalBalance > 0 ? '#fef2f2' : '#f0fdf4'} />
        <SCard label="Paid Sheets"       value={paidCount}    color="#15803d" bg="#f0fdf4" />
        <SCard label="Pending Sheets"    value={pendingCount} color="#c2410c" bg="#fff7ed" />
        <SCard label="Total Sheets"      value={sheets.length} color="#6366f1" bg="#f5f3ff" />
      </div>

      {/* ── Filters ── */}
      <div style={st.filterCard}>
        <div style={st.filterRow}>
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
          <div style={{ ...st.filterGroup, justifyContent: 'flex-end' }}>
            <label style={st.filterLabel}>&nbsp;</label>
            <button style={st.clearBtn} onClick={() => { setFilterTeacher(''); setFilterStatus(''); }}>
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* ── Sheet List ── */}
      {loading ? (
        <div style={st.empty}><div style={st.spinner} /><p style={{ color: '#94a3b8', margin: 0 }}>Loading…</p></div>
      ) : sheets.length === 0 ? (
        <div style={st.empty}><div style={{ fontSize: 40, marginBottom: 8 }}>💼</div><p style={{ color: '#94a3b8' }}>No salary sheets found.</p></div>
      ) : (
        <div style={st.list}>
          {sheets.map(s => {
            const sc   = STATUS_CFG[s.status] || STATUS_CFG.pending;
            const open = expanded === s.id;
            return (
              <div key={s.id} style={st.card}>
                {/* Card header */}
                <div style={st.cardTop} onClick={() => setExpanded(open ? null : s.id)}>
                  <div style={st.cardLeft}>
                    <div style={st.avatar}>{(s.teacher_name || '?')[0].toUpperCase()}</div>
                    <div>
                      <div style={st.teacherName}>{s.teacher_name}</div>
                      <div style={st.employeeId}>{s.employee_id} · {s.designation?.replace(/_/g, ' ')}</div>
                    </div>
                    <span style={st.monthPill}>{fmtMonth(s.month)}</span>
                    <span style={{ ...st.statusPill, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                      {sc.label}
                    </span>
                  </div>
                  <div style={st.cardRight}>
                    <div style={st.amtGroup}>
                      <span style={st.amtLabel}>Net Salary</span>
                      <span style={st.amtVal}>PKR {Number(s.net_salary).toLocaleString()}</span>
                    </div>
                    {s.balance > 0 && (
                      <div style={st.amtGroup}>
                        <span style={st.amtLabel}>Balance</span>
                        <span style={{ ...st.amtVal, color: '#dc2626' }}>PKR {Number(s.balance).toLocaleString()}</span>
                      </div>
                    )}
                    {s.status !== 'paid' && (
                      <button style={st.payBtn} onClick={e => { e.stopPropagation(); openPay(s); }}>
                        Record Payment
                      </button>
                    )}
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{open ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded body */}
                {open && (
                  <div style={st.cardBody}>
                    {/* Salary breakdown */}
                    <div style={st.sectionTitle}>Salary Breakdown</div>
                    <div style={st.breakdownGrid}>
                      <Row label="Basic Salary" value={`PKR ${Number(s.basic_salary).toLocaleString()}`} />
                      {s.components.filter(c => c.component_type === 'allowance').map((c, i) => (
                        <Row key={i} label={`+ ${c.label}`} value={`PKR ${Number(c.amount).toLocaleString()}`} color="#15803d" />
                      ))}
                      {s.components.filter(c => c.component_type === 'deduction').map((c, i) => (
                        <Row key={i} label={`− ${c.label}`} value={`PKR ${Number(c.amount).toLocaleString()}`} color="#dc2626" />
                      ))}
                      <Row label="Net Salary" value={`PKR ${Number(s.net_salary).toLocaleString()}`} bold />
                      <Row label="Amount Paid" value={`PKR ${Number(s.amount_paid).toLocaleString()}`} color="#15803d" />
                      {s.balance > 0 && <Row label="Balance" value={`PKR ${Number(s.balance).toLocaleString()}`} color="#dc2626" bold />}
                    </div>

                    {/* Payments */}
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

                    {s.note && (
                      <div style={st.noteBox}>Note: {s.note}</div>
                    )}

                    {/* Delete */}
                    {s.payments?.length === 0 && (
                      <button style={st.deleteBtn} onClick={() => handleDelete(s.id)}>Delete Sheet</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pay Modal ── */}
      {paySheet && (
        <div style={st.overlay} onClick={() => setPaySheet(null)}>
          <div style={{ ...st.modal, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <h3 style={st.modalTitle}>Record Payment</h3>
            <p style={st.modalSub}>{paySheet.teacher_name} — {fmtMonth(paySheet.month)}</p>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 14px' }}>
              Net Salary: <strong>PKR {Number(paySheet.net_salary).toLocaleString()}</strong> &nbsp;·&nbsp;
              Balance: <strong style={{ color: '#dc2626' }}>PKR {Number(paySheet.balance).toLocaleString()}</strong>
            </p>

            <label style={st.label}>Amount (PKR) *</label>
            <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} style={st.input} placeholder="Enter amount" />

            <label style={{ ...st.label, marginTop: 10 }}>Payment Method</label>
            <select value={payMethod} onChange={e => setPayMethod(e.target.value)} style={st.input}>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>

            <label style={{ ...st.label, marginTop: 10 }}>Payment Date</label>
            <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={st.input} />

            <label style={{ ...st.label, marginTop: 10 }}>Transaction ID / Reference</label>
            <input value={payTxn} onChange={e => setPayTxn(e.target.value)} style={st.input} placeholder="Optional" />

            <label style={{ ...st.label, marginTop: 10 }}>Note</label>
            <input value={payNote} onChange={e => setPayNote(e.target.value)} style={st.input} placeholder="Optional" />

            {payError && <div style={st.errorBox}>{payError}</div>}

            <div style={st.modalActions}>
              <button style={st.cancelBtn} onClick={() => setPaySheet(null)}>Cancel</button>
              <button style={st.submitBtn} onClick={handlePay} disabled={payLoading || !payAmount}>
                {payLoading ? 'Saving…' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
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
  title:       { margin: 0, fontSize: 26, fontWeight: 800, color: '#0f172a' },
  subtitle:    { margin: '4px 0 0', fontSize: 14, color: '#94a3b8' },
  historyBtn:  { padding: '10px 20px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14, color: '#475569', whiteSpace: 'nowrap' },

  summaryRow:  { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 },

  filterCard:  { background: '#fff', borderRadius: 12, padding: '16px 20px', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  filterRow:   { display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 140 },
  filterLabel: { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' },
  input:       { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', background: '#fff', outline: 'none', width: '100%', boxSizing: 'border-box' },
  clearBtn:    { padding: '9px 16px', background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#475569' },

  empty:       { background: '#fff', borderRadius: 12, padding: '60px 24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  spinner:     { width: 36, height: 36, border: '3px solid #e2e8f0', borderTop: '3px solid #1d4ed8', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' },

  list:        { display: 'flex', flexDirection: 'column', gap: 10 },
  card:        { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  cardTop:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer', gap: 12, flexWrap: 'wrap' },
  cardLeft:    { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  cardRight:   { display: 'flex', alignItems: 'center', gap: 14 },
  avatar:      { width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#1d4ed8,#7c3aed)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flexShrink: 0 },
  teacherName: { fontWeight: 700, fontSize: 14, color: '#0f172a' },
  employeeId:  { fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' },
  monthPill:   { background: '#eff6ff', color: '#1d4ed8', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  statusPill:  { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  amtGroup:    { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  amtLabel:    { fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' },
  amtVal:      { fontSize: 15, fontWeight: 700, color: '#0f172a' },
  payBtn:      { padding: '7px 14px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' },

  cardBody:    { padding: '4px 18px 16px', borderTop: '1px solid #f1f5f9' },
  sectionTitle:{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, marginTop: 12 },
  breakdownGrid: { display: 'flex', flexDirection: 'column', gap: 0 },
  payRow:      { display: 'flex', gap: 14, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f8fafc', fontSize: 13, flexWrap: 'wrap' },
  payMethod:   { background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 600 },
  payAmt:      { fontWeight: 700, color: '#15803d' },
  payDate:     { color: '#94a3b8', fontSize: 12 },
  payTxn:      { color: '#6366f1', fontSize: 12 },
  payBy:       { color: '#94a3b8', fontSize: 12 },
  noteBox:     { background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#c2410c', marginTop: 10 },
  deleteBtn:   { marginTop: 12, padding: '6px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#dc2626', fontWeight: 600 },

  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  modal:       { background: '#fff', borderRadius: 16, padding: '28px', maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' },
  modalTitle:  { margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#0f172a' },
  modalSub:    { margin: '0 0 16px', fontSize: 13, color: '#94a3b8' },
  label:       { display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' },
  modalActions:{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn:   { padding: '9px 18px', background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: 9, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  submitBtn:   { padding: '9px 22px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 14 },
  errorBox:    { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginTop: 12 },

  autoPanel:       { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' },
  autoPanelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer' },
  autoPanelTitle:  { fontSize: 14, fontWeight: 700, color: '#0f172a' },
  autoPanelSub:    { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  autoPanelBody:   { padding: '4px 18px 18px', borderTop: '1px solid #f1f5f9' },
  autoInfo:        { fontSize: 13, color: '#64748b', lineHeight: 1.6, margin: '12px 0' },
  logTh:           { padding: '6px 10px', background: '#f8fafc', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', borderBottom: '1px solid #f1f5f9' },
  logTd:           { padding: '7px 10px', fontSize: 12, color: '#334155', verticalAlign: 'top' },
};
