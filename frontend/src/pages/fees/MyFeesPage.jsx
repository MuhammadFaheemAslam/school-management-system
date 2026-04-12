import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const STATUS_CONFIG = {
  pending: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', label: 'Pending'  },
  partial: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', label: 'Partial'  },
  paid:    { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', label: 'Paid'     },
  overdue: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca', label: 'Overdue'  },
};

const METHOD_ICONS = { cash: '💵', bank_transfer: '🏦', cheque: '📝', online: '💻' };

const fmtMonth = (m) => {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

export default function MyFeesPage() {
  const navigate = useNavigate();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [filter, setFilter]     = useState('all');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.get('/fees/my-vouchers/')
      .then(r => setData(r.data))
      .catch(() => setError('Could not load your fee vouchers.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.container}><p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Loading…</p></div>;
  if (error)   return <div style={styles.container}><div style={styles.errorBox}>{error}</div></div>;

  const { vouchers, summary } = data;

  const filtered = filter === 'all'
    ? vouchers
    : vouchers.filter(v => v.status === filter);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>← Dashboard</button>
        <h2 style={styles.title}>My Fee Vouchers</h2>
      </div>

      {/* Summary cards */}
      <div style={styles.summaryRow}>
        <SCard label="Total Billed" value={`PKR ${Number(summary.total_billed).toLocaleString()}`} color="#1d4ed8" bg="#eff6ff" />
        <SCard label="Total Paid"   value={`PKR ${Number(summary.total_paid).toLocaleString()}`}   color="#15803d" bg="#f0fdf4" />
        <SCard label="Balance Due"  value={`PKR ${Number(summary.balance).toLocaleString()}`}      color={summary.balance > 0 ? '#991b1b' : '#15803d'} bg={summary.balance > 0 ? '#fef2f2' : '#f0fdf4'} />
        <SCard label="Paid"         value={summary.paid_count}    color="#15803d" bg="#f0fdf4" />
        <SCard label="Pending"      value={summary.pending_count} color="#c2410c" bg="#fff7ed" />
        <SCard label="Overdue"      value={summary.overdue_count} color="#991b1b" bg="#fef2f2" />
      </div>

      {/* Filter tabs */}
      <div style={styles.filterRow}>
        {['all', 'pending', 'partial', 'paid', 'overdue'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ ...styles.filterBtn, background: filter === f ? '#1d4ed8' : '#fff', color: filter === f ? '#fff' : '#555', border: filter === f ? 'none' : '1px solid #ddd' }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Voucher list */}
      {filtered.length === 0 ? (
        <div style={styles.emptyBox}>No vouchers match the selected filter.</div>
      ) : (
        <div style={styles.list}>
          {filtered.map(v => {
            const sc  = STATUS_CONFIG[v.status] || STATUS_CONFIG.pending;
            const open = expanded === v.id;
            const lastPay = v.payments?.[0];
            return (
              <div key={v.id} style={styles.card}>
                {/* Card header */}
                <div style={styles.cardTop} onClick={() => setExpanded(open ? null : v.id)}>
                  <div style={styles.cardLeft}>
                    <span style={styles.voucherNum}>{v.voucher_number}</span>
                    <span style={{ ...styles.statusPill, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                      {sc.label}
                    </span>
                    {v.voucher_type === 'monthly' && v.month && (
                      <span style={styles.monthPill}>{fmtMonth(v.month)}</span>
                    )}
                    {v.voucher_type === 'admission' && (
                      <span style={styles.admissionPill}>Admission</span>
                    )}
                  </div>
                  <div style={styles.cardRight}>
                    <div style={styles.amountGroup}>
                      <span style={styles.amountLabel}>Total</span>
                      <span style={styles.amountValue}>PKR {Number(v.total_amount).toLocaleString()}</span>
                    </div>
                    {v.balance > 0 && (
                      <div style={styles.amountGroup}>
                        <span style={styles.amountLabel}>Balance</span>
                        <span style={{ ...styles.amountValue, color: '#dc2626' }}>PKR {Number(v.balance).toLocaleString()}</span>
                      </div>
                    )}
                    <span style={styles.expandBtn}>{open ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded detail */}
                {open && (
                  <div style={styles.cardBody}>
                    <div style={styles.bodyRow}>
                      <span style={styles.bodyLabel}>Due Date</span>
                      <span style={styles.bodyVal}>{v.due_date}</span>
                    </div>

                    {/* Line items */}
                    {v.line_items?.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={styles.sectionTitle}>Fee Breakdown</div>
                        {v.line_items.map((li, i) => (
                          <div key={i} style={styles.lineItem}>
                            <span style={{ color: '#475569' }}>{li.label}</span>
                            <span style={{ fontWeight: 600 }}>PKR {Number(li.amount).toLocaleString()}</span>
                          </div>
                        ))}
                        {parseFloat(v.arrears) > 0 && (
                          <div style={styles.lineItem}>
                            <span style={{ color: '#dc2626' }}>Arrears (carried forward)</span>
                            <span style={{ fontWeight: 600, color: '#dc2626' }}>PKR {Number(v.arrears).toLocaleString()}</span>
                          </div>
                        )}
                        <div style={{ ...styles.lineItem, borderTop: '1px solid #e2e8f0', paddingTop: 6, marginTop: 4 }}>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>Total</span>
                          <span style={{ fontWeight: 700, color: '#0f172a' }}>PKR {Number(v.total_amount).toLocaleString()}</span>
                        </div>
                      </div>
                    )}

                    {/* Payments */}
                    {v.payments?.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={styles.sectionTitle}>Payments Received</div>
                        {v.payments.map((p, i) => (
                          <div key={i} style={styles.payRow}>
                            <span style={{ fontSize: 16 }}>{METHOD_ICONS[p.payment_method] || '💳'}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                                PKR {Number(p.amount).toLocaleString()}
                              </div>
                              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                                Paid on {p.payment_date}
                                {p.transaction_id && ` · Ref: ${p.transaction_id}`}
                              </div>
                            </div>
                            <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>✓ Received</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Unpaid notice */}
                    {v.status !== 'paid' && (
                      <div style={styles.unpaidNotice}>
                        Please pay PKR {Number(v.balance).toLocaleString()} at the school office.
                        {v.due_date && ` Due: ${v.due_date}.`}
                      </div>
                    )}
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

function SCard({ label, value, color, bg }) {
  return (
    <div style={{ ...styles.scard, background: bg }}>
      <div style={{ ...styles.scardVal, color }}>{value}</div>
      <div style={styles.scardLabel}>{label}</div>
    </div>
  );
}

const styles = {
  container:   { maxWidth: 860, margin: '0 auto', padding: '28px 20px' },
  header:      { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 },
  backBtn:     { padding: '8px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#475569', fontWeight: 600 },
  title:       { margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' },
  errorBox:    { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '14px 18px', borderRadius: 10, fontSize: 14 },

  summaryRow:  { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 },
  scard:       { flex: '1 1 120px', borderRadius: 12, padding: '14px 16px', minWidth: 110 },
  scardVal:    { fontSize: 20, fontWeight: 800, marginBottom: 4 },
  scardLabel:  { fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },

  filterRow:   { display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' },
  filterBtn:   { padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer' },

  list:        { display: 'flex', flexDirection: 'column', gap: 12 },
  emptyBox:    { background: '#fff', borderRadius: 12, padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: 14, border: '1px solid #e2e8f0' },

  card:        { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  cardTop:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer', gap: 12, flexWrap: 'wrap' },
  cardLeft:    { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardRight:   { display: 'flex', alignItems: 'center', gap: 16 },
  voucherNum:  { fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', fontSize: 13 },
  statusPill:  { padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  monthPill:   { background: '#eff6ff', color: '#3b82f6', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  admissionPill:{ background: '#f0fdf4', color: '#15803d', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  amountGroup: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  amountLabel: { fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' },
  amountValue: { fontSize: 15, fontWeight: 700, color: '#0f172a' },
  expandBtn:   { fontSize: 12, color: '#94a3b8' },

  cardBody:    { padding: '0 18px 16px', borderTop: '1px solid #f1f5f9' },
  bodyRow:     { display: 'flex', justifyContent: 'space-between', padding: '10px 0 6px', fontSize: 13 },
  bodyLabel:   { color: '#94a3b8', fontWeight: 600 },
  bodyVal:     { color: '#0f172a', fontWeight: 600 },
  sectionTitle:{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  lineItem:    { display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' },
  payRow:      { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc', fontSize: 13 },
  unpaidNotice:{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#c2410c', fontWeight: 600, marginTop: 12 },
};
