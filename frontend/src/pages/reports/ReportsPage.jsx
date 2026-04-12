import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

export default function ReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStudent = user?.role === 'student';

  const [filters, setFilters] = useState({ sections: [], exams: [] });

  useEffect(() => {
    api.get('/reports/filters/').then(r => setFilters(r.data)).catch(() => {});
  }, []);

  return (
    <div style={st.container}>
      <div style={st.header}>
        <button onClick={() => navigate('/dashboard')} style={st.backBtn}>&larr; Dashboard</button>
        <h2 style={st.title}>Reports & Downloads</h2>
      </div>
      <p style={st.subtitle}>Generate and download reports as PDF or CSV.</p>

      <div style={st.grid}>
        {/* Attendance Report – management only */}
        {!isStudent && (
          <ReportCard
            title="Attendance Report"
            icon="📋"
            color="#2b6cb0"
            bg="#ebf8ff"
            description="Download attendance records for a class section filtered by date range."
          >
            <AttendanceForm sections={filters.sections} />
          </ReportCard>
        )}

        {/* Exam Results – management only */}
        {!isStudent && (
          <ReportCard
            title="Exam Results Report"
            icon="📝"
            color="#6b46c1"
            bg="#e9d8fd"
            description="Download all student results for a specific exam."
          >
            <ResultsForm exams={filters.exams} />
          </ReportCard>
        )}

        {/* Fees Report – management only */}
        {!isStudent && (
          <ReportCard
            title="Fee Collection Report"
            icon="💰"
            color="#276749"
            bg="#c6f6d5"
            description="Download fee collection data, optionally filtered by section or academic year."
          >
            <FeesForm sections={filters.sections} />
          </ReportCard>
        )}

        {/* Report Card – available to both management and student */}
        <ReportCard
          title="Student Report Card"
          icon="🎓"
          color="#c05621"
          bg="#fef3c7"
          description={isStudent
            ? "Download your personal report card with attendance, results, and fee summary."
            : "Download a full report card for any student."}
        >
          <ReportCardForm sections={filters.sections} isStudent={isStudent} />
        </ReportCard>
      </div>
    </div>
  );
}

// ── Download helper ───────────────────────────────────────────────────────────

async function downloadFile(endpoint, params, filename, setLoading, setError) {
  setLoading(true);
  setError('');
  try {
    const resp = await api.get(endpoint, { params, responseType: 'blob' });
    const url  = window.URL.createObjectURL(new Blob([resp.data]));
    const link = document.createElement('a');
    link.href  = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    setError('Failed to generate report. Please check your filters and try again.');
  } finally {
    setLoading(false);
  }
}

// ── Attendance Form ───────────────────────────────────────────────────────────

function AttendanceForm({ sections }) {
  const [section, setSection]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const download = (fmt) => {
    if (!section) { setError('Please select a section.'); return; }
    const sec = sections.find(s => String(s.id) === String(section));
    downloadFile('/reports/attendance/', { section, date_from: dateFrom, date_to: dateTo, fmt },
      `attendance_${sec?.label || section}.${fmt}`, setLoading, setError);
  };

  return (
    <FormBody error={error} loading={loading}>
      <Field label="Section *">
        <select value={section} onChange={e => setSection(e.target.value)} style={st.input}>
          <option value="">-- Select section --</option>
          {sections.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </Field>
      <div style={st.row}>
        <Field label="From Date">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={st.input} />
        </Field>
        <Field label="To Date">
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={st.input} />
        </Field>
      </div>
      <DownloadButtons onCSV={() => download('csv')} onPDF={() => download('pdf')} loading={loading} />
    </FormBody>
  );
}

// ── Results Form ──────────────────────────────────────────────────────────────

function ResultsForm({ exams }) {
  const [exam, setExam]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const download = (fmt) => {
    if (!exam) { setError('Please select an exam.'); return; }
    const ex = exams.find(e => String(e.id) === String(exam));
    downloadFile('/reports/results/', { exam, fmt },
      `results_${ex?.label || exam}.${fmt}`, setLoading, setError);
  };

  return (
    <FormBody error={error} loading={loading}>
      <Field label="Exam *">
        <select value={exam} onChange={e => setExam(e.target.value)} style={st.input}>
          <option value="">-- Select exam --</option>
          {exams.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
        </select>
      </Field>
      <DownloadButtons onCSV={() => download('csv')} onPDF={() => download('pdf')} loading={loading} />
    </FormBody>
  );
}

// ── Fees Form ─────────────────────────────────────────────────────────────────

function FeesForm({ sections }) {
  const [section, setSection] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const download = (fmt) => {
    downloadFile('/reports/fees/', { section, fmt },
      `fees_report.${fmt}`, setLoading, setError);
  };

  return (
    <FormBody error={error} loading={loading}>
      <Field label="Section (optional)">
        <select value={section} onChange={e => setSection(e.target.value)} style={st.input}>
          <option value="">All Sections</option>
          {sections.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </Field>
      <DownloadButtons onCSV={() => download('csv')} onPDF={() => download('pdf')} loading={loading} />
    </FormBody>
  );
}

// ── Report Card Form ──────────────────────────────────────────────────────────

function ReportCardForm({ sections, isStudent }) {
  const [section, setSection]   = useState('');
  const [students, setStudents] = useState([]);
  const [student, setStudent]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (section) {
      api.get(`/students/?section=${section}`).then(r => setStudents(r.data)).catch(() => {});
    } else {
      setStudents([]);
      setStudent('');
    }
  }, [section]);

  const download = (fmt) => {
    if (!isStudent && !student) { setError('Please select a student.'); return; }
    const params = isStudent ? { fmt } : { student, fmt };
    const filename = `report_card.${fmt}`;
    downloadFile('/reports/report-card/', params, filename, setLoading, setError);
  };

  if (isStudent) {
    return (
      <FormBody error={error} loading={loading}>
        <p style={{ margin: 0, fontSize: '13px', color: '#718096' }}>
          Your complete report card with attendance, exam results and fee summary.
        </p>
        <DownloadButtons onCSV={() => download('csv')} onPDF={() => download('pdf')} loading={loading} />
      </FormBody>
    );
  }

  return (
    <FormBody error={error} loading={loading}>
      <Field label="Section *">
        <select value={section} onChange={e => { setSection(e.target.value); setStudent(''); }} style={st.input}>
          <option value="">-- Select section --</option>
          {sections.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </Field>
      {students.length > 0 && (
        <Field label="Student *">
          <select value={student} onChange={e => setStudent(e.target.value)} style={st.input}>
            <option value="">-- Select student --</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.admission_number})</option>)}
          </select>
        </Field>
      )}
      <DownloadButtons onCSV={() => download('csv')} onPDF={() => download('pdf')} loading={loading} />
    </FormBody>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function ReportCard({ title, icon, color, bg, description, children }) {
  return (
    <div style={st.card}>
      <div style={{ ...st.cardHead, background: bg }}>
        <span style={{ fontSize: '22px' }}>{icon}</span>
        <h3 style={{ ...st.cardTitle, color }}>{title}</h3>
      </div>
      <div style={st.cardBody}>
        <p style={st.cardDesc}>{description}</p>
        {children}
      </div>
    </div>
  );
}

function FormBody({ error, loading, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {children}
      {error && <p style={{ color: '#c53030', fontSize: '12px', margin: 0 }}>{error}</p>}
      {loading && <p style={{ color: '#718096', fontSize: '12px', margin: 0 }}>Generating report…</p>}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '12px', fontWeight: '600', color: '#555' }}>{label}</label>
      {children}
    </div>
  );
}

function DownloadButtons({ onCSV, onPDF, loading }) {
  return (
    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
      <button onClick={onPDF} disabled={loading} style={st.pdfBtn}>
        {loading ? '…' : '⬇ PDF'}
      </button>
      <button onClick={onCSV} disabled={loading} style={st.csvBtn}>
        {loading ? '…' : '⬇ CSV'}
      </button>
    </div>
  );
}

const st = {
  container: { minHeight: '100vh', background: '#f0f2f5', padding: '24px' },
  header:    { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' },
  backBtn:   { padding: '8px 14px', background: '#fff', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  title:     { margin: 0, fontSize: '22px', color: '#1a1a2e' },
  subtitle:  { margin: '0 0 24px 0', color: '#718096', fontSize: '14px' },
  grid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' },
  card:      { background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' },
  cardHead:  { padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px' },
  cardTitle: { margin: 0, fontSize: '15px', fontWeight: '800' },
  cardBody:  { padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' },
  cardDesc:  { margin: 0, fontSize: '13px', color: '#718096' },
  input:     { padding: '8px 10px', border: '1px solid #ddd', borderRadius: '7px', fontSize: '13px', width: '100%', boxSizing: 'border-box' },
  row:       { display: 'flex', gap: '10px' },
  pdfBtn:    { padding: '8px 16px', background: '#c05621', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' },
  csvBtn:    { padding: '8px 16px', background: '#276749', color: '#fff', border: 'none', borderRadius: '7px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' },
};
