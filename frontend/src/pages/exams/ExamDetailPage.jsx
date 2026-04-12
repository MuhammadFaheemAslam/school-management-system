import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const GRADE_COLOR = {
  'A+': { bg: '#c6f6d5', color: '#276749' },
  'A':  { bg: '#c6f6d5', color: '#276749' },
  'B':  { bg: '#ebf8ff', color: '#2b6cb0' },
  'C':  { bg: '#fefcbf', color: '#744210' },
  'D':  { bg: '#fef3c7', color: '#92400e' },
  'F':  { bg: '#fed7d7', color: '#c53030' },
};

export default function ExamDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canEnterMarks = ['super_admin', 'school_admin', 'principal', 'teacher'].includes(user?.role);

  const [data, setData]         = useState(null);
  const [students, setStudents] = useState([]);
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');
  const [enterMode, setEnterMode] = useState(false);

  const fetchData = async () => {
    const [examRes] = await Promise.all([
      api.get(`/exams/${id}/results/`),
    ]);
    setData(examRes.data);

    if (canEnterMarks) {
      const sectionId = examRes.data.exam.class_section;
      const studentsRes = await api.get(`/students/?section=${sectionId}`);
      const resultMap = {};
      examRes.data.results.forEach(r => { resultMap[r.student] = r; });

      setStudents(studentsRes.data);
      setRows(studentsRes.data.map(s => ({
        student: s.id,
        student_name: s.full_name,
        admission_number: s.admission_number,
        marks_obtained: resultMap[s.id]?.marks_obtained ?? '',
        remarks: resultMap[s.id]?.remarks ?? '',
        existing_grade: resultMap[s.id]?.grade,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

  const setMark  = (i, val) => setRows(p => p.map((r, idx) => idx === i ? { ...r, marks_obtained: val } : r));
  const setRemark = (i, val) => setRows(p => p.map((r, idx) => idx === i ? { ...r, remarks: val } : r));

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    const total = data.exam.total_marks;
    for (const r of rows) {
      if (r.marks_obtained !== '' && Number(r.marks_obtained) > total) {
        setError(`Marks for ${r.student_name} exceed total marks (${total}).`);
        setSaving(false);
        return;
      }
    }
    const toSubmit = rows.filter(r => r.marks_obtained !== '');
    try {
      await api.post('/exams/marks/', {
        exam: id,
        results: toSubmit.map(r => ({ student: r.student, marks_obtained: r.marks_obtained, remarks: r.remarks })),
      });
      setSaved(true);
      setEnterMode(false);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save marks.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={styles.container}><p>Loading...</p></div>;
  if (!data) return null;

  const { exam, summary, results } = data;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/exams')} style={styles.backBtn}>&larr; Exams</button>
        <h2 style={styles.title}>{exam.name}</h2>
        {canEnterMarks && !enterMode && (
          <button onClick={() => setEnterMode(true)} style={styles.enterBtn}>Enter / Edit Marks</button>
        )}
        {enterMode && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>{saving ? 'Saving...' : 'Save Marks'}</button>
            <button onClick={() => { setEnterMode(false); setSaved(false); }} style={styles.cancelBtn}>Cancel</button>
          </div>
        )}
      </div>

      {/* Exam info */}
      <div style={styles.infoBar}>
        <InfoChip label="Section"  value={exam.class_section_name} />
        <InfoChip label="Subject"  value={exam.subject_name} />
        <InfoChip label="Date"     value={exam.date} />
        <InfoChip label="Total"    value={exam.total_marks} />
        <InfoChip label="Passing"  value={exam.passing_marks} />
      </div>

      {/* Summary (admin/teacher view only) */}
      {summary && (
        <div style={styles.summaryRow}>
          <SCard label="Students" value={summary.total_students} color="#2b6cb0" bg="#ebf8ff" />
          <SCard label="Passed"   value={summary.passed}         color="#276749" bg="#c6f6d5" />
          <SCard label="Failed"   value={summary.failed}         color="#c53030" bg="#fed7d7" />
          <SCard label="Pass Rate" value={`${summary.pass_rate}%`} color="#6b46c1" bg="#e9d8fd" />
          <SCard label="Average"  value={summary.average}        color="#744210" bg="#fefcbf" />
          <SCard label="Highest"  value={summary.highest}        color="#276749" bg="#c6f6d5" />
          <SCard label="Lowest"   value={summary.lowest}         color="#c53030" bg="#fed7d7" />
        </div>
      )}

      {error && <div style={styles.errorBox}>{error}</div>}
      {saved && <div style={styles.successBox}>✓ Marks saved successfully</div>}

      {/* Marks entry or results table */}
      {enterMode ? (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>#</th>
                <th style={styles.th}>Student</th>
                <th style={styles.th}>Adm. No.</th>
                <th style={styles.th}>Marks / {exam.total_marks}</th>
                <th style={styles.th}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.student} style={styles.tr}>
                  <td style={{ ...styles.td, color: '#718096', width: '40px' }}>{i + 1}</td>
                  <td style={styles.td}><strong>{row.student_name}</strong></td>
                  <td style={styles.td}><span style={styles.admNo}>{row.admission_number}</span></td>
                  <td style={styles.td}>
                    <input
                      type="number" min="0" max={exam.total_marks} step="0.5"
                      value={row.marks_obtained}
                      onChange={e => setMark(i, e.target.value)}
                      placeholder={`0 – ${exam.total_marks}`}
                      style={styles.markInput}
                    />
                  </td>
                  <td style={styles.td}>
                    <input value={row.remarks} onChange={e => setRemark(i, e.target.value)} placeholder="Optional" style={styles.remarkInput} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : results.length === 0 ? (
        <p style={styles.hint}>No marks entered yet.{canEnterMarks ? ' Click "Enter / Edit Marks" to start.' : ''}</p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>#</th>
                <th style={styles.th}>Student</th>
                <th style={styles.th}>Adm. No.</th>
                <th style={styles.th}>Marks</th>
                <th style={styles.th}>%</th>
                <th style={styles.th}>Grade</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const gc = GRADE_COLOR[r.grade] || GRADE_COLOR['F'];
                return (
                  <tr key={r.id} style={styles.tr}>
                    <td style={{ ...styles.td, color: '#718096' }}>{i + 1}</td>
                    <td style={styles.td}><strong>{r.student_name}</strong></td>
                    <td style={styles.td}><span style={styles.admNo}>{r.admission_number}</span></td>
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

function InfoChip({ label, value }) {
  return (
    <div style={{ background: '#fff', padding: '10px 16px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: '11px', color: '#718096', fontWeight: '600', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: '700', color: '#2d3748', marginTop: '2px' }}>{value}</div>
    </div>
  );
}

function SCard({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, padding: '14px 18px', borderRadius: '10px', textAlign: 'center', minWidth: '90px' }}>
      <div style={{ fontSize: '20px', fontWeight: '800', color }}>{value}</div>
      <div style={{ fontSize: '11px', color, fontWeight: '600', marginTop: '2px' }}>{label}</div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f0f2f5', padding: '24px' },
  header: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' },
  backBtn: { padding: '8px 14px', background: '#fff', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  title: { margin: 0, fontSize: '22px', color: '#1a1a2e', flex: 1 },
  enterBtn: { padding: '9px 18px', background: '#744210', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' },
  saveBtn: { padding: '9px 18px', background: '#276749', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' },
  cancelBtn: { padding: '9px 18px', background: '#fff', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer' },
  infoBar: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' },
  summaryRow: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' },
  errorBox: { background: '#fff5f5', border: '1px solid #feb2b2', color: '#c53030', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' },
  successBox: { background: '#c6f6d5', color: '#276749', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontWeight: '600' },
  hint: { color: '#888', fontSize: '14px' },
  tableWrap: { background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f7fafc' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '700', color: '#718096', borderBottom: '1px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #f7f7f7' },
  td: { padding: '12px 16px', fontSize: '14px', color: '#2d3748' },
  admNo: { background: '#f7fafc', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' },
  markInput: { padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', width: '110px' },
  remarkInput: { padding: '7px 10px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '13px', width: '150px' },
  gradeBadge: { padding: '3px 10px', borderRadius: '20px', fontSize: '13px', fontWeight: '800' },
  passed: { background: '#c6f6d5', color: '#276749', padding: '2px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },
  failed: { background: '#fed7d7', color: '#c53030', padding: '2px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' },
};
