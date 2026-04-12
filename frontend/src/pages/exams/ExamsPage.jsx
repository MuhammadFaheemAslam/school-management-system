import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const EXAM_TYPE_COLORS = {
  quiz:       { bg: '#ebf8ff', color: '#2b6cb0' },
  midterm:    { bg: '#e9d8fd', color: '#6b46c1' },
  final:      { bg: '#fed7d7', color: '#c53030' },
  assignment: { bg: '#c6f6d5', color: '#276749' },
  other:      { bg: '#e2e8f0', color: '#4a5568' },
};

export default function ExamsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canManage = ['super_admin', 'school_admin', 'principal', 'teacher'].includes(user?.role);

  const [exams, setExams]           = useState([]);
  const [sections, setSections]     = useState([]);
  const [subjects, setSubjects]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filterSection, setFilter]  = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState({ name: '', exam_type: 'other', class_section: '', subject: '', date: '', total_marks: '', passing_marks: '' });
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');

  useEffect(() => {
    fetchExams();
    api.get('/courses/sections/').then(r => setSections(r.data));
    api.get('/courses/subjects/').then(r => setSubjects(r.data));
  }, []);

  useEffect(() => { fetchExams(); }, [filterSection]);

  const fetchExams = async () => {
    setLoading(true);
    try {
      const params = filterSection ? `?section=${filterSection}` : '';
      const res = await api.get(`/exams/${params}`);
      setExams(res.data);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubjects = form.class_section
    ? subjects.filter(s => {
        const sec = sections.find(sec => String(sec.id) === String(form.class_section));
        return sec ? String(s.course) === String(sec.course) : true;
      })
    : subjects;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (Number(form.passing_marks) > Number(form.total_marks)) {
      setFormError('Passing marks cannot exceed total marks.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/exams/create/', form);
      setForm({ name: '', exam_type: 'other', class_section: '', subject: '', date: '', total_marks: '', passing_marks: '' });
      setShowForm(false);
      fetchExams();
    } catch (err) {
      const d = err.response?.data;
      setFormError(d ? Object.values(d).flat().join(' ') : 'Failed to create exam.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>&larr; Dashboard</button>
        <h2 style={styles.title}>Exams</h2>
        {canManage && (
          <button onClick={() => setShowForm(!showForm)} style={styles.addBtn}>
            {showForm ? 'Cancel' : '+ Create Exam'}
          </button>
        )}
      </div>

      {/* Create Exam Form */}
      {showForm && (
        <div style={styles.formCard}>
          <h3 style={styles.formTitle}>New Exam</h3>
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.row}>
              <Field label="Exam Name *">
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Mid-Term Math" style={styles.input} />
              </Field>
              <Field label="Type *">
                <select value={form.exam_type} onChange={e => setForm({ ...form, exam_type: e.target.value })} style={styles.input}>
                  <option value="quiz">Quiz</option>
                  <option value="midterm">Mid-Term</option>
                  <option value="final">Final</option>
                  <option value="assignment">Assignment</option>
                  <option value="other">Other</option>
                </select>
              </Field>
            </div>
            <div style={styles.row}>
              <Field label="Class Section *">
                <select value={form.class_section} onChange={e => setForm({ ...form, class_section: e.target.value, subject: '' })} required style={styles.input}>
                  <option value="">-- Select section --</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.course_name} — {s.name} ({s.academic_year})</option>)}
                </select>
              </Field>
              <Field label="Subject *">
                <select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required style={styles.input}>
                  <option value="">-- Select subject --</option>
                  {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </div>
            <div style={styles.row}>
              <Field label="Date *">
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required style={styles.input} />
              </Field>
              <Field label="Total Marks *">
                <input type="number" min="1" value={form.total_marks} onChange={e => setForm({ ...form, total_marks: e.target.value })} required placeholder="e.g. 100" style={styles.input} />
              </Field>
              <Field label="Passing Marks *">
                <input type="number" min="1" value={form.passing_marks} onChange={e => setForm({ ...form, passing_marks: e.target.value })} required placeholder="e.g. 50" style={styles.input} />
              </Field>
            </div>
            {formError && <p style={styles.err}>{formError}</p>}
            <button type="submit" disabled={saving} style={styles.submitBtn}>
              {saving ? 'Creating...' : 'Create Exam'}
            </button>
          </form>
        </div>
      )}

      {/* Filter */}
      <div style={styles.filterRow}>
        <select value={filterSection} onChange={e => setFilter(e.target.value)} style={styles.filterSelect}>
          <option value="">All Sections</option>
          {sections.map(s => <option key={s.id} value={s.id}>{s.course_name} — {s.name}</option>)}
        </select>
      </div>

      {/* Exam cards */}
      {loading ? <p style={styles.hint}>Loading...</p>
        : exams.length === 0 ? <p style={styles.hint}>No exams found.</p>
        : (
          <div style={styles.grid}>
            {exams.map(exam => {
              const tc = EXAM_TYPE_COLORS[exam.exam_type] || EXAM_TYPE_COLORS.other;
              return (
                <div key={exam.id} style={styles.card} onClick={() => navigate(`/exams/${exam.id}`)}>
                  <div style={styles.cardTop}>
                    <span style={{ ...styles.typeBadge, ...tc }}>{exam.exam_type}</span>
                    <span style={styles.date}>{exam.date}</span>
                  </div>
                  <h3 style={styles.examName}>{exam.name}</h3>
                  <p style={styles.examMeta}>{exam.class_section_name}</p>
                  <p style={styles.examSubject}>{exam.subject_name}</p>
                  <div style={styles.marksRow}>
                    <span style={styles.marksLabel}>Total: <strong>{exam.total_marks}</strong></span>
                    <span style={styles.marksLabel}>Pass: <strong>{exam.passing_marks}</strong></span>
                    <span style={styles.resultCount}>{exam.result_count} results</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>{label}</label>
      {children}
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#f0f2f5', padding: '24px' },
  header: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' },
  backBtn: { padding: '8px 14px', background: '#fff', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  title: { margin: 0, fontSize: '22px', color: '#1a1a2e', flex: 1 },
  addBtn: { padding: '10px 18px', background: '#744210', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' },
  formCard: { background: '#fff', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: '24px' },
  formTitle: { margin: '0 0 16px 0', fontSize: '16px' },
  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  row: { display: 'flex', gap: '16px', flexWrap: 'wrap' },
  input: { padding: '9px 12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' },
  err: { color: '#e53e3e', fontSize: '13px', margin: 0 },
  submitBtn: { padding: '10px 24px', background: '#744210', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', alignSelf: 'flex-start' },
  filterRow: { marginBottom: '20px' },
  filterSelect: { padding: '9px 14px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', minWidth: '240px' },
  hint: { color: '#888', fontSize: '14px' },
  grid: { display: 'flex', flexWrap: 'wrap', gap: '20px' },
  card: { background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', width: '260px', cursor: 'pointer', borderTop: '4px solid #744210' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  typeBadge: { padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' },
  date: { fontSize: '12px', color: '#718096' },
  examName: { margin: '0 0 4px 0', fontSize: '16px', color: '#1a1a2e' },
  examMeta: { margin: '0 0 2px 0', fontSize: '12px', color: '#718096' },
  examSubject: { margin: '0 0 12px 0', fontSize: '13px', fontWeight: '600', color: '#4a5568' },
  marksRow: { display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid #f0f0f0', paddingTop: '10px' },
  marksLabel: { fontSize: '12px', color: '#718096' },
  resultCount: { marginLeft: 'auto', background: '#f7fafc', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', color: '#4a5568' },
};
