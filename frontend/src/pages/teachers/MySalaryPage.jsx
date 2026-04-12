import { useEffect, useState } from 'react';
import api from '../../services/api';

const STATUS_CFG = {
  pending: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: 'Pending',  dot: '#f97316' },
  partial: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Partial',  dot: '#3b82f6' },
  paid:    { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Paid',     dot: '#22c55e' },
};

const METHOD_ICONS  = { cash: '💵', bank_transfer: '🏦', cheque: '📄' };
const METHOD_LABELS = { cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque' };

const fmt  = (n) => 'PKR ' + Number(n || 0).toLocaleString();
const fmtMonth = (m) => {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};
const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/* ── inject keyframes once ────────────────────────────────────────────────── */
if (!document.getElementById('my-sal-styles')) {
  const s = document.createElement('style');
  s.id = 'my-sal-styles';
  s.textContent = `
    @keyframes salFadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    @keyframes salPulse  { 0%,100%{opacity:1} 50%{opacity:.55} }
    .sal-card { transition: box-shadow .18s; }
    .sal-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.10) !important; }
    .sal-filter-btn { transition: all .15s; }
    .sal-filter-btn:hover { filter: brightness(0.95); }
  `;
  document.head.appendChild(s);
}

export default function MySalaryPage() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [filter, setFilter]     = useState('all');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.get('/teachers/my-salary/')
      .then(r => { setData(r.data); setExpanded(r.data?.sheets?.[0]?.id ?? null); })
      .catch(() => setError('Could not load your salary records.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={st.page}>
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 32, animation: 'salPulse 1.2s infinite' }}>💼</div>
        <p style={{ color: '#94a3b8', marginTop: 12 }}>Loading salary data…</p>
      </div>
    </div>
  );
  if (error) return <div style={st.page}><div style={st.errorBox}>{error}</div></div>;

  const { sheets, summary } = data;
  const currentSheet = sheets.find(s => s.month === currentMonth());
  const filtered = filter === 'all' ? sheets : sheets.filter(s => s.status === filter);

  return (
    <div style={st.page}>

      {/* ── Hero Banner ──────────────────────────────────────────────────── */}
      <div style={st.hero}>
        <div style={st.heroLeft}>
          <div style={st.heroIcon}>💼</div>
          <div>
            <div style={st.heroTitle}>My Salary Portal</div>
            <div style={st.heroSub}>
              {currentSheet
                ? `${fmtMonth(currentSheet.month)} · ${STATUS_CFG[currentSheet.status]?.label}`
                : 'Your personal salary dashboard'}
            </div>
          </div>
        </div>
        {currentSheet && (
          <div style={st.heroRight}>
            <div style={st.heroLabel}>This Month's Net Salary</div>
            <div style={st.heroAmount}>{fmt(currentSheet.net_salary)}</div>
            {currentSheet.balance > 0 && (
              <div style={st.heroBadge}>Balance Due: {fmt(currentSheet.balance)}</div>
            )}
            {currentSheet.status === 'paid' && (
              <div style={{ ...st.heroBadge, background: 'rgba(34,197,94,0.18)', color: '#bbf7d0' }}>✓ Fully Paid</div>
            )}
          </div>
        )}
      </div>

      {/* ── Summary Cards ────────────────────────────────────────────────── */}
      <div style={st.statsGrid}>
        <StatCard icon="💰" label="Total Earned"   value={fmt(summary.total_net)}     accent="#6366f1" />
        <StatCard icon="✅" label="Total Received" value={fmt(summary.total_paid)}    accent="#22c55e" />
        <StatCard icon="⏳" label="Pending Balance"
          value={fmt(summary.total_balance)}
          accent={summary.total_balance > 0 ? '#ef4444' : '#22c55e'} />
        <StatCard icon="📅" label="Total Slips"    value={sheets.length}              accent="#f59e0b" sub={`${summary.paid_count} paid · ${summary.pending_count} pending · ${summary.partial_count} partial`} />
      </div>

      {/* ── Filter Tabs ──────────────────────────────────────────────────── */}
      <div style={st.filterRow}>
        <span style={st.filterLabel}>Filter:</span>
        {[
          { key: 'all',     label: 'All Slips',  icon: '📋' },
          { key: 'pending', label: 'Pending',    icon: '⏳' },
          { key: 'partial', label: 'Partial',    icon: '🔵' },
          { key: 'paid',    label: 'Paid',       icon: '✅' },
        ].map(f => (
          <button key={f.key} className="sal-filter-btn"
            onClick={() => setFilter(f.key)}
            style={{
              ...st.filterBtn,
              background: filter === f.key ? '#1e293b' : '#fff',
              color:      filter === f.key ? '#fff'    : '#475569',
              border:     filter === f.key ? '1.5px solid #1e293b' : '1.5px solid #e2e8f0',
              boxShadow:  filter === f.key ? '0 2px 8px rgba(30,41,59,0.18)' : 'none',
            }}>
            <span style={{ marginRight: 5 }}>{f.icon}</span>{f.label}
            {f.key !== 'all' && <span style={{
              marginLeft: 6, background: filter === f.key ? 'rgba(255,255,255,0.2)' : '#f1f5f9',
              color: filter === f.key ? '#fff' : '#64748b',
              borderRadius: 20, padding: '0 7px', fontSize: 11, fontWeight: 700
            }}>
              {f.key === 'pending' ? summary.pending_count : f.key === 'partial' ? summary.partial_count : summary.paid_count}
            </span>}
          </button>
        ))}
      </div>

      {/* ── Salary Slips ─────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={st.emptyBox}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
          <div style={{ fontWeight: 600, color: '#475569' }}>No salary slips found</div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>Try a different filter</div>
        </div>
      ) : (
        <div style={st.list}>
          {filtered.map((s, idx) => {
            const sc  = STATUS_CFG[s.status] || STATUS_CFG.pending;
            const open = expanded === s.id;
            const isCurrentMonth = s.month === currentMonth();
            return (
              <div key={s.id} className="sal-card"
                style={{ ...st.card, borderLeft: `4px solid ${sc.dot}`, animation: `salFadeUp .25s ease ${idx * 0.04}s both` }}>

                {/* Card Header */}
                <div style={st.cardTop} onClick={() => setExpanded(open ? null : s.id)}>
                  <div style={st.cardLeft}>
                    {isCurrentMonth && <span style={st.currentBadge}>Current Month</span>}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={st.monthName}>{fmtMonth(s.month)}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>Generated automatically</span>
                    </div>
                    <span style={{ ...st.statusPill, background: sc.bg, color: sc.color, border: `1.5px solid ${sc.border}` }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: sc.dot, display: 'inline-block', marginRight: 5 }} />
                      {sc.label}
                    </span>
                  </div>

                  <div style={st.cardRight}>
                    <div style={st.amtBlock}>
                      <span style={st.amtLabel}>Net Salary</span>
                      <span style={st.amtVal}>{fmt(s.net_salary)}</span>
                    </div>
                    {s.amount_paid > 0 && (
                      <div style={st.amtBlock}>
                        <span style={st.amtLabel}>Received</span>
                        <span style={{ ...st.amtVal, color: '#15803d', fontSize: 14 }}>{fmt(s.amount_paid)}</span>
                      </div>
                    )}
                    {s.balance > 0 && (
                      <div style={st.amtBlock}>
                        <span style={st.amtLabel}>Balance</span>
                        <span style={{ ...st.amtVal, color: '#dc2626', fontSize: 14 }}>{fmt(s.balance)}</span>
                      </div>
                    )}
                    <div style={st.chevron}>{open ? '▲' : '▼'}</div>
                  </div>
                </div>

                {/* Expanded Pay Slip */}
                {open && (
                  <div style={st.slip}>
                    {/* Pay slip header strip */}
                    <div style={st.slipHeader}>
                      <div>
                        <div style={st.slipTitle}>SALARY SLIP</div>
                        <div style={st.slipMeta}>{fmtMonth(s.month)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={st.slipMeta}>Employee ID: <strong>{s.employee_id || '—'}</strong></div>
                        <div style={st.slipMeta}>Designation: <strong>{s.designation || '—'}</strong></div>
                      </div>
                    </div>

                    {/* Breakdown columns */}
                    <div style={st.slipBody}>

                      {/* Earnings */}
                      <div style={st.slipCol}>
                        <div style={st.colHead}>Earnings</div>
                        <SlipRow label="Basic Salary" value={fmt(s.basic_salary)} />
                        {s.components.filter(c => c.component_type === 'allowance').map((c, i) => (
                          <SlipRow key={i} label={c.label} value={fmt(c.amount)} accent="#15803d" />
                        ))}
                        <SlipRow label="Total Earnings" value={fmt(Number(s.basic_salary) + Number(s.total_allowances))} bold border />
                      </div>

                      {/* Deductions & Summary */}
                      <div style={st.slipCol}>
                        <div style={st.colHead}>Deductions</div>
                        {s.components.filter(c => c.component_type === 'deduction').length === 0
                          ? <div style={{ color: '#94a3b8', fontSize: 12, padding: '6px 0' }}>No deductions</div>
                          : s.components.filter(c => c.component_type === 'deduction').map((c, i) => (
                              <SlipRow key={i} label={c.label} value={fmt(c.amount)} accent="#dc2626" />
                            ))
                        }
                        <SlipRow label="Total Deductions" value={fmt(s.total_deductions)} bold border accent="#dc2626" />
                      </div>

                    </div>

                    {/* Net Salary bar */}
                    <div style={st.netBar}>
                      <span style={st.netLabel}>Net Salary (Take Home)</span>
                      <span style={st.netValue}>{fmt(s.net_salary)}</span>
                    </div>

                    {/* Payment status */}
                    <div style={st.paySection}>
                      <div style={st.colHead}>Payment History</div>
                      {s.payments?.length === 0 && (
                        <div style={st.noPayment}>No payments recorded yet.</div>
                      )}
                      {s.payments?.map((p, i) => (
                        <div key={i} style={st.payRow}>
                          <span style={st.payIcon}>{METHOD_ICONS[p.payment_method] || '💳'}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                              {METHOD_LABELS[p.payment_method] || p.payment_method}
                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                              {p.payment_date}{p.transaction_id ? ` · Ref: ${p.transaction_id}` : ''}
                              {p.paid_by_name ? ` · By ${p.paid_by_name}` : ''}
                            </div>
                            {p.note && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontStyle: 'italic' }}>{p.note}</div>}
                          </div>
                          <div style={st.payAmt}>{fmt(p.amount)}</div>
                          <span style={st.checkBadge}>✓</span>
                        </div>
                      ))}

                      {/* Totals row */}
                      <div style={st.payTotals}>
                        <div style={st.payTotalItem}>
                          <span style={st.payTotalLabel}>Net Salary</span>
                          <span style={st.payTotalVal}>{fmt(s.net_salary)}</span>
                        </div>
                        <div style={st.payTotalItem}>
                          <span style={st.payTotalLabel}>Amount Received</span>
                          <span style={{ ...st.payTotalVal, color: '#15803d' }}>{fmt(s.amount_paid)}</span>
                        </div>
                        {s.balance > 0 && (
                          <div style={st.payTotalItem}>
                            <span style={st.payTotalLabel}>Balance Due</span>
                            <span style={{ ...st.payTotalVal, color: '#dc2626' }}>{fmt(s.balance)}</span>
                          </div>
                        )}
                      </div>

                      {s.status !== 'paid' && (
                        <div style={st.unpaidNotice}>
                          <span style={{ fontSize: 16 }}>⚠️</span>
                          <span>{fmt(s.balance)} is still pending. Please contact the admin office for payment.</span>
                        </div>
                      )}
                      {s.status === 'paid' && (
                        <div style={st.paidNotice}>
                          <span style={{ fontSize: 16 }}>✅</span>
                          <span>Salary fully paid for {fmtMonth(s.month)}.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function StatCard({ icon, label, value, accent, sub }) {
  return (
    <div style={{ ...st.statCard, borderTop: `3px solid ${accent}` }}>
      <div style={{ fontSize: 26, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SlipRow({ label, value, accent, bold, border }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '5px 0',
      fontSize: 13,
      borderTop: border ? '1px solid #e2e8f0' : undefined,
      marginTop: border ? 6 : undefined,
      paddingTop: border ? 8 : undefined,
    }}>
      <span style={{ color: '#64748b', fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ color: accent || (bold ? '#0f172a' : '#334155'), fontWeight: bold ? 800 : 500 }}>{value}</span>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */
const st = {
  page: { maxWidth: 900, margin: '0 auto', padding: '28px 20px', fontFamily: 'inherit' },

  /* Hero */
  hero: {
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    borderRadius: 18,
    padding: '28px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 20,
    flexWrap: 'wrap',
    boxShadow: '0 8px 32px rgba(15,23,42,0.18)',
  },
  heroLeft:   { display: 'flex', alignItems: 'center', gap: 18 },
  heroIcon:   { fontSize: 42, background: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: '10px 14px' },
  heroTitle:  { fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 },
  heroSub:    { fontSize: 14, color: '#94a3b8', marginTop: 4 },
  heroRight:  { textAlign: 'right' },
  heroLabel:  { fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 },
  heroAmount: { fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', marginTop: 2 },
  heroBadge:  { display: 'inline-block', marginTop: 6, background: 'rgba(239,68,68,0.18)', color: '#fca5a5', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 },

  /* Stats */
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 22 },
  statCard:  { background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' },

  /* Filter */
  filterRow:  { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  filterLabel:{ fontSize: 13, fontWeight: 700, color: '#475569', marginRight: 4 },
  filterBtn:  { display: 'flex', alignItems: 'center', padding: '7px 14px', borderRadius: 22, fontSize: 13, fontWeight: 600, cursor: 'pointer' },

  /* List */
  list:       { display: 'flex', flexDirection: 'column', gap: 14 },
  emptyBox:   { background: '#fff', borderRadius: 14, padding: '48px', textAlign: 'center', border: '1px dashed #e2e8f0' },

  /* Card */
  card:       { background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  cardTop:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', cursor: 'pointer', gap: 12, flexWrap: 'wrap' },
  cardLeft:   { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  cardRight:  { display: 'flex', alignItems: 'center', gap: 18 },
  currentBadge:{ background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 20, letterSpacing: '0.05em', textTransform: 'uppercase' },
  monthName:  { fontSize: 15, fontWeight: 800, color: '#0f172a' },
  statusPill: { display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  amtBlock:   { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  amtLabel:   { fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' },
  amtVal:     { fontSize: 16, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.2px' },
  chevron:    { fontSize: 12, color: '#94a3b8', fontWeight: 700, minWidth: 14, textAlign: 'center' },

  /* Slip */
  slip:       { borderTop: '1px solid #f1f5f9' },
  slipHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#f8fafc', padding: '14px 20px', borderBottom: '1px solid #e2e8f0' },
  slipTitle:  { fontSize: 13, fontWeight: 900, color: '#1e293b', letterSpacing: '0.12em' },
  slipMeta:   { fontSize: 12, color: '#64748b', marginTop: 2 },
  slipBody:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderBottom: '1px solid #e2e8f0' },
  slipCol:    { padding: '16px 20px', borderRight: '1px solid #f1f5f9' },
  colHead:    { fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, paddingBottom: 6, borderBottom: '2px solid #e2e8f0' },
  netBar:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(90deg,#1e293b,#334155)', padding: '14px 20px' },
  netLabel:   { fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' },
  netValue:   { fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' },

  /* Payment section */
  paySection: { padding: '16px 20px' },
  noPayment:  { color: '#94a3b8', fontSize: 13, padding: '10px 0', fontStyle: 'italic' },
  payRow:     { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, marginBottom: 8 },
  payIcon:    { fontSize: 22 },
  payAmt:     { fontWeight: 800, fontSize: 15, color: '#15803d', whiteSpace: 'nowrap' },
  checkBadge: { background: '#dcfce7', color: '#15803d', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 },
  payTotals:  { display: 'flex', gap: 0, borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 6 },
  payTotalItem:{ flex: 1, textAlign: 'center', padding: '0 10px', borderRight: '1px solid #f1f5f9' },
  payTotalLabel:{ display: 'block', fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 },
  payTotalVal: { display: 'block', fontSize: 15, fontWeight: 800, color: '#0f172a' },

  /* Notices */
  unpaidNotice:{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#c2410c', fontWeight: 600, marginTop: 14 },
  paidNotice:  { display: 'flex', alignItems: 'center', gap: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '11px 14px', fontSize: 13, color: '#15803d', fontWeight: 600, marginTop: 14 },

  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '14px 18px', borderRadius: 10, fontSize: 14 },
};
