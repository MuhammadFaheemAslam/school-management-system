import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const GRADE_COLOR = {
  'A+': { bg: '#c6f6d5', color: '#276749' },
  'A':  { bg: '#c6f6d5', color: '#276749' },
  'B':  { bg: '#ebf8ff', color: '#2b6cb0' },
  'C':  { bg: '#fefcbf', color: '#744210' },
  'D':  { bg: '#fef3c7', color: '#92400e' },
  'F':  { bg: '#fed7d7', color: '#c53030' },
};

export default function MyResultsPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState('all');

  useEffect(() => {
    api.get('/exams/my-results/')
      .then(r => setResults(r.data))
      .catch(() => setError('Could not load your results.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? results
    : filter === 'passed' ? results.filter(r => r.passed)
    : results.filter(r => !r.passed);

  const summary = {
    total:  results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    avg:    results.length
      ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length * 10) / 10
      : 0,
  };

  if (loading) return <div style={styles.container}><p>Loading...</p></div>;
  if (error)   return <div style={styles.container}><div style={styles.errorBox}>{error}</div></div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>&larr; Dashboard</button>
        <h2 style={styles.title}>My Results</h2>
      </div>

      {/* Summary */}
      <div style={styles.summaryRow}>
        <SCard label="Exams Taken"  value={summary.total}  color="#2b6cb0" bg="#ebf8ff" />
        <SCard label="Passed"       value={summary.passed} color="#276749" bg="#c6f6d5" />
        <SCard label="Failed"       value={summary.failed} color="#c53030" bg="#fed7d7" />
        <SCard label="Avg. Score"   value={`${summary.avg}%`} color="#6b46c1" bg="#e9d8fd" />
      </div>

      {/* Filter */}
      <div style={styles.filterRow}>
        {['all', 'passed', 'failed'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ ...styles.filterBtn, background: filter === f ? '#2b6cb0' : '#fff', color: filter === f ? '#fff' : '#555', border: filter === f ? 'none' : '1px solid #ddd' }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? <p style={styles.hint}>No results found.</p> : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>Exam</th>
                <th style={styles.th}>Subject</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Marks</th>
                <th style={styles.th}>%</th>
                <th style={styles.th}>Grade</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const gc = GRADE_COLOR[r.grade] || GRADE_COLOR['F'];
                return (
                  <tr key={r.id} style={styles.tr}>
                    <td style={styles.td}><strong>{r.exam_name}</strong></td>
                    <td style={styles.td}>{r.subject_name || '—'}</td>
                    <td style={styles.td}>{r.exam_date || '—'}</td>
                    <td style={styles.td}>{r.marks_obtained} / {r.total_marks}</td>
                    <td style={styles.td}>{r.percentage}%</td>
                    <td style={styles.td}><span style={{ ...styles.gradeBadge, ...gc }}>{r.grade}</span></td>
                    <td style={styles.td}>
                      <span style={r.passed ? styles.passed : styles.failed}>{r.passed ? 'Pass' : 'Fail'}</span>
                    </td>
                    <td style={{ ...styles.td, color: '#718096' }}>{r.remarks || '—'}</td>
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

function SCard({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, padding: '16px 20px', borderRadius: '10px', textAlign: 'center', minWidth: '100px' }}>
      <div style={{ fontSize: '24px', fontWeight: '800', color }}>{value}</div>
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
  filterRow: { display: 'flex', gap: '8px', marginBottom: '16px' },
  filterBtn: { padding: '7px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  hint: { color: '#888', fontSize: '14px' },
  tableWrap: { background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f7fafc' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '700', color: '#718096', borderBottom: '1px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #f7f7f7' },
  td: { padding: '12px 16px', fontSize: '14px', color: '#2d3748' },
  gradeBadge: { padding: '3px 10px', borderRadius: '20px', fontSize: '13px', fontWeight: '800' },
  passed: { background: '#c6f6d5', color: '#276749', padding: '2px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },
  failed: { background: '#fed7d7', color: '#c53030', padding: '2px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },
};
