import { useEffect, useState } from 'react';
import api from '../../services/api';

const STATUS_CFG = {
  present: { label: 'Present', color: '#15803d', bg: '#dcfce7', border: '#86efac', dot: '#22c55e', icon: '✅' },
  absent:  { label: 'Absent',  color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', dot: '#ef4444', icon: '❌' },
  late:    { label: 'Late',    color: '#d97706', bg: '#fef3c7', border: '#fcd34d', dot: '#f59e0b', icon: '⏰' },
  leave:   { label: 'Leave',   color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd', dot: '#8b5cf6', icon: '🌿' },
};

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const fmtMonth = (m) => {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
};
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

export default function MyTeacherAttendancePage() {
  const [month, setMonth]   = useState(currentMonth());
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    setLoading(true);
    api.get(`/attendance/teachers/me/?month=${month}`)
      .then(r => setData(r.data))
      .catch(() => setError('Could not load your attendance records.'))
      .finally(() => setLoading(false));
  }, [month]);

  const summary = data?.summary ?? {};
  const records = data?.records ?? [];
  const pct     = summary.percentage ?? 0;
  const pctGood = pct >= 80;

  return (
    <div style={st.page}>

      {/* ── Header ── */}
      <div style={st.hero}>
        <div style={st.heroLeft}>
          <div style={st.heroIcon}>📅</div>
          <div>
            <div style={st.heroTitle}>My Attendance</div>
            <div style={st.heroSub}>{fmtMonth(month)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={st.pctBadge}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Attendance Rate</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: pctGood ? '#4ade80' : '#f87171', lineHeight: 1, marginTop: 2 }}>{pct}%</div>
          </div>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            max={currentMonth()}
            style={st.monthInput} />
        </div>
      </div>

      {error && <div style={st.errorBox}>{error}</div>}

      {/* ── Stats cards ── */}
      <div style={st.statsRow}>
        <StatCard icon="📋" label="Total Days" value={summary.total ?? 0} color="#1e293b" bg="#f8fafc" />
        <StatCard icon="✅" label="Present"    value={summary.present ?? 0} color="#15803d" bg="#dcfce7" />
        <StatCard icon="❌" label="Absent"     value={summary.absent ?? 0}  color="#dc2626" bg="#fee2e2" />
        <StatCard icon="⏰" label="Late"       value={summary.late ?? 0}    color="#d97706" bg="#fef3c7" />
        <StatCard icon="🌿" label="Leave"      value={summary.on_leave ?? 0} color="#7c3aed" bg="#ede9fe" />
      </div>

      {/* ── Attendance bar ── */}
      {summary.total > 0 && (
        <div style={st.barCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Attendance Rate</span>
            <span style={{ fontSize: 13, color: '#64748b' }}>{summary.present + summary.late} / {summary.total} days</span>
          </div>
          <div style={st.barTrack}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 8, transition: 'width .5s',
              background: pctGood ? 'linear-gradient(90deg,#059669,#22c55e)' : 'linear-gradient(90deg,#dc2626,#f87171)' }} />
          </div>
          <div style={{ fontSize: 12, color: pctGood ? '#15803d' : '#dc2626', marginTop: 6, fontWeight: 600 }}>
            {pct}% — {pctGood ? 'Good standing' : 'Below 80% threshold'}
          </div>
        </div>
      )}

      {/* ── Records table ── */}
      <div style={st.tableCard}>
        <div style={st.tableTitle}>Attendance Records — {fmtMonth(month)}</div>

        {loading ? (
          <div style={st.empty}>Loading…</div>
        ) : records.length === 0 ? (
          <div style={st.empty}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
            <div style={{ fontWeight: 600, color: '#475569' }}>No records for this month</div>
          </div>
        ) : (
          <>
            <div style={st.tableHead}>
              <div style={{ flex: 2 }}>Date</div>
              <div style={{ flex: 1, textAlign: 'center' }}>Status</div>
              <div style={{ flex: 1 }}>Arrival</div>
              <div style={{ flex: 2 }}>Note</div>
              <div style={{ flex: 2 }}>Marked By</div>
            </div>
            {records.map((r, i) => {
              const cfg = STATUS_CFG[r.status] ?? STATUS_CFG.absent;
              return (
                <div key={r.id} style={{ ...st.tableRow, background: i % 2 === 0 ? '#fff' : '#fafafa', borderLeft: `3px solid ${cfg.dot}` }}>
                  <div style={{ flex: 2 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{fmtDate(r.date)}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.date}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: '#334155' }}>
                    {r.arrival_time || '—'}
                  </div>
                  <div style={{ flex: 2, fontSize: 12, color: '#64748b', fontStyle: r.note ? 'normal' : 'italic' }}>
                    {r.note || 'No note'}
                  </div>
                  <div style={{ flex: 2, fontSize: 12, color: '#6366f1' }}>
                    {r.marked_by || '—'}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, bg }) {
  return (
    <div style={{ flex: '1 1 100px', background: bg, borderRadius: 12, padding: '14px 16px', textAlign: 'center', minWidth: 90 }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</div>
    </div>
  );
}

const st = {
  page: { maxWidth: 860, margin: '0 auto', padding: '28px 20px', fontFamily: 'inherit' },

  hero:      { background: 'linear-gradient(135deg,#1e293b,#0f172a)', borderRadius: 16, padding: '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20, boxShadow: '0 6px 24px rgba(15,23,42,0.18)' },
  heroLeft:  { display: 'flex', alignItems: 'center', gap: 16 },
  heroIcon:  { fontSize: 36, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '8px 12px' },
  heroTitle: { fontSize: 22, fontWeight: 800, color: '#fff', margin: 0 },
  heroSub:   { fontSize: 13, color: '#94a3b8', marginTop: 3 },
  pctBadge:  { textAlign: 'right' },
  monthInput:{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: 9, padding: '7px 12px', fontSize: 13, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.08)', cursor: 'pointer' },

  errorBox:  { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 16 },
  statsRow:  { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 },

  barCard:   { background: '#fff', borderRadius: 12, padding: '16px 20px', marginBottom: 16, border: '1px solid #e2e8f0' },
  barTrack:  { height: 10, background: '#f1f5f9', borderRadius: 8, overflow: 'hidden' },

  tableCard:  { background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  tableTitle: { padding: '14px 20px', fontSize: 14, fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' },
  tableHead:  { display: 'flex', gap: 12, padding: '10px 18px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' },
  tableRow:   { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', borderBottom: '1px solid #f8fafc' },
  empty:      { padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 },
};
