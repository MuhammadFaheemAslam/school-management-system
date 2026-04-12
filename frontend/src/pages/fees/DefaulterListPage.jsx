import { useEffect, useState, useMemo } from 'react';
import api from '../../services/api';

const fmtMonth = (m) => {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
};

const fmtMoney = (n) => `PKR ${Number(n || 0).toLocaleString()}`;

export default function DefaulterListPage() {
  const [vouchers,       setVouchers]       = useState([]);
  const [sections,       setSections]       = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [filterSection,  setFilterSection]  = useState('');
  const [search,         setSearch]         = useState('');
  const [searchInput,    setSearchInput]    = useState('');
  const [sortBy,         setSortBy]         = useState('balance'); // balance | months | name

  useEffect(() => {
    api.get('/courses/sections/').then(r => setSections(r.data));
  }, []);

  useEffect(() => { fetchDefaulters(); }, [filterSection, search]);

  const fetchDefaulters = async () => {
    setLoading(true);
    try {
      // Fetch pending + partial + overdue vouchers (all unpaid/partially paid)
      const base = `${filterSection ? '&section=' + filterSection : ''}${search ? '&search=' + encodeURIComponent(search) : ''}`;
      const [pendingRes, partialRes, overdueRes] = await Promise.all([
        api.get(`/fees/vouchers/?status=pending${base}`),
        api.get(`/fees/vouchers/?status=partial${base}`),
        api.get(`/fees/vouchers/?status=overdue${base}`),
      ]);

      const all = [...pendingRes.data, ...partialRes.data, ...overdueRes.data];

      // Group by student
      const byStudent = {};
      all.forEach(v => {
        const sid = v.student;
        if (!byStudent[sid]) {
          byStudent[sid] = {
            student_id:       sid,
            student_name:     v.student_name,
            admission_number: v.admission_number,
            class_name:       v.class_name,
            section_name:     v.section_name,
            vouchers:         [],
            total_balance:    0,
          };
        }
        byStudent[sid].vouchers.push(v);
        byStudent[sid].total_balance += parseFloat(v.balance || 0);
      });

      setVouchers(Object.values(byStudent));
    } finally {
      setLoading(false);
    }
  };

  const sorted = useMemo(() => {
    return [...vouchers].sort((a, b) => {
      if (sortBy === 'balance') return b.total_balance - a.total_balance;
      if (sortBy === 'months')  return b.vouchers.length - a.vouchers.length;
      return a.student_name.localeCompare(b.student_name);
    });
  }, [vouchers, sortBy]);

  const totalOutstanding = useMemo(() => vouchers.reduce((s, v) => s + v.total_balance, 0), [vouchers]);

  const printList = () => {
    const rows = sorted.map((d, i) => {
      const months = d.vouchers.filter(v => v.voucher_type === 'monthly').map(v => fmtMonth(v.month)).join(', ');
      const hasOverdue = d.vouchers.some(v => v.status === 'overdue');
      return `<tr>
        <td>${i + 1}</td>
        <td><b>${d.student_name}</b><br/><small>${d.admission_number}</small></td>
        <td>${d.class_name || ''}${d.section_name ? ' — ' + d.section_name : ''}</td>
        <td>${d.vouchers.length}</td>
        <td style="color:#64748b;font-size:11px">${months || '—'}</td>
        <td style="font-weight:700;color:${hasOverdue ? '#dc2626' : '#c2410c'}">${fmtMoney(d.total_balance)}</td>
        <td>${hasOverdue ? '<span style="color:#dc2626;font-weight:700">⚠ Overdue</span>' : '<span style="color:#c2410c">Pending</span>'}</td>
      </tr>`;
    }).join('');

    const w = window.open('', '_blank', 'width=860,height=700');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>Defaulter List</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI',Arial,sans-serif; padding:24px; color:#0f172a; }
h1 { font-size:20px; font-weight:800; color:#1e3a5f; }
.meta { color:#64748b; font-size:13px; margin:4px 0 16px; }
.summary { display:flex; gap:24px; margin-bottom:20px; }
.card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 20px; }
.card-label { font-size:11px; color:#64748b; font-weight:700; text-transform:uppercase; }
.card-val { font-size:20px; font-weight:800; margin-top:4px; }
table { width:100%; border-collapse:collapse; font-size:13px; }
th { background:#1e3a5f; color:#fff; padding:9px 12px; text-align:left; font-size:11px; }
td { padding:8px 12px; border-bottom:1px solid #f1f5f9; }
tr:nth-child(even) td { background:#f8fafc; }
@media print { .no-print { display:none; } }
</style></head><body>
<h1>Fee Defaulter List</h1>
<div class="meta">Generated on ${new Date().toLocaleString()} &nbsp;·&nbsp; ${sorted.length} student(s) with outstanding dues</div>
<div class="summary">
  <div class="card"><div class="card-label">Total Defaulters</div><div class="card-val" style="color:#dc2626">${sorted.length}</div></div>
  <div class="card"><div class="card-label">Total Outstanding</div><div class="card-val" style="color:#dc2626">${fmtMoney(totalOutstanding)}</div></div>
</div>
<table>
  <thead><tr><th>#</th><th>Student</th><th>Class</th><th>Unpaid Vouchers</th><th>Months</th><th>Total Due</th><th>Status</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="no-print" style="text-align:center;margin-top:20px">
  <button onclick="window.print()" style="padding:10px 24px;background:#1e3a5f;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700">🖨 Print List</button>
</div>
</body></html>`);
    w.document.close();
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={{ fontSize: 28 }}>🔴</span>
          <div>
            <div style={s.title}>Fee Defaulter List</div>
            <div style={s.sub}>Students with pending or overdue vouchers across all months</div>
          </div>
        </div>
        <button onClick={printList} disabled={sorted.length === 0} style={s.printBtn}>🖨 Print List</button>
      </div>

      {/* Summary */}
      {!loading && sorted.length > 0 && (
        <div style={s.summaryRow}>
          <div style={s.summaryCard}>
            <div style={s.summaryLabel}>Total Defaulters</div>
            <div style={{ ...s.summaryValue, color: '#dc2626' }}>{sorted.length}</div>
          </div>
          <div style={s.summaryCard}>
            <div style={s.summaryLabel}>Total Outstanding</div>
            <div style={{ ...s.summaryValue, color: '#dc2626' }}>{fmtMoney(totalOutstanding)}</div>
          </div>
          <div style={s.summaryCard}>
            <div style={s.summaryLabel}>Overdue Students</div>
            <div style={{ ...s.summaryValue, color: '#dc2626' }}>
              {sorted.filter(d => d.vouchers.some(v => v.status === 'overdue')).length}
            </div>
          </div>
          <div style={s.summaryCard}>
            <div style={s.summaryLabel}>Avg. Outstanding</div>
            <div style={{ ...s.summaryValue, color: '#c2410c' }}>{fmtMoney(totalOutstanding / sorted.length)}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={s.filterBar}>
        <select value={filterSection} onChange={e => setFilterSection(e.target.value)} style={s.select}>
          <option value="">All Sections</option>
          {sections.map(sec => <option key={sec.id} value={sec.id}>{sec.course_name} — {sec.name}</option>)}
        </select>
        <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); }} style={s.searchForm}>
          <input
            placeholder="Search student name or adm#..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            style={s.searchInput}
          />
          <button type="submit" style={s.searchBtn}>Search</button>
          {search && <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }} style={s.clearBtn}>✕ Clear</button>}
        </form>
        <div style={s.sortRow}>
          <span style={s.sortLabel}>Sort by:</span>
          {[['balance', 'Highest Due'], ['months', 'Most Months'], ['name', 'Name']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              style={{ ...s.sortBtn, ...(sortBy === key ? s.sortBtnActive : {}) }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={s.center}><span style={s.spinner} /> Loading defaulters…</div>
      ) : sorted.length === 0 ? (
        <div style={s.empty}>
          <div style={{ fontSize: 48 }}>✅</div>
          <div style={s.emptyTitle}>No defaulters found</div>
          <div style={s.emptySub}>
            {search || filterSection
              ? 'No unpaid vouchers match your current filters.'
              : 'All students are up to date — or no monthly vouchers have been generated yet. Go to Fee Vouchers → Monthly Vouchers and click ⚡ Generate Vouchers first.'
            }
          </div>
        </div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                <th style={s.th}>#</th>
                <th style={s.th}>Student</th>
                <th style={s.th}>Class / Section</th>
                <th style={s.th}>Unpaid Vouchers</th>
                <th style={s.th}>Months Pending</th>
                <th style={s.th}>Total Outstanding</th>
                <th style={s.th}>Worst Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d, i) => {
                const monthlyVouchers = d.vouchers.filter(v => v.voucher_type === 'monthly');
                const hasOverdue = d.vouchers.some(v => v.status === 'overdue');
                return (
                  <tr key={d.student_id} style={{ background: i % 2 === 0 ? '#fff' : '#fef2f2' }}>
                    <td style={{ ...s.td, color: '#94a3b8', fontSize: 12, width: 40 }}>{i + 1}</td>
                    <td style={s.td}>
                      <div style={s.studentRow}>
                        <div style={{ ...s.avatar, background: hasOverdue ? '#fef2f2' : '#fff7ed', color: hasOverdue ? '#dc2626' : '#c2410c', border: `2px solid ${hasOverdue ? '#fecaca' : '#fed7aa'}` }}>
                          {(d.student_name || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={s.studentName}>{d.student_name}</div>
                          <div style={s.admNum}>Adm# {d.admission_number}</div>
                        </div>
                      </div>
                    </td>
                    <td style={s.td}>
                      <div style={s.className}>{d.class_name || '—'}</div>
                      {d.section_name && <div style={s.sectionName}>{d.section_name}</div>}
                    </td>
                    <td style={{ ...s.td, fontWeight: 700, color: '#dc2626' }}>
                      {d.vouchers.length} voucher{d.vouchers.length !== 1 ? 's' : ''}
                    </td>
                    <td style={s.td}>
                      {monthlyVouchers.length > 0 ? (
                        <div style={s.monthTags}>
                          {monthlyVouchers.slice(0, 3).map(v => (
                            <span key={v.id} style={{ ...s.monthTag, background: v.status === 'overdue' ? '#fef2f2' : '#fff7ed', color: v.status === 'overdue' ? '#dc2626' : '#c2410c', border: `1px solid ${v.status === 'overdue' ? '#fecaca' : '#fed7aa'}` }}>
                              {fmtMonth(v.month)}
                            </span>
                          ))}
                          {monthlyVouchers.length > 3 && (
                            <span style={{ ...s.monthTag, background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }}>
                              +{monthlyVouchers.length - 3} more
                            </span>
                          )}
                        </div>
                      ) : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ ...s.td, fontWeight: 800, fontSize: 15, color: '#dc2626' }}>
                      {fmtMoney(d.total_balance)}
                    </td>
                    <td style={s.td}>
                      {hasOverdue ? (
                        <span style={s.overdueTag}>⚠ Overdue</span>
                      ) : (
                        <span style={s.pendingTag}>🔴 Pending</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const s = {
  page:         { padding: '0 0 40px' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 24px', marginBottom: 20 },
  headerLeft:   { display: 'flex', alignItems: 'center', gap: 14 },
  title:        { fontSize: 18, fontWeight: 700, color: '#1e293b' },
  sub:          { fontSize: 13, color: '#64748b', marginTop: 2 },
  printBtn:     { padding: '8px 20px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' },
  summaryRow:   { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 },
  summaryCard:  { background: '#fff', border: '1px solid #fecaca', borderRadius: 10, padding: '14px 18px' },
  summaryLabel: { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' },
  summaryValue: { fontSize: 22, fontWeight: 800, marginTop: 6 },
  filterBar:    { display: 'flex', gap: 12, alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, flexWrap: 'wrap' },
  select:       { padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', minWidth: 180 },
  searchForm:   { display: 'flex', gap: 6, flex: 1, minWidth: 220 },
  searchInput:  { flex: 1, padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' },
  searchBtn:    { padding: '8px 16px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: 'inherit' },
  clearBtn:     { padding: '8px 12px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  sortRow:      { display: 'flex', alignItems: 'center', gap: 6 },
  sortLabel:    { fontSize: 12, color: '#64748b', fontWeight: 600 },
  sortBtn:      { padding: '5px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#64748b', fontFamily: 'inherit' },
  sortBtnActive:{ background: '#1e3a5f', color: '#fff', border: '1px solid #1e3a5f' },
  tableWrap:    { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' },
  table:        { width: '100%', borderCollapse: 'collapse' },
  thead:        { background: '#1e3a5f' },
  th:           { padding: '11px 14px', color: '#fff', fontSize: 11, fontWeight: 700, textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.5px' },
  td:           { padding: '12px 14px', fontSize: 13, borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
  studentRow:   { display: 'flex', alignItems: 'center', gap: 10 },
  avatar:       { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, flexShrink: 0 },
  studentName:  { fontWeight: 700, fontSize: 13, color: '#1e293b' },
  admNum:       { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  className:    { fontWeight: 600, fontSize: 13, color: '#334155' },
  sectionName:  { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  monthTags:    { display: 'flex', flexWrap: 'wrap', gap: 4 },
  monthTag:     { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 },
  overdueTag:   { display: 'inline-block', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 },
  pendingTag:   { display: 'inline-block', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 },
  center:       { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 60, color: '#64748b' },
  spinner:      { display: 'inline-block', width: 18, height: 18, border: '2px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
  empty:        { textAlign: 'center', padding: '60px 20px', color: '#94a3b8' },
  emptyTitle:   { fontSize: 18, fontWeight: 700, marginTop: 12, color: '#64748b' },
  emptySub:     { fontSize: 13, marginTop: 6 },
};
