import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const STATUS_STYLE = {
  present: { background: '#c6f6d5', color: '#276749' },
  absent:  { background: '#fed7d7', color: '#c53030' },
  late:    { background: '#fefcbf', color: '#744210' },
  leave:   { background: '#ede9fe', color: '#6b21a8' },
};

export default function MyAttendancePage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.get('/attendance/me/')
      .then(r => setData(r.data))
      .catch(() => setError('Could not load attendance records.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.container}><p>Loading...</p></div>;
  if (error) return <div style={styles.container}><div style={styles.errorBox}>{error}</div></div>;
  if (!data) return null;

  const { summary, records } = data;
  const filtered = filter === 'all' ? records : records.filter(r => r.status === filter);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>&larr; Dashboard</button>
        <h2 style={styles.title}>My Attendance</h2>
      </div>

      {/* Summary cards */}
      <div style={styles.summaryRow}>
        <SummaryCard label="Total Days" value={summary.total} color="#2b6cb0" bg="#ebf8ff" />
        <SummaryCard label="Present" value={summary.present} color="#276749" bg="#c6f6d5" />
        <SummaryCard label="Absent" value={summary.absent} color="#c53030" bg="#fed7d7" />
        <SummaryCard label="Late" value={summary.late} color="#744210" bg="#fefcbf" />
        <SummaryCard label="Leave" value={summary.leave ?? 0} color="#6b21a8" bg="#ede9fe" />
        <SummaryCard label="Attendance %" value={`${summary.percentage}%`} color="#6b46c1" bg="#e9d8fd" big />
      </div>

      {/* Progress bar */}
      <div style={styles.progressWrap}>
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${summary.percentage}%`, background: summary.percentage >= 75 ? '#276749' : '#c53030' }} />
        </div>
        <span style={{ fontSize: '13px', color: summary.percentage >= 75 ? '#276749' : '#c53030', fontWeight: '700' }}>
          {summary.percentage}% — {summary.percentage >= 75 ? 'Good Standing' : 'Below Required (75%)'}
        </span>
      </div>

      {/* Filter */}
      <div style={styles.filterRow}>
        {['all', 'present', 'absent', 'late', 'leave'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ ...styles.filterBtn, background: filter === f ? '#2b6cb0' : '#fff', color: filter === f ? '#fff' : '#555', border: filter === f ? 'none' : '1px solid #ddd' }}>
            {f === 'leave' ? 'Leave' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Records table */}
      {filtered.length === 0 ? (
        <p style={styles.hint}>No records found.</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Marked By</th>
                <th style={styles.th}>Note</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id || r.date} style={styles.tr}>
                  <td style={styles.td}>{r.date}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.statusBadge, ...(STATUS_STYLE[r.status] || {}) }}>
                      {r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : '—'}
                    </span>
                  </td>
                  <td style={styles.td}>{r.marked_by_name || '—'}</td>
                  <td style={{ ...styles.td, color: '#718096' }}>{r.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, bg, big }) {
  return (
    <div style={{ background: bg, padding: big ? '20px 24px' : '16px 20px', borderRadius: '12px', textAlign: 'center', minWidth: '100px' }}>
      <div style={{ fontSize: big ? '28px' : '24px', fontWeight: '800', color }}>{value}</div>
      <div style={{ fontSize: '12px', color, fontWeight: '600', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f0f2f5', padding: '24px' },
  header: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' },
  backBtn: { padding: '8px 14px', background: '#fff', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  title: { margin: 0, fontSize: '22px', color: '#1a1a2e' },
  errorBox: { background: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '16px', borderRadius: '8px' },
  summaryRow: { display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' },
  progressWrap: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' },
  progressBar: { flex: 1, height: '10px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden', maxWidth: '400px' },
  progressFill: { height: '100%', borderRadius: '999px', transition: 'width 0.5s' },
  filterRow: { display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' },
  filterBtn: { padding: '7px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  hint: { color: '#888', fontSize: '14px' },
  tableWrap: { background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f7fafc' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '700', color: '#718096', borderBottom: '1px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #f7f7f7' },
  td: { padding: '13px 16px', fontSize: '14px', color: '#2d3748' },
  statusBadge: { padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },
};
