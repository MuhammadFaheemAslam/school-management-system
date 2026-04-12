import { useState, useRef } from 'react';
import api from '../../services/api';

const STATUS_CONFIG = {
  pending: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: 'Pending' },
  partial: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Partial' },
  paid:    { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Paid'    },
  overdue: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca', label: 'Overdue' },
};

const TYPE_ICONS = { admission: '🎓', monthly: '📅', annual: '📆' };
const METHOD_LABELS = { cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque', online: 'Online' };

const fmtMoney = (n) => `PKR ${Number(n || 0).toLocaleString()}`;

const fmtMonth = (m) => {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

export default function StudentLedgerPage() {
  const [searchInput,   setSearchInput]   = useState('');
  const [suggestions,   setSuggestions]   = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [ledger,        setLedger]        = useState(null);
  const [loading,       setLoading]       = useState(false);
  const [expandedId,    setExpandedId]    = useState(null);
  const debounceRef = useRef(null);

  const handleSearchChange = (val) => {
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    if (!val.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get(`/students/?search=${encodeURIComponent(val)}&limit=10`);
        setSuggestions(res.data.results || res.data || []);
      } catch { setSuggestions([]); }
      finally { setSearching(false); }
    }, 300);
  };

  const selectStudent = async (student) => {
    setSelectedStudent(student);
    setSuggestions([]);
    setSearchInput(student.full_name || student.name || `Student #${student.id}`);
    setLoading(true);
    setLedger(null);
    try {
      const res = await api.get(`/fees/student-ledger/${student.id}/`);
      setLedger(res.data);
    } catch (err) {
      setLedger({ error: err.response?.data?.error || 'Could not load ledger for this student.' });
    }
    finally { setLoading(false); }
  };

  const printLedger = () => {
    if (!ledger) return;
    const { student, summary, entries } = ledger;
    const rowsHtml = entries.map(e => {
      const sc = STATUS_CONFIG[e.status] || STATUS_CONFIG.pending;
      const typeIcon = TYPE_ICONS[e.type] || '📄';
      const label = e.type === 'monthly' ? fmtMonth(e.month) : e.type === 'annual' ? `Year ${e.year}` : 'Admission';
      const lineItemsStr = e.line_items.map(li => `${li.label}: PKR ${Number(li.amount).toLocaleString()}`).join(' | ');
      const paymentsHtml = e.payments.length
        ? e.payments.map(p =>
            `<tr style="background:#f8fafc"><td style="padding:4px 12px;color:#64748b;font-size:11px">↳ <b style="color:#16a34a">Paid on:</b> ${p.date}</td>
             <td style="padding:4px 12px;font-size:11px;color:#64748b">${METHOD_LABELS[p.method] || p.method}</td>
             <td style="padding:4px 12px;font-size:11px;color:#16a34a;font-weight:700">PKR ${Number(p.amount).toLocaleString()}</td>
             <td></td><td style="padding:4px 12px;font-size:11px;color:#475569">PKR ${Number(p.running_balance).toLocaleString()}</td>
             <td style="padding:4px 12px;font-size:11px;color:#64748b">${p.received_by}</td></tr>`).join('')
        : '';
      return `
        <tr>
          <td style="padding:8px 12px">${typeIcon} ${e.voucher_number}</td>
          <td style="padding:8px 12px">${label}</td>
          <td style="padding:8px 12px;font-size:11px;color:#475569">${lineItemsStr}${e.arrears > 0 ? ` | Arrears: PKR ${Number(e.arrears).toLocaleString()}` : ''}</td>
          <td style="padding:8px 12px;font-weight:700">PKR ${Number(e.total_amount).toLocaleString()}</td>
          <td style="padding:8px 12px;color:#16a34a;font-weight:700">PKR ${Number(e.amount_paid).toLocaleString()}</td>
          <td style="padding:8px 12px"><span style="background:${sc.bg};color:${sc.color};border:1px solid ${sc.border};padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">${sc.label}</span></td>
        </tr>
        ${paymentsHtml}
      `;
    }).join('');

    const w = window.open('', '_blank', 'width=860,height=700');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Fee Ledger – ${student.name}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI',Arial,sans-serif; background:#fff; color:#0f172a; padding:24px; }
h1 { font-size:20px; font-weight:800; color:#1e3a5f; }
.sub { color:#64748b; font-size:13px; margin-top:4px; }
.cards { display:flex; gap:16px; margin:16px 0; }
.card { flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; }
.card-label { font-size:11px; color:#64748b; font-weight:600; text-transform:uppercase; }
.card-val { font-size:18px; font-weight:800; margin-top:4px; }
table { width:100%; border-collapse:collapse; margin-top:16px; font-size:13px; }
th { background:#1e3a5f; color:#fff; padding:10px 12px; text-align:left; font-size:12px; }
tr:nth-child(even) { background:#f8fafc; }
@media print { body { padding:8px; } }
</style></head><body>
<h1>Fee Ledger — ${student.name}</h1>
<div class="sub">Adm# ${student.admission_number} &nbsp;|&nbsp; ${student.class_name} ${student.section_name ? '— ' + student.section_name : ''} &nbsp;|&nbsp; Roll# ${student.roll_number || '—'}</div>
<div class="cards">
  <div class="card"><div class="card-label">Total Billed</div><div class="card-val" style="color:#1e3a5f">${fmtMoney(summary.total_billed)}</div></div>
  <div class="card"><div class="card-label">Total Paid</div><div class="card-val" style="color:#16a34a">${fmtMoney(summary.total_paid)}</div></div>
  <div class="card"><div class="card-label">Balance Due</div><div class="card-val" style="color:${summary.total_balance > 0 ? '#dc2626' : '#16a34a'}">${fmtMoney(summary.total_balance)}</div></div>
  <div class="card"><div class="card-label">Vouchers</div><div class="card-val">${summary.voucher_count} total · ${summary.paid_count} paid · ${summary.unpaid_count} unpaid</div></div>
</div>
<table>
  <thead><tr><th>Voucher #</th><th>Period</th><th>Fee Breakdown</th><th>Total</th><th>Paid</th><th>Status</th></tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
<div style="margin-top:20px;text-align:right;font-size:11px;color:#94a3b8">Generated on ${new Date().toLocaleString()}</div>
<div class="no-print" style="text-align:center;margin-top:20px">
  <button onclick="window.print()" style="padding:10px 24px;background:#1e3a5f;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700">🖨 Print Ledger</button>
</div>
</body></html>`);
    w.document.close();
  };

  return (
    <div style={s.page}>
      {/* Search bar */}
      <div style={s.searchBox}>
        <div style={s.searchHeader}>
          <span style={{ fontSize: 24 }}>📒</span>
          <div>
            <div style={s.searchTitle}>Student Fee Ledger</div>
            <div style={s.searchSub}>Search a student to view their complete fee history</div>
          </div>
        </div>
        <div style={s.searchInputWrap}>
          <input
            style={s.searchInput}
            placeholder="Search by name, admission number..."
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
            onBlur={() => setTimeout(() => setSuggestions([]), 150)}
          />
          {searching && <span style={s.searchSpinner}>⏳</span>}
        </div>
        {suggestions.length > 0 && (
          <div style={s.dropdown}>
            {suggestions.map(st => (
              <div
                key={st.id}
                style={s.dropItem}
                onMouseDown={e => { e.preventDefault(); selectStudent(st); }}
              >
                <span style={s.dropName}>{st.full_name || `Student #${st.id}`}</span>
                <span style={s.dropMeta}>{st.admission_number}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={s.center}><span style={s.spinner} />Loading ledger…</div>
      )}

      {/* No student selected */}
      {!loading && !ledger && (
        <div style={s.empty}>
          <div style={{ fontSize: 48 }}>📒</div>
          <div style={s.emptyTitle}>No student selected</div>
          <div style={s.emptySub}>Search for a student above to view their complete fee ledger</div>
        </div>
      )}

      {/* Ledger */}
      {ledger?.error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '16px 20px', color: '#dc2626', fontSize: 14, marginBottom: 16 }}>
          ⚠ {ledger.error}
        </div>
      )}

      {ledger && !ledger.error && (
        <>
          {/* Student info card */}
          <div style={s.studentCard}>
            <div style={s.studentInfo}>
              <div style={s.studentAvatar}>{ledger.student.name.charAt(0).toUpperCase()}</div>
              <div>
                <div style={s.studentName}>{ledger.student.name}</div>
                <div style={s.studentMeta}>
                  Adm# <b>{ledger.student.admission_number}</b>
                  {ledger.student.class_name && <> &nbsp;·&nbsp; {ledger.student.class_name}{ledger.student.section_name ? ` — ${ledger.student.section_name}` : ''}</>}
                  {ledger.student.roll_number && <> &nbsp;·&nbsp; Roll# {ledger.student.roll_number}</>}
                </div>
              </div>
            </div>
            <button onClick={printLedger} style={s.printBtn}>🖨 Print Ledger</button>
          </div>

          {/* Summary cards */}
          <div style={s.summaryRow}>
            <SummaryCard label="Total Billed"  value={fmtMoney(ledger.summary.total_billed)}  color="#1e3a5f" />
            <SummaryCard label="Total Paid"    value={fmtMoney(ledger.summary.total_paid)}    color="#16a34a" />
            <SummaryCard label="Balance Due"   value={fmtMoney(ledger.summary.total_balance)} color={ledger.summary.total_balance > 0 ? '#dc2626' : '#16a34a'} />
            <SummaryCard label="Total Vouchers" value={`${ledger.summary.voucher_count} total`} sub={`${ledger.summary.paid_count} paid · ${ledger.summary.unpaid_count} unpaid`} color="#6366f1" />
          </div>

          {/* Entries table */}
          {ledger.entries.length === 0 ? (
            <div style={s.empty}>
              <div style={{ fontSize: 36 }}>📭</div>
              <div style={s.emptyTitle}>No fee records found</div>
              <div style={s.emptySub}>This student has no fee vouchers yet. Vouchers are created when monthly fees are generated or when the student is enrolled.</div>
            </div>
          ) : (
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    <th style={s.th}>Voucher #</th>
                    <th style={s.th}>Period</th>
                    <th style={s.th}>Fee Breakdown</th>
                    <th style={s.th}>Total</th>
                    <th style={s.th}>Paid</th>
                    <th style={s.th}>Balance</th>
                    <th style={s.th}>Status</th>
                    <th style={s.th}>Payments</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.entries.map((entry, i) => {
                    const sc = STATUS_CONFIG[entry.status] || STATUS_CONFIG.pending;
                    const isExpanded = expandedId === entry.id;
                    const label = entry.type === 'monthly'
                      ? fmtMonth(entry.month)
                      : entry.type === 'annual'
                      ? `Year ${entry.year}`
                      : 'Admission';
                    return (
                      <>
                        <tr key={entry.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                          <td style={s.td}>
                            <span style={s.typeIcon}>{TYPE_ICONS[entry.type] || '📄'}</span>
                            <span style={s.voucherNum}>{entry.voucher_number}</span>
                          </td>
                          <td style={s.td}><span style={s.periodLabel}>{label}</span></td>
                          <td style={s.td}>
                            <div style={s.lineItems}>
                              {entry.line_items.map((li, j) => (
                                <span key={j} style={s.lineItem}>{li.label}: <b>PKR {Number(li.amount).toLocaleString()}</b></span>
                              ))}
                              {entry.arrears > 0 && (
                                <span style={{ ...s.lineItem, color: '#dc2626' }}>⚠ Arrears: <b>PKR {Number(entry.arrears).toLocaleString()}</b></span>
                              )}
                            </div>
                          </td>
                          <td style={{ ...s.td, fontWeight: 700 }}>{fmtMoney(entry.total_amount)}</td>
                          <td style={{ ...s.td, color: '#16a34a', fontWeight: 700 }}>{fmtMoney(entry.amount_paid)}</td>
                          <td style={{ ...s.td, color: entry.balance > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>{fmtMoney(entry.balance)}</td>
                          <td style={s.td}>
                            <span style={{ ...s.badge, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                              {sc.label}
                            </span>
                          </td>
                          <td style={s.td}>
                            {entry.payments.length > 0 ? (
                              <button
                                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                                style={s.expandBtn}
                              >
                                {isExpanded ? '▲' : '▼'} {entry.payments.length} payment{entry.payments.length > 1 ? 's' : ''}
                              </button>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && entry.payments.map((p, pi) => (
                          <tr key={`p-${pi}`} style={{ background: '#f0fdf4' }}>
                            <td style={{ ...s.td, paddingLeft: 32, color: '#64748b', fontSize: 12 }} colSpan={2}>
                              ↳ <span style={{ fontWeight: 600, color: '#16a34a' }}>Paid on:</span> {p.date}
                            </td>
                            <td style={{ ...s.td, fontSize: 12, color: '#475569' }}>{METHOD_LABELS[p.method] || p.method}{p.transaction_id ? ` · Ref: ${p.transaction_id}` : ''}</td>
                            <td style={{ ...s.td, color: '#16a34a', fontWeight: 700 }}>+{fmtMoney(p.amount)}</td>
                            <td style={{ ...s.td, fontSize: 12, color: '#64748b' }} colSpan={2}>
                              Running balance: <b style={{ color: p.running_balance > 0 ? '#dc2626' : '#16a34a' }}>{fmtMoney(p.running_balance)}</b>
                            </td>
                            <td style={{ ...s.td, fontSize: 12, color: '#475569' }}>{p.received_by || '—'}</td>
                            <td style={s.td} />
                          </tr>
                        ))}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, color }) {
  return (
    <div style={s.card}>
      <div style={s.cardLabel}>{label}</div>
      <div style={{ ...s.cardValue, color }}>{value}</div>
      {sub && <div style={s.cardSub}>{sub}</div>}
    </div>
  );
}

const s = {
  page:         { padding: '0 0 40px' },
  searchBox:    { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', marginBottom: 24, position: 'relative' },
  searchHeader: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  searchTitle:  { fontSize: 18, fontWeight: 700, color: '#1e3a5f' },
  searchSub:    { fontSize: 13, color: '#64748b', marginTop: 2 },
  searchInputWrap: { position: 'relative' },
  searchInput:  { width: '100%', padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  searchSpinner:{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' },
  dropdown:     { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, maxHeight: 260, overflowY: 'auto', marginTop: 4 },
  dropItem:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' },
  dropName:     { fontWeight: 600, fontSize: 14, color: '#1e293b' },
  dropMeta:     { fontSize: 12, color: '#94a3b8' },
  studentCard:  { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 24px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  studentInfo:  { display: 'flex', alignItems: 'center', gap: 14 },
  studentAvatar:{ width: 48, height: 48, borderRadius: '50%', background: '#1e3a5f', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 },
  studentName:  { fontSize: 18, fontWeight: 700, color: '#1e293b' },
  studentMeta:  { fontSize: 13, color: '#64748b', marginTop: 4 },
  printBtn:     { padding: '8px 20px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' },
  summaryRow:   { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 },
  card:         { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px' },
  cardLabel:    { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' },
  cardValue:    { fontSize: 20, fontWeight: 800, marginTop: 6 },
  cardSub:      { fontSize: 12, color: '#64748b', marginTop: 4 },
  tableWrap:    { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' },
  table:        { width: '100%', borderCollapse: 'collapse' },
  thead:        { background: '#1e3a5f' },
  th:           { padding: '12px 14px', color: '#fff', fontSize: 12, fontWeight: 700, textAlign: 'left' },
  td:           { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  typeIcon:     { marginRight: 6 },
  voucherNum:   { fontWeight: 700, fontSize: 13, color: '#1e293b', fontFamily: 'monospace' },
  periodLabel:  { fontSize: 13, fontWeight: 600, color: '#475569' },
  lineItems:    { display: 'flex', flexDirection: 'column', gap: 2 },
  lineItem:     { fontSize: 12, color: '#475569' },
  badge:        { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 },
  expandBtn:    { background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#475569', fontFamily: 'inherit' },
  center:       { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 40, color: '#64748b' },
  spinner:      { display: 'inline-block', width: 18, height: 18, border: '2px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
  empty:        { textAlign: 'center', padding: '60px 20px', color: '#94a3b8' },
  emptyTitle:   { fontSize: 18, fontWeight: 700, marginTop: 12, color: '#64748b' },
  emptySub:     { fontSize: 13, marginTop: 6 },
};
