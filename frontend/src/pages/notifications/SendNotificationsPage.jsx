import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const TYPE_INFO = {
  fee_reminder:       { label: 'Fee Reminder',       color: '#c53030', bg: '#fed7d7' },
  exam_alert:         { label: 'Exam Alert',          color: '#2b6cb0', bg: '#ebf8ff' },
  attendance_warning: { label: 'Attendance Warning',  color: '#92400e', bg: '#fef3c7' },
  general:            { label: 'General',             color: '#4a5568', bg: '#e2e8f0' },
};

export default function SendNotificationsPage() {
  const navigate = useNavigate();

  // Fee reminders
  const [feeDays, setFeeDays]   = useState('7');
  const [feeMsg, setFeeMsg]     = useState('');
  const [feeSending, setFeeSending] = useState(false);

  // Exam alerts
  const [examDays, setExamDays] = useState('7');
  const [examMsg, setExamMsg]   = useState('');
  const [examSending, setExamSending] = useState(false);

  // Attendance warnings
  const [threshold, setThreshold] = useState('75');
  const [attMsg, setAttMsg]       = useState('');
  const [attSending, setAttSending] = useState(false);

  // General announcement
  const [genTarget, setGenTarget] = useState('all');
  const [genTitle, setGenTitle]   = useState('');
  const [genMsg, setGenMsg]       = useState('');
  const [genBody, setGenBody]     = useState('');
  const [genSending, setGenSending] = useState(false);

  const send = async (endpoint, payload, setMsg, setSending) => {
    setSending(true);
    setMsg('');
    try {
      const res = await api.post(endpoint, payload);
      setMsg({ ok: true, text: res.data.message });
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.error || 'Failed to send.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={st.container}>
      <div style={st.header}>
        <button onClick={() => navigate('/dashboard')} style={st.backBtn}>&larr; Dashboard</button>
        <h2 style={st.title}>Send Notifications</h2>
      </div>
      <p style={st.subtitle}>
        Trigger bulk notifications — each recipient gets an in-app notification and an email.
      </p>

      <div style={st.grid}>
        {/* Fee Reminders */}
        <Panel title="Fee Reminders" color="#c53030" bg="#fed7d7" icon="💰">
          <p style={st.panelDesc}>
            Sends reminders to students with <strong>overdue</strong> fees and fees due within the specified days.
          </p>
          <Field label="Due within (days)">
            <input type="number" min="1" max="60" value={feeDays}
              onChange={e => setFeeDays(e.target.value)} style={st.input} />
          </Field>
          <StatusMsg msg={feeMsg} />
          <button onClick={() => send('/notifications/send-fee-reminders/', { days: feeDays }, setFeeMsg, setFeeSending)}
            disabled={feeSending} style={st.sendBtn}>
            {feeSending ? 'Sending…' : 'Send Fee Reminders'}
          </button>
        </Panel>

        {/* Exam Alerts */}
        <Panel title="Exam Alerts" color="#2b6cb0" bg="#ebf8ff" icon="📝">
          <p style={st.panelDesc}>
            Notifies all students in the relevant section about upcoming exams.
          </p>
          <Field label="Exams in next (days)">
            <input type="number" min="1" max="30" value={examDays}
              onChange={e => setExamDays(e.target.value)} style={st.input} />
          </Field>
          <StatusMsg msg={examMsg} />
          <button onClick={() => send('/notifications/send-exam-alerts/', { days: examDays }, setExamMsg, setExamSending)}
            disabled={examSending} style={st.sendBtn}>
            {examSending ? 'Sending…' : 'Send Exam Alerts'}
          </button>
        </Panel>

        {/* Attendance Warnings */}
        <Panel title="Attendance Warnings" color="#92400e" bg="#fef3c7" icon="⚠️">
          <p style={st.panelDesc}>
            Warns students whose attendance percentage falls below the threshold.
          </p>
          <Field label="Attendance threshold (%)">
            <input type="number" min="1" max="100" value={threshold}
              onChange={e => setThreshold(e.target.value)} style={st.input} />
          </Field>
          <StatusMsg msg={attMsg} />
          <button onClick={() => send('/notifications/send-attendance-warnings/', { threshold }, setAttMsg, setAttSending)}
            disabled={attSending} style={st.sendBtn}>
            {attSending ? 'Sending…' : 'Send Warnings'}
          </button>
        </Panel>

        {/* General Announcement */}
        <Panel title="General Announcement" color="#4a5568" bg="#e2e8f0" icon="📢">
          <p style={st.panelDesc}>
            Send a custom message to all students, all teachers, or everyone.
          </p>
          <Field label="Send to">
            <select value={genTarget} onChange={e => setGenTarget(e.target.value)} style={st.input}>
              <option value="all">Everyone (all staff &amp; students)</option>
              <option value="students">Students only</option>
              <option value="teachers">Teachers only</option>
            </select>
          </Field>
          <Field label="Title *">
            <input value={genTitle} onChange={e => setGenTitle(e.target.value)}
              placeholder="e.g. School Holiday Notice" style={st.input} />
          </Field>
          <Field label="Message *">
            <textarea value={genBody} onChange={e => setGenBody(e.target.value)}
              rows={4} placeholder="Type your announcement here…" style={{ ...st.input, resize: 'vertical' }} />
          </Field>
          <StatusMsg msg={genMsg} />
          <button
            onClick={() => {
              if (!genTitle.trim() || !genBody.trim()) {
                setGenMsg({ ok: false, text: 'Title and message are required.' });
                return;
              }
              send('/notifications/send-general/', { target: genTarget, title: genTitle, message: genBody }, setGenMsg, setGenSending);
            }}
            disabled={genSending} style={st.sendBtn}>
            {genSending ? 'Sending…' : 'Send Announcement'}
          </button>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, color, bg, icon, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
      <div style={{ background: bg, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '20px' }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color }}>{title}</h3>
      </div>
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '13px', fontWeight: '600', color: '#555' }}>{label}</label>
      {children}
    </div>
  );
}

function StatusMsg({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
      background: msg.ok ? '#c6f6d5' : '#fed7d7',
      color:      msg.ok ? '#276749' : '#c53030',
    }}>
      {msg.ok ? '✓ ' : '✗ '}{msg.text}
    </div>
  );
}

const st = {
  container:  { minHeight: '100vh', background: '#f0f2f5', padding: '24px' },
  header:     { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' },
  backBtn:    { padding: '8px 14px', background: '#fff', border: '1px solid #ddd', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' },
  title:      { margin: 0, fontSize: '22px', color: '#1a1a2e' },
  subtitle:   { margin: '0 0 24px 0', color: '#718096', fontSize: '14px' },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' },
  panelDesc:  { margin: 0, fontSize: '13px', color: '#718096' },
  input:      { padding: '9px 12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px', width: '100%', boxSizing: 'border-box' },
  sendBtn:    { padding: '10px 20px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', alignSelf: 'flex-start' },
};
