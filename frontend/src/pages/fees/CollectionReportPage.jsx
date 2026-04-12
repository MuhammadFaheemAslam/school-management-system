import { useEffect, useState, useMemo } from 'react';
import api from '../../services/api';

const METHOD_CONFIG = {
  cash:          { label: 'Cash',          icon: '💵', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  bank_transfer: { label: 'Bank Transfer', icon: '🏦', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  cheque:        { label: 'Cheque',        icon: '📝', color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
  online:        { label: 'Online',        icon: '💻', color: '#7c3aed', bg: '#ede9fe', border: '#ddd6fe' },
};

const TYPE_CONFIG = {
  admission: { label: 'Admission Fees', icon: '🎓', color: '#7c3aed', bg: '#ede9fe' },
  monthly:   { label: 'Monthly Fees',   icon: '📅', color: '#1d4ed8', bg: '#eff6ff' },
  annual:    { label: 'Annual Fees',    icon: '📆', color: '#b45309', bg: '#fef3c7' },
};

const MODES = [
  { key: 'daily',   label: 'Daily',   icon: '📆' },
  { key: 'monthly', label: 'Monthly', icon: '📅' },
  { key: 'yearly',  label: 'Yearly',  icon: '📊' },
];

const fmtMoney = (n) => `PKR ${Number(n || 0).toLocaleString()}`;
const fmtMonth = (m) => {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
};
const today = () => new Date().toISOString().split('T')[0];
const curMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const curYear  = () => String(new Date().getFullYear());

export default function CollectionReportPage() {
  const [mode,    setMode]    = useState('daily');
  const [date,    setDate]    = useState(today());
  const [month,   setMonth]   = useState(curMonth());
  const [year,    setYear]    = useState(curYear());
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => { fetchReport(); }, [mode, date, month, year]);

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ mode });
      if (mode === 'daily')   params.append('date',  date);
      if (mode === 'monthly') params.append('month', month);
      if (mode === 'yearly')  params.append('year',  year);
      const res = await api.get(`/fees/collection-report/?${params}`);
      setData(res.data);
    } catch (err) {
      setData(null);
      const msg = err.response?.data?.error || err.response?.statusText || 'Failed to load report.';
      setError(`${err.response?.status || ''} ${msg}`.trim());
    }
    finally { setLoading(false); }
  };

  // Build breakdown bar chart data
  const breakdownEntries = useMemo(() => {
    if (!data?.breakdown) return [];
    return Object.entries(data.breakdown)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({ key, ...val }));
  }, [data]);

  const maxBreakdown = useMemo(() => Math.max(...breakdownEntries.map(e => e.total), 1), [breakdownEntries]);

  const printReport = () => {
    if (!data) return;
    const methodRows = Object.entries(data.by_method).map(([m, v]) => {
      const cfg = METHOD_CONFIG[m] || { label: m, icon: '💳' };
      return `<tr><td>${cfg.icon} ${cfg.label}</td><td style="text-align:right;font-weight:700">${fmtMoney(v.total)}</td><td style="text-align:right;color:#64748b">${v.count}</td></tr>`;
    }).join('');
    const typeRows = Object.entries(data.by_type).map(([t, v]) => {
      const cfg = TYPE_CONFIG[t] || { label: t, icon: '📄' };
      return `<tr><td>${cfg.icon} ${cfg.label}</td><td style="text-align:right;font-weight:700">${fmtMoney(v.total)}</td><td style="text-align:right;color:#64748b">${v.count}</td></tr>`;
    }).join('');
    const txRows = data.recent_transactions.map(tx => `<tr>
      <td>${tx.date}</td><td>${tx.student_name}</td><td>${tx.admission_number}</td>
      <td>${tx.class_section}</td><td>${tx.voucher_number}</td>
      <td>${(METHOD_CONFIG[tx.method] || {}).label || tx.method}</td>
      <td style="text-align:right;font-weight:700;color:#16a34a">${fmtMoney(tx.amount)}</td>
      <td>${tx.received_by || '—'}</td>
    </tr>`).join('');

    const w = window.open('', '_blank', 'width=900,height=750');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Collection Report – ${data.label}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI',Arial,sans-serif; background:#fff; color:#0f172a; padding:24px; }
h1 { font-size:20px; font-weight:800; color:#1e3a5f; }
.sub { color:#64748b; font-size:13px; margin-top:4px; }
.total-box { margin:16px 0; background:#1e3a5f; color:#fff; border-radius:10px; padding:16px 24px; display:inline-block; }
.total-label { font-size:12px; opacity:0.8; }
.total-val { font-size:28px; font-weight:800; }
.grid { display:flex; gap:24px; margin:16px 0; }
.col { flex:1; }
h2 { font-size:14px; font-weight:700; color:#1e3a5f; margin-bottom:8px; }
table { width:100%; border-collapse:collapse; font-size:13px; }
th { background:#f1f5f9; padding:8px 10px; text-align:left; font-size:11px; color:#475569; border-bottom:2px solid #e2e8f0; }
td { padding:8px 10px; border-bottom:1px solid #f1f5f9; }
.tx-table { margin-top:16px; }
@media print { body { padding:8px; } .no-print { display:none; } }
</style></head><body>
<h1>Fee Collection Report</h1>
<div class="sub">${data.label} &nbsp;·&nbsp; ${data.date_from}${data.date_from !== data.date_to ? ' to ' + data.date_to : ''}</div>
<div class="total-box"><div class="total-label">TOTAL COLLECTED</div><div class="total-val">${fmtMoney(data.total_collected)}</div></div>
<div class="grid">
  <div class="col"><h2>By Payment Method</h2><table><thead><tr><th>Method</th><th style="text-align:right">Amount</th><th style="text-align:right">Txns</th></tr></thead><tbody>${methodRows}</tbody></table></div>
  <div class="col"><h2>By Fee Type</h2><table><thead><tr><th>Type</th><th style="text-align:right">Amount</th><th style="text-align:right">Txns</th></tr></thead><tbody>${typeRows}</tbody></table></div>
</div>
<div class="tx-table"><h2>Recent Transactions (${data.recent_transactions.length})</h2>
<table><thead><tr><th>Date</th><th>Student</th><th>Adm#</th><th>Class</th><th>Voucher</th><th>Method</th><th style="text-align:right">Amount</th><th>Received By</th></tr></thead>
<tbody>${txRows}</tbody></table></div>
<div style="margin-top:20px;text-align:right;font-size:11px;color:#94a3b8">Generated on ${new Date().toLocaleString()}</div>
<div class="no-print" style="text-align:center;margin-top:20px">
  <button onclick="window.print()" style="padding:10px 24px;background:#1e3a5f;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700">🖨 Print Report</button>
</div></body></html>`);
    w.document.close();
  };

  return (
    <div style={s.page}>
      {/* Header + mode tabs */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={{ fontSize: 24 }}>📊</span>
          <div>
            <div style={s.title}>Fee Collection Report</div>
            <div style={s.sub}>Track how much has been collected — by day, month, or year</div>
          </div>
        </div>
        <div style={s.controls}>
          <div style={s.modeTabs}>
            {MODES.map(m => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                style={{ ...s.modeTab, ...(mode === m.key ? s.modeTabActive : {}) }}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>
          {mode === 'daily'   && <input type="date"  value={date}  onChange={e => setDate(e.target.value)}   style={s.picker} />}
          {mode === 'monthly' && <input type="month" value={month} onChange={e => setMonth(e.target.value)}  style={s.picker} />}
          {mode === 'yearly'  && (
            <select value={year} onChange={e => setYear(e.target.value)} style={s.picker}>
              {Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i)).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
          {data && <button onClick={printReport} style={s.printBtn}>🖨 Print</button>}
        </div>
      </div>

      {loading && (
        <div style={s.center}><span style={s.spinner} /> Loading report…</div>
      )}

      {!loading && data && (
        <>
          {/* Total collected hero */}
          <div style={s.heroCard}>
            <div>
              <div style={s.heroLabel}>Total Collected</div>
              <div style={s.heroValue}>{fmtMoney(data.total_collected)}</div>
              <div style={s.heroSub}>{data.label}</div>
            </div>
            <div style={s.heroTxCount}>
              <div style={s.heroTxNum}>{data.recent_transactions.length}</div>
              <div style={s.heroTxLabel}>transactions</div>
            </div>
          </div>

          {/* By method + By type */}
          <div style={s.twoCol}>
            {/* By payment method */}
            <div style={s.sectionCard}>
              <div style={s.sectionTitle}>By Payment Method</div>
              {Object.keys(data.by_method).length === 0 ? (
                <div style={s.noData}>No data</div>
              ) : (
                Object.entries(data.by_method).map(([m, v]) => {
                  const cfg = METHOD_CONFIG[m] || { label: m, icon: '💳', color: '#475569', bg: '#f1f5f9', border: '#e2e8f0' };
                  const pct = data.total_collected > 0 ? (v.total / data.total_collected) * 100 : 0;
                  return (
                    <div key={m} style={s.methodRow}>
                      <div style={s.methodLeft}>
                        <span style={{ ...s.methodIcon, background: cfg.bg, border: `1px solid ${cfg.border}` }}>{cfg.icon}</span>
                        <div>
                          <div style={s.methodLabel}>{cfg.label}</div>
                          <div style={s.methodCount}>{v.count} transaction{v.count !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                      <div style={s.methodRight}>
                        <div style={s.methodAmount}>{fmtMoney(v.total)}</div>
                        <div style={s.barTrack}>
                          <div style={{ ...s.barFill, width: `${pct}%`, background: cfg.color }} />
                        </div>
                        <div style={s.methodPct}>{pct.toFixed(1)}%</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* By fee type */}
            <div style={s.sectionCard}>
              <div style={s.sectionTitle}>By Fee Type</div>
              {Object.keys(data.by_type).length === 0 ? (
                <div style={s.noData}>No data</div>
              ) : (
                Object.entries(data.by_type).map(([t, v]) => {
                  const cfg = TYPE_CONFIG[t] || { label: t, icon: '📄', color: '#475569', bg: '#f1f5f9' };
                  const pct = data.total_collected > 0 ? (v.total / data.total_collected) * 100 : 0;
                  return (
                    <div key={t} style={s.methodRow}>
                      <div style={s.methodLeft}>
                        <span style={{ ...s.methodIcon, background: cfg.bg }}>{cfg.icon}</span>
                        <div>
                          <div style={s.methodLabel}>{cfg.label}</div>
                          <div style={s.methodCount}>{v.count} payment{v.count !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                      <div style={s.methodRight}>
                        <div style={s.methodAmount}>{fmtMoney(v.total)}</div>
                        <div style={s.barTrack}>
                          <div style={{ ...s.barFill, width: `${pct}%`, background: cfg.color }} />
                        </div>
                        <div style={s.methodPct}>{pct.toFixed(1)}%</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Breakdown chart (monthly/yearly only) */}
          {breakdownEntries.length > 0 && (
            <div style={s.sectionCard}>
              <div style={s.sectionTitle}>
                {mode === 'monthly' ? 'Daily Breakdown' : 'Monthly Breakdown'}
              </div>
              <div style={s.chartWrap}>
                {breakdownEntries.map(entry => {
                  const pct = (entry.total / maxBreakdown) * 100;
                  const label = mode === 'yearly' ? fmtMonth(entry.key) : entry.key.split('-')[2];
                  return (
                    <div key={entry.key} style={s.barCol}>
                      <div style={s.barAmtLabel}>{entry.total >= 1000 ? `${(entry.total / 1000).toFixed(1)}k` : entry.total}</div>
                      <div style={s.barColTrack}>
                        <div style={{ ...s.barColFill, height: `${pct}%` }} />
                      </div>
                      <div style={s.barColLabel}>{label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent transactions */}
          <div style={s.sectionCard}>
            <div style={s.sectionTitle}>
              Recent Transactions
              <span style={s.countBadge}>{data.recent_transactions.length}</span>
            </div>
            {data.recent_transactions.length === 0 ? (
              <div style={s.noData}>No transactions in this period</div>
            ) : (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr style={s.thead}>
                      <th style={s.th}>Date</th>
                      <th style={s.th}>Student</th>
                      <th style={s.th}>Class</th>
                      <th style={s.th}>Voucher</th>
                      <th style={s.th}>Method</th>
                      <th style={s.th}>Amount</th>
                      <th style={s.th}>Received By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_transactions.map((tx, i) => {
                      const cfg = METHOD_CONFIG[tx.method] || { label: tx.method, icon: '💳' };
                      return (
                        <tr key={tx.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                          <td style={s.td}>{tx.date}</td>
                          <td style={s.td}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{tx.student_name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{tx.admission_number}</div>
                          </td>
                          <td style={{ ...s.td, fontSize: 12, color: '#475569' }}>{tx.class_section || '—'}</td>
                          <td style={{ ...s.td, fontSize: 12, fontFamily: 'monospace', color: '#475569' }}>{tx.voucher_number}</td>
                          <td style={s.td}>
                            <span style={{ fontSize: 13 }}>{cfg.icon} {cfg.label}</span>
                            {tx.transaction_id && <div style={{ fontSize: 11, color: '#94a3b8' }}>{tx.transaction_id}</div>}
                          </td>
                          <td style={{ ...s.td, fontWeight: 700, color: '#16a34a' }}>{fmtMoney(tx.amount)}</td>
                          <td style={{ ...s.td, fontSize: 12, color: '#475569' }}>{tx.received_by || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {!loading && error && (
        <div style={s.errorBox}>
          <div style={{ fontSize: 32 }}>⚠</div>
          <div style={s.errorTitle}>Could not load report</div>
          <div style={s.errorMsg}>{error}</div>
          {error.includes('403') && (
            <div style={s.errorHint}>You may not have permission, or the server needs to be restarted.</div>
          )}
        </div>
      )}

      {!loading && !data && !error && (
        <div style={s.empty}>
          <div style={{ fontSize: 48 }}>📊</div>
          <div style={s.emptyTitle}>No data available</div>
          <div style={s.emptySub}>No payments found for the selected period</div>
        </div>
      )}
    </div>
  );
}

const s = {
  page:         { padding: '0 0 40px' },
  header:       { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 24px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  headerLeft:   { display: 'flex', alignItems: 'center', gap: 12 },
  title:        { fontSize: 18, fontWeight: 700, color: '#1e3a5f' },
  sub:          { fontSize: 13, color: '#64748b', marginTop: 2 },
  controls:     { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  modeTabs:     { display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2 },
  modeTab:      { padding: '6px 14px', background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#64748b', fontFamily: 'inherit', transition: 'all 0.15s' },
  modeTabActive:{ background: '#fff', color: '#1e3a5f', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' },
  picker:       { padding: '6px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' },
  printBtn:     { padding: '7px 16px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' },
  heroCard:     { background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)', borderRadius: 12, padding: '24px 32px', marginBottom: 20, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel:    { fontSize: 13, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 },
  heroValue:    { fontSize: 36, fontWeight: 800, marginTop: 4 },
  heroSub:      { fontSize: 14, opacity: 0.7, marginTop: 4 },
  heroTxCount:  { textAlign: 'center' },
  heroTxNum:    { fontSize: 36, fontWeight: 800 },
  heroTxLabel:  { fontSize: 13, opacity: 0.7 },
  twoCol:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  sectionCard:  { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px', marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#1e3a5f', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 },
  countBadge:   { background: '#f1f5f9', color: '#475569', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 20 },
  methodRow:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f1f5f9' },
  methodLeft:   { display: 'flex', alignItems: 'center', gap: 10 },
  methodIcon:   { width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 },
  methodLabel:  { fontSize: 14, fontWeight: 600, color: '#1e293b' },
  methodCount:  { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  methodRight:  { textAlign: 'right', minWidth: 160 },
  methodAmount: { fontSize: 16, fontWeight: 700, color: '#1e293b' },
  barTrack:     { height: 4, background: '#f1f5f9', borderRadius: 4, marginTop: 6, width: 140 },
  barFill:      { height: '100%', borderRadius: 4, transition: 'width 0.3s' },
  methodPct:    { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  chartWrap:    { display: 'flex', alignItems: 'flex-end', gap: 6, height: 160, overflowX: 'auto', paddingBottom: 4 },
  barCol:       { display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 32, flex: '0 0 auto' },
  barAmtLabel:  { fontSize: 9, color: '#94a3b8', marginBottom: 4, whiteSpace: 'nowrap' },
  barColTrack:  { width: 24, height: 100, background: '#f1f5f9', borderRadius: 4, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' },
  barColFill:   { width: '100%', background: '#3b82f6', borderRadius: 4, minHeight: 2, transition: 'height 0.3s' },
  barColLabel:  { fontSize: 10, color: '#64748b', marginTop: 4, transform: 'rotate(-45deg)', transformOrigin: 'top left', whiteSpace: 'nowrap' },
  tableWrap:    { overflowX: 'auto' },
  table:        { width: '100%', borderCollapse: 'collapse', minWidth: 700 },
  thead:        { background: '#f8fafc' },
  th:           { padding: '10px 12px', color: '#475569', fontSize: 11, fontWeight: 700, textAlign: 'left', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase' },
  td:           { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  center:       { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 60, color: '#64748b' },
  spinner:      { display: 'inline-block', width: 18, height: 18, border: '2px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
  empty:        { textAlign: 'center', padding: '60px 20px', color: '#94a3b8' },
  emptyTitle:   { fontSize: 18, fontWeight: 700, marginTop: 12, color: '#64748b' },
  emptySub:     { fontSize: 13, marginTop: 6 },
  noData:       { color: '#94a3b8', fontSize: 13, padding: '16px 0' },
  errorBox:     { textAlign: 'center', padding: '48px 20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#dc2626' },
  errorTitle:   { fontSize: 16, fontWeight: 700, marginTop: 10 },
  errorMsg:     { fontSize: 13, marginTop: 6, fontFamily: 'monospace' },
  errorHint:    { fontSize: 12, marginTop: 10, color: '#b91c1c', background: '#fee2e2', borderRadius: 8, padding: '8px 16px', display: 'inline-block' },
};
