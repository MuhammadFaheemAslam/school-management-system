import { useEffect, useState, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

if (typeof document !== 'undefined' && !document.getElementById('vp-spin')) {
  const st = document.createElement('style');
  st.id = 'vp-spin';
  st.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(st);
}

const STATUS_CONFIG = {
  pending: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', dot: '#f97316', label: 'Pending' },
  partial: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6', label: 'Partial' },
  paid:    { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#22c55e', label: 'Paid'    },
  overdue: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca', dot: '#ef4444', label: 'Overdue' },
};

const TYPE_CONFIG = {
  admission: { label: 'Admission', color: '#7c3aed', bg: '#ede9fe', icon: '🎓' },
  monthly:   { label: 'Monthly',   color: '#1d4ed8', bg: '#eff6ff', icon: '📅' },
  annual:    { label: 'Annual',    color: '#b45309', bg: '#fef3c7', icon: '📆' },
};

const METHOD_ICONS = { cash: '💵', bank_transfer: '🏦', cheque: '📝', online: '💻' };

const curMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const fmtMonth = (m) => {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

const TABS = [
  { key: 'monthly',   label: 'Monthly Vouchers',   icon: '📅' },
  { key: 'admission', label: 'Admission Vouchers',  icon: '🎓' },
  { key: 'annual',    label: 'Annual Vouchers',     icon: '📆' },
];

export default function VouchersPage({ embedded = false }) {
  const { user }        = useAuth();
  const isSuperAdmin    = user?.is_superuser || user?.role === 'super_admin';
  const isSchoolAdmin   = user?.role === 'school_admin';
  const canWrite        = isSuperAdmin || isSchoolAdmin;
  const canBrowseMonths = isSuperAdmin || user?.role === 'principal'; // school_admin locked to current month

  const [activeType,    setActiveType]    = useState('monthly');
  const [month,         setMonth]         = useState(curMonth());
  const [months,        setMonths]        = useState([]);
  const [vouchers,      setVouchers]      = useState([]);
  const [sections,      setSections]      = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [generating,    setGenerating]    = useState(false);
  const [genResult,     setGenResult]     = useState(null);
  const [filterSection, setFilterSection] = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [search,        setSearch]        = useState('');
  const [searchInput,   setSearchInput]   = useState('');
  const [deletingId,    setDeletingId]    = useState(null);
  const [page,          setPage]          = useState(1);
  const PAGE_SIZE = 25;

  const [payModal,   setPayModal]   = useState(null);
  const [payForm,    setPayForm]    = useState({ amount: '', payment_method: 'cash', transaction_id: '', note: '' });
  const [paying,     setPaying]     = useState(false);
  const [payError,   setPayError]   = useState('');
  const [paySuccess, setPaySuccess] = useState(false);
  const [histModal,  setHistModal]  = useState(null);

  const [schedStatus,   setSchedStatus]   = useState(null);
  const [triggering,    setTriggering]    = useState(false);
  const [triggerResult, setTriggerResult] = useState(null);
  const [showSchedLogs, setShowSchedLogs] = useState(false);

  const [arrearsModal,  setArrearsModal]  = useState(null);  // { voucher, data }
  const [arrearsLoading, setArrearsLoading] = useState(false);

  const openArrearsDetail = async (voucher) => {
    setArrearsModal({ voucher, data: null });
    setArrearsLoading(true);
    try {
      const res = await api.get(`/fees/vouchers/${voucher.id}/arrears-detail/`);
      setArrearsModal({ voucher, data: res.data });
    } catch {
      setArrearsModal({ voucher, data: { error: 'Failed to load arrears detail.' } });
    } finally {
      setArrearsLoading(false);
    }
  };

  useEffect(() => {
    api.get('/courses/sections/').then(r => setSections(r.data));
    api.get('/fees/vouchers/months/').then(r => {
      setMonths(r.data);
      // only super_admin/principal can browse past months — auto-select most recent
      if (canBrowseMonths && r.data.length > 0 && !r.data.includes(curMonth())) {
        setMonth(r.data[0]);
      }
    }).catch(() => {});
    api.get('/fees/autogenerate/status/').then(r => setSchedStatus(r.data)).catch(() => {});
  }, []);

  const handleTrigger = async () => {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const res = await api.post('/fees/autogenerate/trigger/', { month });
      setTriggerResult(res.data);
      await fetchVouchers();
      api.get('/fees/vouchers/months/').then(r => setMonths(r.data)).catch(() => {});
      api.get('/fees/autogenerate/status/').then(r => setSchedStatus(r.data)).catch(() => {});
    } catch (err) {
      setTriggerResult({ error: err.response?.data?.error || 'Failed.' });
    } finally {
      setTriggering(false);
    }
  };

  useEffect(() => { fetchVouchers(); setPage(1); }, [activeType, month, filterSection, filterStatus, search]);

  const fetchVouchers = async () => {
    setLoading(true);
    setGenResult(null);
    try {
      const params = new URLSearchParams({ type: activeType });
      if (activeType === 'monthly') params.append('month', month);
      if (filterSection) params.append('section', filterSection);
      if (filterStatus)  params.append('status', filterStatus);
      if (search)        params.append('search', search);
      const res = await api.get(`/fees/vouchers/?${params}`);
      setVouchers(res.data);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    const label = fmtMonth(month);
    if (!window.confirm(`Generate monthly vouchers for ${label}?\n\nThis will create one voucher for every active student who doesn't already have one for this month.`)) return;
    setGenerating(true);
    setGenResult(null);
    try {
      const body = { month };
      if (filterSection) body.section_id = filterSection;
      const res = await api.post('/fees/vouchers/generate-monthly/', body);
      setGenResult(res.data);
      await fetchVouchers();
      api.get('/fees/vouchers/months/').then(r => setMonths(r.data)).catch(() => {});
    } catch (err) {
      setGenResult({ error: err.response?.data?.error || 'Generation failed.' });
    } finally {
      setGenerating(false);
    }
  };

  const openPay = (v) => {
    setPayModal(v);
    setPayForm({ amount: v.balance > 0 ? String(v.balance) : '', payment_method: 'cash', transaction_id: '', note: '' });
    setPayError('');
    setPaySuccess(false);
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    setPaying(true);
    setPayError('');
    try {
      await api.post(`/fees/vouchers/${payModal.id}/pay/`, payForm);
      setPaySuccess(true);
      setTimeout(() => { setPayModal(null); fetchVouchers(); }, 1200);
    } catch (err) {
      setPayError(err.response?.data?.error || 'Payment failed.');
    } finally {
      setPaying(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Permanently delete this voucher and all its payments?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/fees/vouchers/${id}/delete/`);
      setVouchers(prev => prev.filter(v => v.id !== id));
      if (histModal?.id === id) setHistModal(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteMonth = async () => {
    const label = fmtMonth(month);
    if (!window.confirm(`Delete ALL monthly vouchers for ${label}?\n\nThis will permanently delete every voucher and all payments recorded for this month. This cannot be undone.`)) return;
    try {
      await api.delete(`/fees/vouchers/delete-month/?month=${month}`);
      setVouchers([]);
      api.get('/fees/vouchers/months/').then(r => setMonths(r.data)).catch(() => {});
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed.');
    }
  };

  const handleDeletePayment = async (voucherId, paymentId) => {
    if (!window.confirm('Delete this payment? The voucher balance will be restored.')) return;
    try {
      const res = await api.delete(`/fees/vouchers/${voucherId}/payments/${paymentId}/`);
      // Update histModal payments and the voucher in list
      setHistModal(res.data);
      setVouchers(prev => prev.map(v => v.id === voucherId ? res.data : v));
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed.');
    }
  };

  const printChallan = (v) => {
    const w = window.open('', '_blank', 'width=440,height=650');
    const typeLabel = TYPE_CONFIG[v.voucher_type]?.label || v.voucher_type;
    const monthLabel = v.month ? fmtMonth(v.month) : v.year ? `Year ${v.year}` : '';
    const hasArrears = parseFloat(v.arrears || 0) > 0;
    const isPaid = v.status === 'paid';
    // Get most recent payment date for paid vouchers
    const lastPayment = v.payments && v.payments.length > 0
      ? [...v.payments].sort((a, b) => b.payment_date > a.payment_date ? 1 : -1)[0]
      : null;
    const lineItemsHtml = v.line_items.map(item =>
      `<tr><td class="label">${item.label}</td><td class="value">PKR ${Number(item.amount).toLocaleString()}</td></tr>`
    ).join('');
    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Fee Voucher – ${v.voucher_number}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI',Arial,sans-serif; background:#fff; color:#0f172a; }
.challan { width:400px; margin:20px auto; border:2px solid #1e3a5f; border-radius:10px; overflow:hidden; }
.header { background:#1e3a5f; color:#fff; padding:14px 18px; text-align:center; }
.school-name { font-size:17px; font-weight:800; }
.voucher-type { font-size:11px; text-transform:uppercase; letter-spacing:1px; opacity:0.8; margin-top:3px; }
.month-badge { display:inline-block; background:rgba(255,255,255,0.2); border-radius:20px; padding:3px 12px; font-size:12px; font-weight:700; margin-top:6px; }
.voucher-no { font-size:11px; opacity:0.7; margin-top:4px; }
.student-box { background:#f8fafc; padding:12px 18px; border-bottom:1px solid #e2e8f0; }
.student-name { font-size:15px; font-weight:800; }
.meta { font-size:12px; color:#64748b; margin-top:3px; }
.meta span { margin-right:14px; }
.fee-table { width:100%; border-collapse:collapse; }
.fee-table td { padding:8px 18px; font-size:13px; border-bottom:1px solid #f1f5f9; }
.fee-table .label { color:#475569; }
.fee-table .value { text-align:right; font-weight:600; }
.arrears-row td { color:#dc2626; background:#fef2f2; }
.total-row td { font-size:14px; font-weight:800; background:#f1f5f9; }
.balance-row { display:flex; justify-content:space-between; padding:10px 18px; background:#fef2f2; border-top:2px dashed #fecaca; }
.balance-label { font-weight:700; color:#991b1b; font-size:13px; }
.balance-value { font-weight:800; color:#dc2626; font-size:16px; }
.footer { padding:10px 18px; display:flex; justify-content:space-between; border-top:1px solid #e2e8f0; }
.due-date { font-size:12px; color:#dc2626; font-weight:700; }
.status-badge { font-size:11px; font-weight:700; padding:2px 10px; border-radius:20px; }
.sign-box { padding:12px 18px 16px; display:flex; justify-content:space-between; }
.sign-line { border-top:1px solid #cbd5e1; width:130px; padding-top:4px; font-size:10px; color:#94a3b8; text-align:center; }
@media print { .no-print { display:none; } }
</style></head><body>
<div class="challan">
  <div class="header">
    <div class="school-name">Azmat Public School</div>
    <div class="voucher-type">${typeLabel} Fee Voucher</div>
    ${monthLabel ? `<div class="month-badge">${monthLabel}</div>` : ''}
    <div class="voucher-no">Voucher# ${v.voucher_number}</div>
  </div>
  <div class="student-box">
    <div class="student-name">${v.student_name}</div>
    <div class="meta">
      <span>Adm# ${v.admission_number || '—'}</span>
      <span>Roll# ${v.roll_number || '—'}</span>
    </div>
    <div class="meta" style="margin-top:4px">${v.class_name || ''} ${v.section_name ? '— ' + v.section_name : ''}</div>
  </div>
  <table class="fee-table">
    ${lineItemsHtml}
    ${hasArrears ? `<tr class="arrears-row"><td class="label">⚠ Arrears (Previous Months)</td><td class="value">PKR ${Number(v.arrears).toLocaleString()}</td></tr>` : ''}
    <tr class="total-row"><td class="label">Total Amount</td><td class="value">PKR ${Number(v.total_amount).toLocaleString()}</td></tr>
    <tr><td class="label">Amount Paid</td><td class="value" style="color:#16a34a">PKR ${Number(v.amount_paid).toLocaleString()}</td></tr>
  </table>
  <div class="balance-row">
    <span class="balance-label">Balance Due</span>
    <span class="balance-value" style="color:${v.balance > 0 ? '#dc2626' : '#16a34a'}">PKR ${Number(v.balance).toLocaleString()}</span>
  </div>
  <div class="footer">
    <div class="due-date">${isPaid && lastPayment ? `Paid on: ${lastPayment.payment_date}` : `Due: ${v.due_date}`}</div>
    <div>Status: <strong style="color:${isPaid ? '#16a34a' : '#dc2626'}">${v.status.toUpperCase()}</strong></div>
  </div>
  ${isPaid && lastPayment ? `<div style="padding:6px 18px;background:#f0fdf4;border-top:1px solid #bbf7d0;font-size:11px;color:#16a34a;display:flex;justify-content:space-between">
    <span>Method: ${lastPayment.payment_method?.replace('_',' ') || '—'}</span>
    ${lastPayment.transaction_id ? `<span>Ref: ${lastPayment.transaction_id}</span>` : ''}
    ${lastPayment.received_by ? `<span>Received by: ${lastPayment.received_by}</span>` : ''}
  </div>` : ''}
  <div class="sign-box">
    <div class="sign-line">Student / Parent</div>
    <div class="sign-line">Accounts Office</div>
  </div>
</div>
<div class="no-print" style="text-align:center;margin:16px">
  <button onclick="window.print()" style="padding:10px 24px;background:#1e3a5f;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700">🖨 Print Voucher</button>
</div>
</body></html>`);
    w.document.close();
  };

  const summary = useMemo(() => {
    const s = { total: vouchers.length, paid: 0, partial: 0, pending: 0, overdue: 0, totalAmount: 0, totalPaid: 0 };
    vouchers.forEach(v => {
      s[v.status] = (s[v.status] || 0) + 1;
      s.totalAmount += parseFloat(v.total_amount || 0);
      s.totalPaid   += parseFloat(v.amount_paid  || 0);
    });
    return s;
  }, [vouchers]);

  const collectionPct = summary.totalAmount > 0 ? Math.round((summary.totalPaid / summary.totalAmount) * 100) : 0;

  return (
    <div style={s.page}>
      {/* ── Type Tabs ── */}
      <div style={s.typeTabs}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveType(tab.key); setGenResult(null); }}
            style={{ ...s.typeTab, ...(activeType === tab.key ? s.typeTabActive : {}) }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {activeType === tab.key && <div style={s.typeTabLine} />}
          </button>
        ))}
      </div>

      {/* ── Month selector (monthly only) ── */}
      {activeType === 'monthly' && (
        <div style={s.monthBar}>
          <div style={s.monthLeft}>
            <span style={{ fontSize: 22 }}>📅</span>
            <div>
              <div style={s.monthLabel}>Monthly Fee Vouchers</div>
              <div style={s.monthSub}>
                {canBrowseMonths ? 'Select a month to view or generate vouchers' : `Showing ${fmtMonth(month)}`}
              </div>
            </div>
          </div>
          <div style={s.monthRight}>
            {canBrowseMonths && (
              <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={s.monthInput} />
            )}
            {canBrowseMonths && months.length > 0 && (
              <select value={month} onChange={e => setMonth(e.target.value)} style={s.monthSelect}>
                {months.map(m => <option key={m} value={m}>{fmtMonth(m)}</option>)}
              </select>
            )}
            {canWrite && (
              <button onClick={handleGenerate} disabled={generating} style={s.generateBtn}>
                {generating ? '⏳ Generating…' : '⚡ Generate Vouchers'}
              </button>
            )}
            {isSuperAdmin && vouchers.length > 0 && (
              <button onClick={handleDeleteMonth} style={s.deleteMonthBtn}>
                🗑 Delete All ({vouchers.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Auto-Generate Schedule card (monthly only) ── */}
      {activeType === 'monthly' && schedStatus && (
        <div style={ss.schedCard}>
          <div style={ss.schedLeft}>
            <span style={{ fontSize: 22 }}>🤖</span>
            <div>
              <div style={ss.schedTitle}>Auto-Generate Schedule</div>
              <div style={ss.schedSub}>
                {schedStatus.running
                  ? <>Scheduler <span style={ss.dot}>●</span> <b>Running</b> — next run on the <b>1st of every month at 06:00</b></>
                  : <><span style={{ color: '#ef4444' }}>●</span> Scheduler not running (restart server)</>
                }
                {schedStatus.next_run && (
                  <> &nbsp;·&nbsp; Next: <b>{new Date(schedStatus.next_run).toLocaleString()}</b></>
                )}
              </div>
            </div>
          </div>
          <div style={ss.schedRight}>
            {canWrite && (
              <button onClick={handleTrigger} disabled={triggering} style={ss.triggerBtn}>
                {triggering ? '⏳ Running…' : '▶ Run Now'}
              </button>
            )}
            <button onClick={() => setShowSchedLogs(v => !v)} style={ss.logsBtn}>
              {showSchedLogs ? '▲ Hide Logs' : '📋 Logs'}
            </button>
          </div>
        </div>
      )}

      {/* Trigger result */}
      {triggerResult && (
        <div style={{ ...s.banner, background: triggerResult.error ? '#fef2f2' : '#f0fdf4', border: `1px solid ${triggerResult.error ? '#fecaca' : '#bbf7d0'}`, color: triggerResult.error ? '#dc2626' : '#15803d' }}>
          {triggerResult.error
            ? `⚠ ${triggerResult.error}`
            : `✓ Auto-generated ${triggerResult.created} voucher(s) for ${fmtMonth(triggerResult.month)}. ${triggerResult.skipped} skipped.`
          }
        </div>
      )}

      {/* Schedule logs */}
      {showSchedLogs && schedStatus?.logs?.length > 0 && (
        <div style={ss.logsPanel}>
          <div style={ss.logsTitle}>Auto-Generate History</div>
          <table style={ss.logsTable}>
            <thead>
              <tr style={ss.logsThead}>
                <th style={ss.logsTh}>Month</th>
                <th style={ss.logsTh}>Created</th>
                <th style={ss.logsTh}>Skipped</th>
                <th style={ss.logsTh}>Status</th>
                <th style={ss.logsTh}>Ran At</th>
                <th style={ss.logsTh}>Note</th>
              </tr>
            </thead>
            <tbody>
              {schedStatus.logs.map((log, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={ss.logsTd}><b>{fmtMonth(log.month)}</b></td>
                  <td style={ss.logsTd}>{log.created}</td>
                  <td style={ss.logsTd}>{log.skipped}</td>
                  <td style={ss.logsTd}>
                    {log.success
                      ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Success</span>
                      : <span style={{ color: '#dc2626', fontWeight: 700 }}>✗ Failed</span>
                    }
                  </td>
                  <td style={ss.logsTd}>{new Date(log.ran_at).toLocaleString()}</td>
                  <td style={{ ...ss.logsTd, color: '#dc2626', fontSize: 11 }}>{log.error || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Generate result ── */}
      {genResult && (
        <div style={{ ...s.banner, background: genResult.error ? '#fef2f2' : '#f0fdf4', border: `1px solid ${genResult.error ? '#fecaca' : '#bbf7d0'}`, color: genResult.error ? '#dc2626' : '#15803d' }}>
          {genResult.error
            ? `⚠ ${genResult.error}`
            : `✓ Generated ${genResult.created} new voucher(s) for ${fmtMonth(genResult.month)}. ${genResult.skipped} skipped.`
          }
        </div>
      )}

      {/* ── Summary cards ── */}
      {vouchers.length > 0 && (
        <div style={s.summaryGrid}>
          <StatCard icon="📋" label="Total"   value={summary.total}   accent="#6366f1" />
          <StatCard icon="✅" label="Paid"    value={summary.paid}    accent="#22c55e" />
          <StatCard icon="⏳" label="Partial" value={summary.partial} accent="#3b82f6" />
          <StatCard icon="🔴" label="Pending" value={summary.pending} accent="#f97316" />
          <StatCard icon="⚠️" label="Overdue" value={summary.overdue} accent="#ef4444" />
          <StatCard
            icon="💰" label="Collected"
            value={`PKR ${summary.totalPaid.toLocaleString()}`}
            accent="#22c55e"
            extra={
              <div style={s.progressWrap}>
                <div style={{ ...s.progressBar, width: `${collectionPct}%` }} />
                <span style={s.progressLabel}>{collectionPct}% of PKR {summary.totalAmount.toLocaleString()}</span>
              </div>
            }
          />
        </div>
      )}

      {/* ── Filters ── */}
      <div style={s.filterCard}>
        <div style={s.filterInner}>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Section</label>
            <select value={filterSection} onChange={e => setFilterSection(e.target.value)} style={s.select}>
              <option value="">All Sections</option>
              {sections.map(sec => <option key={sec.id} value={sec.id}>{sec.course_name} — {sec.name}</option>)}
            </select>
          </div>
          <div style={s.filterGroup}>
            <label style={s.filterLabel}>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={s.select}>
              <option value="">All</option>
              <option value="pending">🔴 Pending</option>
              <option value="partial">🔵 Partial</option>
              <option value="paid">🟢 Paid</option>
              <option value="overdue">⚠️ Overdue</option>
            </select>
          </div>
          <div style={{ ...s.filterGroup, flex: 2 }}>
            <label style={s.filterLabel}>Search</label>
            <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); }} style={s.searchRow}>
              <input placeholder="Name, adm#, voucher#" value={searchInput} onChange={e => setSearchInput(e.target.value)} style={s.searchInput} />
              <button type="submit" style={s.searchBtn}>Search</button>
              {search && <button type="button" style={s.clearBtn} onClick={() => { setSearch(''); setSearchInput(''); }}>✕</button>}
            </form>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={s.emptyBox}><div style={s.spinner} /><p style={s.emptyText}>Loading…</p></div>
      ) : vouchers.length === 0 ? (
        <div style={s.emptyBox}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <p style={s.emptyText}>
            {activeType === 'monthly' ? `No vouchers for ${fmtMonth(month)}.` : `No ${activeType} vouchers found.`}
          </p>
          {activeType === 'monthly' && canWrite && (
            <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 6 }}>Click <strong>⚡ Generate Vouchers</strong> above to create vouchers for all active students.</p>
          )}
          {activeType === 'admission' && (
            <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 6 }}>Admission vouchers are created automatically when a student is enrolled with fees.</p>
          )}
        </div>
      ) : (
        <div style={s.tableCard}>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  <th style={s.th}>Voucher No.</th>
                  <th style={s.th}>Student</th>
                  <th style={s.th}>Class / Section</th>
                  <th style={s.th}>Fee Breakdown</th>
                  {parseFloat(vouchers[0]?.arrears || 0) > 0 && <th style={{ ...s.th, color: '#dc2626' }}>Arrears</th>}
                  <th style={{ ...s.th, textAlign: 'right' }}>Total</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Paid</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Balance</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Status</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Due Date</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Last Payment</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vouchers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((v, idx) => {
                  const idx_ = (page - 1) * PAGE_SIZE + idx;
                  const sc = STATUS_CONFIG[v.status] || STATUS_CONFIG.pending;
                  const tc = TYPE_CONFIG[v.voucher_type];
                  const hasArrears = parseFloat(vouchers[0]?.arrears || 0) > 0;
                  const paidPct = v.total_amount > 0
                    ? Math.min(100, Math.round((parseFloat(v.amount_paid) / parseFloat(v.total_amount)) * 100))
                    : 100;
                  return (
                    <tr key={v.id} style={s.tr}>
                      <td style={{ ...s.td, color: '#94a3b8', fontSize: 12 }}>{idx_ + 1}</td>
                      <td style={s.td}>
                        <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{v.voucher_number}</div>
                        <span style={{ ...s.typeBadge, background: tc?.bg, color: tc?.color }}>{tc?.icon} {tc?.label}</span>
                      </td>
                      <td style={s.td}>
                        <div style={s.studentCell}>
                          <div style={s.avatar}>{(v.student_name || '?')[0].toUpperCase()}</div>
                          <div>
                            <div style={s.studentName}>{v.student_name}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>Adm# {v.admission_number}</div>
                          </div>
                        </div>
                      </td>
                      <td style={s.td}>
                        {v.class_name   && <div style={s.className}>{v.class_name}</div>}
                        {v.section_name && <div style={s.sectionName}>{v.section_name}</div>}
                      </td>
                      <td style={s.td}>
                        {v.line_items.map((item, i) => (
                          <div key={i} style={{ fontSize: 12, color: '#475569', marginBottom: 2 }}>
                            <span style={{ color: '#94a3b8' }}>{item.label}:</span> PKR {Number(item.amount).toLocaleString()}
                          </div>
                        ))}
                      </td>
                      {hasArrears && (
                        <td style={{ ...s.td, textAlign: 'right' }}>
                          {parseFloat(v.arrears || 0) > 0 ? (
                            <button onClick={() => openArrearsDetail(v)} style={sa.arrearsBtn} title="Click to see arrears breakdown">
                              ⚠ PKR {Number(v.arrears).toLocaleString()}
                            </button>
                          ) : <span style={{ color: '#94a3b8' }}>—</span>}
                        </td>
                      )}
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                        {Number(v.total_amount).toLocaleString()}
                      </td>
                      <td style={{ ...s.td, textAlign: 'right', color: '#16a34a', fontWeight: 600 }}>
                        {Number(v.amount_paid).toLocaleString()}
                      </td>
                      <td style={{ ...s.td, textAlign: 'right' }}>
                        <span style={{ color: v.balance > 0 ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                          {Number(v.balance).toLocaleString()}
                        </span>
                        {v.total_amount > 0 && (
                          <div style={s.miniProgressWrap}>
                            <div style={{ ...s.miniBar, width: `${paidPct}%`, background: sc.dot }} />
                          </div>
                        )}
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        <span style={{ ...s.badge, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                          <span style={{ ...s.dot, background: sc.dot }} />{sc.label}
                        </span>
                      </td>
                      <td style={{ ...s.td, textAlign: 'center', fontSize: 12, color: v.status === 'overdue' ? '#dc2626' : '#64748b', fontWeight: v.status === 'overdue' ? 700 : 400 }}>
                        {v.due_date}
                      </td>
                      <td style={{ ...s.td, textAlign: 'center', fontSize: 12 }}>
                        {v.payments && v.payments.length > 0 ? (() => {
                          const last = [...v.payments].sort((a, b) => b.payment_date > a.payment_date ? 1 : -1)[0];
                          return (
                            <div>
                              <div style={{ color: '#16a34a', fontWeight: 600 }}>{last.payment_date}</div>
                              <div style={{ color: '#94a3b8', fontSize: 11 }}>{last.payment_method?.replace('_', ' ')}</div>
                            </div>
                          );
                        })() : <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ ...s.td, textAlign: 'center' }}>
                        <div style={s.actionRow}>
                          {canWrite && v.status !== 'paid' && (
                            <button onClick={() => openPay(v)} style={s.payBtn}>+ Pay</button>
                          )}
                          {v.payments?.length > 0 && (
                            <button onClick={() => setHistModal(v)} style={s.histBtn} title="Payment History">📋</button>
                          )}
                          <button onClick={() => printChallan(v)} style={s.challanBtn} title="Print Voucher">🖨</button>
                          {v.status === 'paid' && <span style={s.paidMark}>✓ Cleared</span>}
                          {isSuperAdmin && (
                            <button onClick={() => handleDelete(v.id)} disabled={deletingId === v.id} style={s.deleteBtn} title="Delete">
                              {deletingId === v.id ? '…' : '🗑'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {vouchers.length > PAGE_SIZE && (
            <div style={s.pagination}>
              <span style={s.pageInfo}>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, vouchers.length)} of {vouchers.length}
              </span>
              <div style={s.pageButtons}>
                <button onClick={() => setPage(1)}          disabled={page === 1}                                     style={s.pageBtn}>«</button>
                <button onClick={() => setPage(p => p - 1)} disabled={page === 1}                                     style={s.pageBtn}>‹ Prev</button>
                {Array.from({ length: Math.ceil(vouchers.length / PAGE_SIZE) }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === Math.ceil(vouchers.length / PAGE_SIZE) || Math.abs(p - page) <= 1)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push('…');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) => p === '…'
                    ? <span key={`ellipsis-${i}`} style={s.pageEllipsis}>…</span>
                    : <button key={p} onClick={() => setPage(p)} style={{ ...s.pageBtn, ...(page === p ? s.pageBtnActive : {}) }}>{p}</button>
                  )
                }
                <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(vouchers.length / PAGE_SIZE)} style={s.pageBtn}>Next ›</button>
                <button onClick={() => setPage(Math.ceil(vouchers.length / PAGE_SIZE))} disabled={page >= Math.ceil(vouchers.length / PAGE_SIZE)} style={s.pageBtn}>»</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Payment Modal ── */}
      {payModal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setPayModal(null)}>
          <div style={s.modal}>
            {paySuccess ? (
              <div style={s.successBox}>
                <div style={s.successIcon}>✓</div>
                <h3 style={s.successTitle}>Payment Recorded!</h3>
                <p style={s.successSub}>Voucher {payModal.voucher_number} updated.</p>
              </div>
            ) : (
              <>
                <div style={s.modalHead}>
                  <div>
                    <h3 style={s.modalTitle}>Record Payment</h3>
                    <p style={s.modalSub}>{payModal.student_name} · {payModal.voucher_number}</p>
                  </div>
                  <button style={s.closeBtn} onClick={() => setPayModal(null)}>✕</button>
                </div>
                <div style={s.breakdown}>
                  {payModal.line_items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                      <span style={{ color: '#64748b' }}>{item.label}</span>
                      <span>PKR {Number(item.amount).toLocaleString()}</span>
                    </div>
                  ))}
                  {parseFloat(payModal.arrears || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', color: '#dc2626' }}>
                      <span>Arrears</span>
                      <span>PKR {Number(payModal.arrears).toLocaleString()}</span>
                    </div>
                  )}
                  <div style={s.divider} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', fontWeight: 700 }}>
                    <span>Total</span><span>PKR {Number(payModal.total_amount).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', color: '#16a34a' }}>
                    <span>Already Paid</span><span>PKR {Number(payModal.amount_paid).toLocaleString()}</span>
                  </div>
                  <div style={s.balanceRow}>
                    <span style={s.balanceLabel}>Balance Due</span>
                    <span style={s.balanceValue}>PKR {Number(payModal.balance).toLocaleString()}</span>
                  </div>
                </div>
                <form onSubmit={handlePayment} style={s.form}>
                  <div style={s.formGrid}>
                    <FormField label="Amount (PKR) *" span={2}>
                      <input type="number" min="0.01" step="0.01" max={payModal.balance}
                        value={payForm.amount} required style={s.input}
                        onChange={e => setPayForm({ ...payForm, amount: e.target.value })} />
                    </FormField>
                    <FormField label="Payment Method *">
                      <select value={payForm.payment_method} style={s.input}
                        onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}>
                        <option value="cash">💵 Cash</option>
                        <option value="bank_transfer">🏦 Bank Transfer</option>
                        <option value="cheque">📝 Cheque</option>
                        <option value="online">💻 Online</option>
                      </select>
                    </FormField>
                    <FormField label="Receipt / Transaction ID">
                      <input value={payForm.transaction_id} placeholder="Optional" style={s.input}
                        onChange={e => setPayForm({ ...payForm, transaction_id: e.target.value })} />
                    </FormField>
                    <FormField label="Note" span={2}>
                      <input value={payForm.note} placeholder="Optional note" style={s.input}
                        onChange={e => setPayForm({ ...payForm, note: e.target.value })} />
                    </FormField>
                  </div>
                  {payError && <div style={s.errBox}>{payError}</div>}
                  <div style={s.modalFooter}>
                    <button type="button" onClick={() => setPayModal(null)} style={s.cancelBtn}>Cancel</button>
                    <button type="submit" disabled={paying} style={s.submitBtn}>
                      {paying ? '⏳ Saving…' : '✓ Save Payment'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── History Modal ── */}
      {histModal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setHistModal(null)}>
          <div style={{ ...s.modal, maxWidth: 520 }}>
            <div style={s.modalHead}>
              <div>
                <h3 style={s.modalTitle}>Payment History</h3>
                <p style={s.modalSub}>{histModal.student_name} · {histModal.voucher_number}</p>
              </div>
              <button style={s.closeBtn} onClick={() => setHistModal(null)}>✕</button>
            </div>
            {histModal.payments.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>No payments recorded yet.</div>
            ) : (
              <div style={s.histList}>
                {histModal.payments.map(p => (
                  <div key={p.id} style={s.histItem}>
                    <div style={s.histLeft}>
                      <span style={s.histIcon}>{METHOD_ICONS[p.payment_method] || '💳'}</span>
                      <div>
                        <div style={s.histDate}>{p.payment_date}</div>
                        <div style={s.histMeta}>{p.payment_method.replace('_', ' ')}{p.transaction_id && ` · #${p.transaction_id}`}{p.received_by_name && ` · ${p.received_by_name}`}</div>
                        {p.note && <div style={s.histNote}>{p.note}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={s.histAmount}>PKR {Number(p.amount).toLocaleString()}</div>
                      {isSuperAdmin && (
                        <button
                          onClick={() => handleDeletePayment(histModal.id, p.id)}
                          style={s.histDelBtn}
                          title="Delete this payment"
                        >🗑</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={s.modalFooter}><button onClick={() => setHistModal(null)} style={s.cancelBtn}>Close</button></div>
          </div>
        </div>
      )}

      {/* ── Arrears Detail Modal ── */}
      {arrearsModal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setArrearsModal(null)}>
          <div style={{ ...s.modal, maxWidth: 600 }}>
            <div style={sa.arrearsHeader}>
              <div>
                <div style={s.modalTitle}>⚠ Arrears Breakdown</div>
                <p style={s.modalSub}>{arrearsModal.voucher.student_name} · {arrearsModal.voucher.voucher_number}</p>
              </div>
              <button style={s.closeBtn} onClick={() => setArrearsModal(null)}>✕</button>
            </div>

            {arrearsLoading ? (
              <div style={{ padding: 32, textAlign: 'center' }}><div style={s.spinner} /></div>
            ) : arrearsModal.data?.error ? (
              <div style={{ padding: 24, color: '#dc2626' }}>{arrearsModal.data.error}</div>
            ) : arrearsModal.data?.sources?.length === 0 ? (
              <div style={{ padding: 24, color: '#64748b', textAlign: 'center' }}>No arrears detail found.</div>
            ) : (
              <div style={{ padding: '0 0 8px' }}>
                {/* Total arrears banner */}
                <div style={sa.arrearsBanner}>
                  <span>Total Arrears Carried Forward</span>
                  <span style={{ fontWeight: 800, fontSize: 18 }}>PKR {Number(arrearsModal.data?.total_arrears || 0).toLocaleString()}</span>
                </div>

                <div style={{ padding: '12px 24px', fontSize: 12, color: '#64748b' }}>
                  The following months have unpaid fees that were carried forward as arrears into this voucher:
                </div>

                {arrearsModal.data?.sources?.map((src, i) => (
                  <div key={i} style={sa.srcCard}>
                    {/* Month header */}
                    <div style={sa.srcHeader}>
                      <div style={sa.srcMonth}>
                        {src.voucher_type === 'admission' ? '🎓 Admission Fee' : `📅 ${fmtMonth(src.month)}`}
                        <span style={sa.srcVno}>{src.voucher_number}</span>
                      </div>
                      <div style={sa.srcDue}>Due: {src.due_date}</div>
                    </div>

                    {/* Fee line items */}
                    <div style={sa.srcLines}>
                      {src.line_items.map((item, j) => (
                        <div key={j} style={sa.srcLine}>
                          <span style={{ color: '#475569' }}>{item.label}</span>
                          <span style={{ fontWeight: 600 }}>PKR {Number(item.amount).toLocaleString()}</span>
                        </div>
                      ))}
                      <div style={sa.srcDivider} />
                      <div style={sa.srcLine}>
                        <span style={{ color: '#475569' }}>Total Billed</span>
                        <span style={{ fontWeight: 700 }}>PKR {Number(src.own_total).toLocaleString()}</span>
                      </div>
                      <div style={sa.srcLine}>
                        <span style={{ color: '#16a34a' }}>Amount Paid</span>
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>− PKR {Number(src.amount_paid).toLocaleString()}</span>
                      </div>
                      <div style={{ ...sa.srcLine, ...sa.srcUnpaid }}>
                        <span>Unpaid (Carried as Arrears)</span>
                        <span>PKR {Number(src.own_unpaid).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={s.modalFooter}><button onClick={() => setArrearsModal(null)} style={s.cancelBtn}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, accent, extra }) {
  return (
    <div style={{ ...s.statCard, borderTop: `3px solid ${accent}` }}>
      <div style={{ ...s.statIcon, background: accent + '18', color: accent }}>{icon}</div>
      <div><div style={s.statValue}>{value}</div><div style={s.statLabel}>{label}</div>{extra}</div>
    </div>
  );
}

function FormField({ label, children, span = 1 }) {
  return (
    <div style={{ gridColumn: `span ${span}`, display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {children}
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#f8fafc' },
  typeTabs: { display: 'flex', gap: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 6, marginBottom: 16, width: 'fit-content', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  typeTab: { position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: 'none', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#64748b' },
  typeTabActive: { background: '#eff6ff', color: '#1d4ed8' },
  typeTabLine: { position: 'absolute', bottom: -2, left: '20%', right: '20%', height: 2, background: '#3b82f6', borderRadius: 2 },
  monthBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '14px 20px', marginBottom: 16, flexWrap: 'wrap', gap: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  monthLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  monthLabel: { fontSize: 15, fontWeight: 700, color: '#0f172a' },
  monthSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  monthRight: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  monthInput: { padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', background: '#fff' },
  monthSelect: { padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', background: '#fff' },
  generateBtn: { padding: '9px 18px', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' },
  deleteMonthBtn: { padding: '9px 18px', background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', fontFamily: 'inherit' },
  histDelBtn: { width: 26, height: 26, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'inherit' },
  banner: { borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14, fontWeight: 500 },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 16 },
  statCard: { background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', gap: 14, alignItems: 'flex-start' },
  statIcon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 },
  statValue: { fontSize: 20, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 },
  statLabel: { fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 },
  progressWrap: { marginTop: 6, background: '#e2e8f0', borderRadius: 4, height: 4, width: '100%', overflow: 'hidden' },
  progressBar: { height: '100%', background: '#22c55e', borderRadius: 4, transition: 'width 0.4s' },
  progressLabel: { fontSize: 10, color: '#64748b', marginTop: 2, display: 'block' },
  filterCard: { background: '#fff', borderRadius: 12, padding: '16px 20px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  filterInner: { display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' },
  filterGroup: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 160 },
  filterLabel: { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' },
  select: { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', background: '#fff' },
  searchRow: { display: 'flex', gap: 6 },
  searchInput: { flex: 1, padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', minWidth: 0 },
  searchBtn: { padding: '9px 18px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' },
  clearBtn: { padding: '9px 12px', background: '#f1f5f9', color: '#64748b', border: '1.5px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontWeight: 700 },
  emptyBox: { background: '#fff', borderRadius: 12, padding: '60px 24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  emptyText: { color: '#94a3b8', fontSize: 15, margin: 0 },
  spinner: { width: 36, height: 36, border: '3px solid #e2e8f0', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' },
  tableCard: { background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', minWidth: 1000 },
  th: { padding: '10px 14px', background: '#f8fafc', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f8fafc' },
  td: { padding: '12px 14px', fontSize: 13, color: '#334155', verticalAlign: 'middle' },
  typeBadge: { display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, marginTop: 3 },
  studentCell: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 },
  studentName: { fontWeight: 600, color: '#0f172a', fontSize: 13 },
  className: { fontWeight: 600, color: '#334155', fontSize: 13 },
  sectionName: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  miniProgressWrap: { width: 50, height: 3, background: '#f1f5f9', borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  miniBar: { height: '100%', borderRadius: 2, transition: 'width 0.3s' },
  badge: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 },
  dot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  actionRow: { display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
  payBtn: { padding: '5px 12px', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  histBtn: { width: 28, height: 28, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  challanBtn: { width: 28, height: 28, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8' },
  deleteBtn: { width: 28, height: 28, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626' },
  paidMark: { fontSize: 11, color: '#16a34a', fontWeight: 700 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, backdropFilter: 'blur(2px)' },
  modal: { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 0' },
  modalTitle: { margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' },
  modalSub: { margin: '4px 0 0', fontSize: 13, color: '#64748b' },
  closeBtn: { background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 14, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  breakdown: { margin: '16px 24px', background: '#f8fafc', borderRadius: 10, padding: '12px 16px' },
  divider: { height: 1, background: '#e2e8f0', margin: '6px 0' },
  balanceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2', borderRadius: 8, padding: '8px 12px', marginTop: 6 },
  balanceLabel: { fontWeight: 700, fontSize: 13, color: '#991b1b' },
  balanceValue: { fontWeight: 800, fontSize: 16, color: '#dc2626' },
  form: { padding: '0 24px 24px' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 },
  input: { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#1e293b', width: '100%', boxSizing: 'border-box' },
  errBox: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 14 },
  modalFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '0 24px 24px' },
  cancelBtn: { padding: '10px 20px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontWeight: 600, color: '#475569', fontSize: 14 },
  submitBtn: { padding: '10px 24px', background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 14 },
  successBox: { padding: '48px 24px', textAlign: 'center' },
  successIcon: { width: 64, height: 64, background: 'linear-gradient(135deg,#22c55e,#16a34a)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#fff', margin: '0 auto 16px', fontWeight: 800 },
  successTitle: { margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#0f172a' },
  successSub: { margin: 0, color: '#64748b', fontSize: 14 },
  histList: { display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 24px', maxHeight: 380, overflowY: 'auto' },
  histItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#f8fafc', borderRadius: 10, padding: '12px 14px', border: '1px solid #f1f5f9' },
  histLeft: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  histIcon: { fontSize: 22, lineHeight: 1 },
  histDate: { fontWeight: 700, color: '#1e293b', fontSize: 13 },
  histMeta: { fontSize: 12, color: '#94a3b8', marginTop: 2, textTransform: 'capitalize' },
  histNote: { fontSize: 12, color: '#64748b', marginTop: 3, fontStyle: 'italic' },
  histAmount: { fontWeight: 800, fontSize: 15, color: '#16a34a', whiteSpace: 'nowrap' },
  pagination:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 8 },
  pageInfo:       { fontSize: 13, color: '#64748b' },
  pageButtons:    { display: 'flex', gap: 4, alignItems: 'center' },
  pageBtn:        { padding: '5px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, color: '#475569', fontFamily: 'inherit', fontWeight: 500 },
  pageBtnActive:  { background: '#1e3a5f', color: '#fff', border: '1px solid #1e3a5f', fontWeight: 700 },
  pageEllipsis:   { padding: '5px 4px', fontSize: 13, color: '#94a3b8' },
};

const ss = {
  schedCard:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 20px', marginBottom: 12, flexWrap: 'wrap', gap: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  schedLeft:   { display: 'flex', alignItems: 'center', gap: 12 },
  schedTitle:  { fontSize: 14, fontWeight: 700, color: '#1e3a5f' },
  schedSub:    { fontSize: 12, color: '#64748b', marginTop: 2 },
  dot:         { color: '#22c55e', fontSize: 10 },
  schedRight:  { display: 'flex', gap: 8 },
  triggerBtn:  { padding: '7px 16px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' },
  logsBtn:     { padding: '7px 14px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' },
  logsPanel:   { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', marginBottom: 16 },
  logsTitle:   { fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 12 },
  logsTable:   { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  logsThead:   { background: '#f8fafc' },
  logsTh:      { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textAlign: 'left', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase' },
  logsTd:      { padding: '8px 12px', borderBottom: '1px solid #f1f5f9' },
};

// Arrears modal styles
const sa = {
  arrearsBtn:    { background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700, fontSize: 13, padding: '2px 6px', borderRadius: 6, textDecoration: 'underline dotted', fontFamily: 'inherit' },
  arrearsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 12px', borderBottom: '1px solid #f1f5f9' },
  arrearsBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, margin: '12px 24px 0', padding: '12px 16px', color: '#dc2626', fontSize: 14 },
  srcCard:       { margin: '12px 24px 0', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' },
  srcHeader:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 16px', borderBottom: '1px solid #e2e8f0' },
  srcMonth:      { fontWeight: 700, fontSize: 14, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 },
  srcVno:        { fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', fontWeight: 400 },
  srcDue:        { fontSize: 12, color: '#94a3b8' },
  srcLines:      { padding: '10px 16px' },
  srcLine:       { display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' },
  srcDivider:    { borderTop: '1px dashed #e2e8f0', margin: '6px 0' },
  srcUnpaid:     { fontWeight: 700, color: '#dc2626', background: '#fef2f2', margin: '4px -16px -10px', padding: '8px 16px' },
};
