import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const AVATAR_COLORS = ['#6366f1','#0891b2','#059669','#d97706','#db2777','#7c3aed','#dc2626','#0284c7'];
function avatarColor(name) { return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]; }
function initials(name) { return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2); }
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

const DOC_TYPES = [
  { value: 'admission_form',   label: 'Admission Form' },
  { value: 'birth_certificate',label: 'Birth Certificate' },
  { value: 'transfer_cert',    label: 'Transfer Certificate' },
  { value: 'id_card',          label: 'ID Card / CNIC' },
  { value: 'photo',            label: 'Passport Photo' },
  { value: 'other',            label: 'Other' },
];
const DOC_ICONS = { admission_form: '📋', birth_certificate: '📜', transfer_cert: '🏫', id_card: '🪪', photo: '🖼️', other: '📄' };

const LEAVING_REASONS = [
  { value: 'passout',     label: 'Passed Out',   icon: '🎓' },
  { value: 'left',        label: 'Left School',  icon: '🚶' },
  { value: 'expelled',    label: 'Expelled',     icon: '🚫' },
  { value: 'transferred', label: 'Transferred',  icon: '🔄' },
  { value: 'other',       label: 'Other',        icon: '📝' },
];

export default function StudentDetailPage() {
  const { id }    = useParams();
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const isSuperAdmin = user?.is_superuser || user?.role === 'super_admin';
  const canManage  = isSuperAdmin || ['school_admin', 'principal'].includes(user?.role);
  const isTeacher  = user?.role === 'teacher';

  const [student,  setStudent]  = useState(null);
  const [sections, setSections] = useState([]);
  const [parents,  setParents]  = useState([]);
  const [sessions, setSessions] = useState([]);
  const [courses,  setCourses]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [form,     setForm]     = useState({});
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'docs'
  const [transportSaving,   setTransportSaving]   = useState(false);
  const [transportMsg,      setTransportMsg]      = useState('');
  const [transportFeeInput, setTransportFeeInput] = useState('');
  const [suggestedFee,      setSuggestedFee]      = useState(0);
  const [showFeeInput,      setShowFeeInput]      = useState(false);
  const [slcSaving,       setSlcSaving]       = useState(false);
  const [slcMsg,          setSlcMsg]          = useState('');

  // Deactivate modal
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateForm, setDeactivateForm] = useState({ leaving_reason: '', leaving_note: '', leaving_date: '' });
  const [deactivateErr,  setDeactivateErr]  = useState('');
  const [deactivating,   setDeactivating]   = useState(false);

  // Re-admit modal
  const [readmitOpen,   setReadmitOpen]   = useState(false);
  const [readmitForm,   setReadmitForm]   = useState({ session: '', course: '', class_section: '' });
  const [readmitErrors, setReadmitErrors] = useState({});
  const [readmitting,   setReadmitting]   = useState(false);

  const [docs,      setDocs]      = useState([]);
  const [docForm,   setDocForm]   = useState({ title: '', doc_type: 'other', note: '' });
  const [docFile,   setDocFile]   = useState(null);
  const [docSaving, setDocSaving] = useState(false);
  const [docError,  setDocError]  = useState('');
  const docFileRef = useRef();

  const [attendance,        setAttendance]        = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  useEffect(() => {
    api.get(`/students/${id}/`).then(r => {
      setStudent(r.data);
      setForm(r.data);
    }).finally(() => setLoading(false));

    if (canManage) {
      api.get('/courses/sections/').then(r => setSections(r.data));
      api.get('/students/parents/').then(r => setParents(r.data));
      api.get(`/students/${id}/documents/`).then(r => setDocs(r.data)).catch(() => {});
      api.get('/courses/sessions/').then(r => setSessions(r.data));
      api.get('/courses/').then(r => setCourses(r.data));
    }
  }, [id]);

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const res = await api.put(`/students/${id}/`, {
        first_name:    form.first_name,
        middle_name:   form.middle_name,
        last_name:     form.last_name,
        cnic:          form.cnic,
        phone_number:  form.phone_number,
        address:       form.address,
        gender:        form.gender,
        date_of_birth: form.date_of_birth,
        blood_group:   form.blood_group,
        // Father
        father_name:   form.father_name,
        father_cnic:   form.father_cnic,
        father_phone:  form.father_phone,
        // Mother
        mother_name:   form.mother_name,
        mother_cnic:   form.mother_cnic,
        mother_phone:  form.mother_phone,
        // Guardian
        guardian_name:     form.guardian_name,
        guardian_relation: form.guardian_relation,
        guardian_phone:    form.guardian_phone,
        // Emergency
        emergency_contact_name:  form.emergency_contact_name,
        emergency_contact_phone: form.emergency_contact_phone,
        // Academic background
        admission_type:  form.admission_type,
        previous_school: form.previous_school,
        previous_class:  form.previous_class,
      });
      setStudent(res.data);
      setEditing(false);
    } catch { setError('Failed to save changes.'); }
    finally  { setSaving(false); }
  };

  const handleDeactivate = async () => {
    if (!deactivateForm.leaving_reason) { setDeactivateErr('Please select a reason.'); return; }
    setDeactivating(true);
    try {
      const res = await api.post(`/students/${id}/deactivate/`, deactivateForm);
      setStudent(res.data);
      setDeactivateOpen(false);
    } catch (err) {
      setDeactivateErr(err.response?.data?.leaving_reason || err.response?.data?.error || 'Failed to deactivate.');
    } finally { setDeactivating(false); }
  };

  const handleReadmit = async () => {
    const errs = {};
    if (!readmitForm.session) errs.session = 'Select an academic session.';
    if (!readmitForm.course)  errs.course  = 'Select a class.';
    if (Object.keys(errs).length) { setReadmitErrors(errs); return; }
    setReadmitting(true);
    try {
      const res = await api.post(`/students/${id}/readmit/`, readmitForm);
      setStudent(res.data);
      setReadmitOpen(false);
    } catch (err) {
      setReadmitErrors({ general: err.response?.data?.error || 'Failed to re-admit student.' });
    } finally { setReadmitting(false); }
  };

  const handleSlc = async (newStatus) => {
    setSlcSaving(true); setSlcMsg('');
    try {
      const res = await api.patch(`/students/${id}/slc/`, { slc_status: newStatus });
      setStudent(res.data);
      setSlcMsg(newStatus === 'submitted' ? 'SLC marked as submitted.' : 'SLC marked as pending.');
    } catch {
      setSlcMsg('Failed to update SLC status. Please try again.');
    } finally { setSlcSaving(false); }
  };

  const [sectionSaving, setSectionSaving] = useState(false);
  const [sectionMsg,    setSectionMsg]    = useState('');
  const [selectedSection, setSelectedSection] = useState('');

  const handleChangeSection = async () => {
    setSectionSaving(true); setSectionMsg('');
    try {
      const res = await api.patch(`/students/${id}/section/`, {
        class_section: selectedSection || null,
      });
      setStudent(res.data);
      setSelectedSection('');
      setSectionMsg('Class section updated.');
    } catch (err) {
      setSectionMsg(err.response?.data?.class_section || err.response?.data?.error || 'Failed to update section.');
    } finally { setSectionSaving(false); }
  };

  const fetchTransportInfo = async () => {
    try {
      const res = await api.get(`/students/${id}/transport/`);
      setSuggestedFee(res.data.suggested_fee || 0);
      setTransportFeeInput(String(res.data.suggested_fee || ''));
    } catch {}
  };

  const handleEnableTransport = async () => {
    setTransportSaving(true); setTransportMsg('');
    try {
      const res = await api.patch(`/students/${id}/transport/`, {
        transport_required: true,
        transport_fee: parseFloat(transportFeeInput) || 0,
      });
      setStudent(res.data);
      setShowFeeInput(false);
      setTransportMsg(`Transport enabled. Fee set to PKR ${parseFloat(transportFeeInput) || 0}.`);
    } catch {
      setTransportMsg('Failed to enable transport. Please try again.');
    } finally { setTransportSaving(false); }
  };

  const handleDisableTransport = async () => {
    setTransportSaving(true); setTransportMsg('');
    try {
      const res = await api.patch(`/students/${id}/transport/`, { transport_required: false, transport_fee: 0 });
      setStudent(res.data);
      setTransportMsg('Transport removed. Fee set to PKR 0.');
    } catch {
      setTransportMsg('Failed to remove transport. Please try again.');
    } finally { setTransportSaving(false); }
  };

  const handleUpload = async () => {
    if (!docForm.title || !docFile) { setDocError('Title and file are required.'); return; }
    setDocSaving(true); setDocError('');
    const fd = new FormData();
    fd.append('file', docFile);
    fd.append('title', docForm.title);
    fd.append('doc_type', docForm.doc_type);
    fd.append('note', docForm.note);
    try {
      const res = await api.post(`/students/${id}/documents/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setDocs(prev => [res.data, ...prev]);
      setDocForm({ title: '', doc_type: 'other', note: '' });
      setDocFile(null);
      if (docFileRef.current) docFileRef.current.value = '';
    } catch (err) { setDocError(err.response?.data?.error || 'Upload failed.'); }
    finally { setDocSaving(false); }
  };

  const handleDeleteDoc = async (docId) => {
    await api.delete(`/students/${id}/documents/${docId}/`);
    setDocs(prev => prev.filter(d => d.id !== docId));
  };

  if (loading) return (
    <div style={s.page}>
      <div style={s.centerMsg}><Spinner size={28} color="#6366f1" /><span style={{ color: '#94a3b8', marginLeft: 10 }}>Loading student…</span></div>
    </div>
  );
  if (!student) return (
    <div style={s.page}>
      <div style={s.centerMsg}><p style={{ color: '#94a3b8' }}>Student not found.</p></div>
    </div>
  );

  const color = avatarColor(student.full_name);

  return (
    <div style={s.page}>

      {/* ── Back ── */}
      <button style={s.backBtn} onClick={() => navigate('/students')}>
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Students
      </button>

      {/* ── Profile Hero ── */}
      <div style={s.hero}>
        <div style={{ ...s.heroAvatar, background: color }}>{initials(student.full_name)}</div>
        <div style={s.heroInfo}>
          <h1 style={s.heroName}>{student.full_name}</h1>
          <div style={s.heroBadges}>
            <span style={s.admBadge}><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg> {student.admission_number}</span>
            {student.current_enrollment?.course_name && (
              <span style={s.classBadge}>🏫 {student.current_enrollment.course_name}{student.current_enrollment.section_name ? ` — ${student.current_enrollment.section_name}` : ''}</span>
            )}
            <span style={{ ...s.statusBadge, ...(student.is_active ? s.statusActive : s.statusInactive) }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block', marginRight: 4 }} />
              {student.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div style={s.heroMeta}>
            {student.email && <span style={s.metaItem}>✉ {student.email}</span>}
            {student.phone_number && <span style={s.metaItem}>📞 {student.phone_number}</span>}
            {student.gender && <span style={s.metaItem}>{student.gender === 'male' ? '👦' : student.gender === 'female' ? '👧' : '🧑'} {capitalize(student.gender)}</span>}
            {student.enrollment_date && <span style={s.metaItem}>📅 Enrolled {student.enrollment_date}</span>}
          </div>
        </div>
        {canManage && !editing && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <button style={s.editBtn} onClick={() => setEditing(true)}>
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Profile
            </button>
            {student.is_active ? (
              <button style={s.deactivateHeroBtn} onClick={() => { setDeactivateForm({ leaving_reason: '', leaving_note: '', leaving_date: '' }); setDeactivateErr(''); setDeactivateOpen(true); }}>
                🚫 Deactivate
              </button>
            ) : (
              <button style={s.readmitHeroBtn} onClick={() => { setReadmitForm({ session: '', course: '', class_section: '' }); setReadmitErrors({}); setReadmitOpen(true); }}>
                ↩ Re-admit
              </button>
            )}
          </div>
        )}
        {editing && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? <><Spinner color="#fff" /> Saving…</> : '✓ Save'}
            </button>
            <button style={s.cancelBtn} onClick={() => { setEditing(false); setForm(student); setError(''); }}>Cancel</button>
          </div>
        )}
      </div>

      {error && <div style={s.errorBox}>{error}</div>}

      {/* ── Tabs ── */}
      <div style={s.tabs}>
        {[
          { key: 'info',       label: 'Student Info',  icon: '👤' },
          { key: 'attendance', label: 'Attendance',     icon: '✅' },
          ...(!isTeacher ? [{ key: 'docs', label: `Documents (${docs.length})`, icon: '📁' }] : []),
        ].map(tab => (
          <button
            key={tab.key}
            style={{ ...s.tab, ...(activeTab === tab.key ? s.tabActive : {}) }}
            onClick={() => {
              setActiveTab(tab.key);
              if (tab.key === 'attendance' && !attendance && !attendanceLoading) {
                setAttendanceLoading(true);
                api.get(`/attendance/student/${id}/`)
                  .then(r => setAttendance(r.data))
                  .catch(() => setAttendance(null))
                  .finally(() => setAttendanceLoading(false));
              }
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Info ── */}
      {activeTab === 'info' && (
        <div style={s.infoGrid}>

          {/* Academic Placement */}
          {(() => {
            const enr = student.current_enrollment;
            const className = enr
              ? enr.course_name + (enr.section_name ? ` — ${enr.section_name}` : '')
              : null;
            return (
              <InfoCard icon={<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/></svg>} iconBg="#eff6ff" title="Academic Placement" sub="Current session class and roll number">
                <DetailRow label="Student ID"><code style={s.codeVal}>{student.student_id}</code></DetailRow>
                <DetailRow label="Admission No."><code style={s.codeVal}>{student.admission_number}</code></DetailRow>
                <DetailRow label="Session">
                  {enr?.session_name
                    ? <span style={s.classBadge}>📅 {enr.session_name}</span>
                    : <span style={s.nullVal}>Not enrolled</span>}
                </DetailRow>
                <DetailRow label="Class">
                  {className
                    ? <span style={s.classBadge}>🏫 {className}</span>
                    : <span style={s.nullVal}>Not assigned</span>}
                </DetailRow>
                {editing && canManage && enr && (
                  <DetailRow label="Change Section">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                      <select style={s.inlineSelect} value={selectedSection}
                        onChange={e => { setSelectedSection(e.target.value); setSectionMsg(''); }}>
                        <option value="">— Keep current —</option>
                        {sections
                          .filter(sec => sec.course === enr.course)
                          .map(sec => (
                            <option key={sec.id} value={sec.id}>
                              {sec.course_name}{sec.name ? ` — Section ${sec.name}` : ''}{sec.session_name ? ` (${sec.session_name})` : ''}
                            </option>
                          ))}
                      </select>
                      {selectedSection && (
                        <button
                          style={{ padding: '6px 12px', background: '#0891b2', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-end' }}
                          onClick={handleChangeSection} disabled={sectionSaving}>
                          {sectionSaving ? 'Saving…' : 'Apply'}
                        </button>
                      )}
                      {sectionMsg && (
                        <span style={{ fontSize: 12, color: sectionMsg.includes('updated') ? '#059669' : '#dc2626' }}>{sectionMsg}</span>
                      )}
                    </div>
                  </DetailRow>
                )}
                <DetailRow label="Roll No.">
                  {enr?.roll_number
                    ? <code style={{ ...s.codeVal, background: '#f0fdf4', color: '#15803d' }}>{enr.roll_number}</code>
                    : <span style={s.nullVal}>—</span>}
                </DetailRow>
                <DetailRow label="Enrollment Date">{student.enrollment_date || <span style={s.nullVal}>—</span>}</DetailRow>
                {!editing && (
                  <DetailRow label="Status">
                    <span style={{ ...s.statusBadge, ...(student.is_active ? s.statusActive : s.statusInactive) }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block', marginRight: 4 }} />
                      {student.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </DetailRow>
                )}
              </InfoCard>
            );
          })()}

          {/* Personal Info */}
          <InfoCard icon={<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#db2777" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>} iconBg="#fdf2f8" title="Personal Info" sub="Identity and contact details">
            <DetailRow label="Date of Birth">
              {editing
                ? <input type="date" style={s.inlineInput} value={form.date_of_birth || ''} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} />
                : student.date_of_birth || <span style={s.nullVal}>—</span>}
            </DetailRow>
            <DetailRow label="Gender">
              {editing ? (
                <select style={s.inlineSelect} value={form.gender || ''} onChange={e => setForm({ ...form, gender: e.target.value })}>
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              ) : student.gender
                  ? <span>{student.gender === 'male' ? '👦' : student.gender === 'female' ? '👧' : '🧑'} {capitalize(student.gender)}</span>
                  : <span style={s.nullVal}>—</span>}
            </DetailRow>
            <DetailRow label="Blood Group">
              {editing ? (
                <select style={s.inlineSelect} value={form.blood_group || ''} onChange={e => setForm({ ...form, blood_group: e.target.value })}>
                  <option value="">—</option>
                  {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              ) : student.blood_group
                  ? <span style={s.bloodBadge}>🩸 {student.blood_group}</span>
                  : <span style={s.nullVal}>—</span>}
            </DetailRow>
            <DetailRow label="CNIC / B-Form">
              {editing
                ? <input style={s.inlineInput} value={form.cnic || ''} onChange={e => setForm({ ...form, cnic: e.target.value })} placeholder="12345-1234567-1" />
                : student.cnic || <span style={s.nullVal}>—</span>}
            </DetailRow>
            <DetailRow label="Phone Number">
              {editing
                ? <input style={s.inlineInput} value={form.phone_number || ''} onChange={e => setForm({ ...form, phone_number: e.target.value })} placeholder="+92…" />
                : student.phone_number || <span style={s.nullVal}>—</span>}
            </DetailRow>
            <DetailRow label="Address">
              {editing
                ? <textarea style={{ ...s.inlineInput, resize: 'vertical', height: 60 }} value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Home address" />
                : student.address || <span style={s.nullVal}>—</span>}
            </DetailRow>
            <DetailRow label="Username"><code style={s.codeVal}>{student.username}</code></DetailRow>
            <DetailRow label="First Name">
              {editing
                ? <input style={s.inlineInput} value={form.first_name || ''} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder="First name" />
                : student.full_name?.split(' ')[0] || <span style={s.nullVal}>—</span>}
            </DetailRow>
            <DetailRow label="Middle Name">
              {editing
                ? <input style={s.inlineInput} value={form.middle_name || ''} onChange={e => setForm({ ...form, middle_name: e.target.value })} placeholder="Middle name (optional)" />
                : student.middle_name || <span style={s.nullVal}>—</span>}
            </DetailRow>
            <DetailRow label="Last Name">
              {editing
                ? <input style={s.inlineInput} value={form.last_name || ''} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder="Last name" />
                : student.full_name?.split(' ').slice(-1)[0] || <span style={s.nullVal}>—</span>}
            </DetailRow>
          </InfoCard>

          {/* Father Info */}
          <InfoCard icon={<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#0891b2" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>} iconBg="#ecfeff" title="Father Information" sub="Father's contact and identification">
            <DetailRow label="Father Name">
              {editing ? <input style={s.inlineInput} value={form.father_name || ''} onChange={e => setForm({ ...form, father_name: e.target.value })} placeholder="Father's full name" />
                : student.father_name || <span style={s.nullVal}>—</span>}
            </DetailRow>
            <DetailRow label="Father CNIC">
              {editing ? <input style={s.inlineInput} value={form.father_cnic || ''} onChange={e => setForm({ ...form, father_cnic: e.target.value })} placeholder="XXXXX-XXXXXXX-X" />
                : student.father_cnic || <span style={s.nullVal}>—</span>}
            </DetailRow>
            <DetailRow label="Father Phone">
              {editing ? <input style={s.inlineInput} value={form.father_phone || ''} onChange={e => setForm({ ...form, father_phone: e.target.value })} placeholder="+92…" />
                : student.father_phone || <span style={s.nullVal}>—</span>}
            </DetailRow>
          </InfoCard>

          {/* Mother Info */}
          <InfoCard icon={<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#7c3aed" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>} iconBg="#f5f3ff" title="Mother Information" sub="Mother's contact and identification">
            <DetailRow label="Mother Name">
              {editing ? <input style={s.inlineInput} value={form.mother_name || ''} onChange={e => setForm({ ...form, mother_name: e.target.value })} placeholder="Mother's full name" />
                : student.mother_name || <span style={s.nullVal}>—</span>}
            </DetailRow>
            <DetailRow label="Mother CNIC">
              {editing ? <input style={s.inlineInput} value={form.mother_cnic || ''} onChange={e => setForm({ ...form, mother_cnic: e.target.value })} placeholder="XXXXX-XXXXXXX-X" />
                : student.mother_cnic || <span style={s.nullVal}>—</span>}
            </DetailRow>
            <DetailRow label="Mother Phone">
              {editing ? <input style={s.inlineInput} value={form.mother_phone || ''} onChange={e => setForm({ ...form, mother_phone: e.target.value })} placeholder="+92…" />
                : student.mother_phone || <span style={s.nullVal}>—</span>}
            </DetailRow>
          </InfoCard>

          {/* Guardian Info */}
          <InfoCard icon={<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#0284c7" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>} iconBg="#e0f2fe" title="Guardian Information" sub="If different from father or mother">
            <DetailRow label="Guardian Name">
              {editing ? <input style={s.inlineInput} value={form.guardian_name || ''} onChange={e => setForm({ ...form, guardian_name: e.target.value })} placeholder="Guardian's full name" />
                : student.guardian_name || <span style={s.nullVal}>—</span>}
            </DetailRow>
            <DetailRow label="Relation">
              {editing ? <input style={s.inlineInput} value={form.guardian_relation || ''} onChange={e => setForm({ ...form, guardian_relation: e.target.value })} placeholder="e.g. Uncle, Grandparent…" />
                : student.guardian_relation || <span style={s.nullVal}>—</span>}
            </DetailRow>
            <DetailRow label="Guardian Phone">
              {editing ? <input style={s.inlineInput} value={form.guardian_phone || ''} onChange={e => setForm({ ...form, guardian_phone: e.target.value })} placeholder="+92…" />
                : student.guardian_phone || <span style={s.nullVal}>—</span>}
            </DetailRow>
          </InfoCard>

          {/* Emergency Contact */}
          <InfoCard icon={<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>} iconBg="#fef2f2" title="Emergency Contact" sub="In case of emergency">
            <DetailRow label="Contact Name">
              {editing ? <input style={s.inlineInput} value={form.emergency_contact_name || ''} onChange={e => setForm({ ...form, emergency_contact_name: e.target.value })} placeholder="Emergency contact name" />
                : student.emergency_contact_name || <span style={s.nullVal}>—</span>}
            </DetailRow>
            <DetailRow label="Contact Phone">
              {editing ? <input style={s.inlineInput} value={form.emergency_contact_phone || ''} onChange={e => setForm({ ...form, emergency_contact_phone: e.target.value })} placeholder="+92…" />
                : student.emergency_contact_phone || <span style={s.nullVal}>—</span>}
            </DetailRow>
          </InfoCard>

          {/* Academic Background */}
          <InfoCard icon={<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>} iconBg="#ecfdf5" title="Academic Background" sub="Admission details and prior schooling">
            <DetailRow label="Admission Type">
              {editing ? (
                <select style={s.inlineSelect} value={form.admission_type || 'new'} onChange={e => setForm({ ...form, admission_type: e.target.value })}>
                  <option value="new">New Admission</option>
                  <option value="transfer">Transfer</option>
                </select>
              ) : <span style={{ ...s.typeBadge, ...(student.admission_type === 'transfer' ? s.transferBadge : s.newBadge) }}>
                  {student.admission_type === 'transfer' ? '🔄 Transfer' : '✨ New Admission'}
                </span>}
            </DetailRow>

            {/* Transfer-only fields */}
            {(student.admission_type === 'transfer' || (editing && form.admission_type === 'transfer')) && (
              <>
                <DetailRow label="Previous School">
                  {editing ? <input style={s.inlineInput} value={form.previous_school || ''} onChange={e => setForm({ ...form, previous_school: e.target.value })} placeholder="Previous school name" />
                    : student.previous_school || <span style={s.nullVal}>—</span>}
                </DetailRow>
                <DetailRow label="Previous Class">
                  {editing ? <input style={s.inlineInput} value={form.previous_class || ''} onChange={e => setForm({ ...form, previous_class: e.target.value })} placeholder="e.g. Class 5" />
                    : student.previous_class || <span style={s.nullVal}>—</span>}
                </DetailRow>
                <DetailRow label="SLC Status">
                  {(() => {
                    const slc = student.slc_status;
                    const badge = slc === 'submitted'
                      ? { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }
                      : slc === 'pending'
                      ? { background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }
                      : { background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0' };
                    const label = slc === 'submitted' ? '✅ Submitted' : slc === 'pending' ? '⏳ Pending' : '—';
                    return <span style={{ ...s.typeBadge, ...badge }}>{label}</span>;
                  })()}
                </DetailRow>
                {student.slc_status === 'submitted' && student.slc_submitted_date && (
                  <DetailRow label="SLC Submitted On">
                    <span style={{ fontSize: 13, color: '#059669' }}>📅 {student.slc_submitted_date}</span>
                  </DetailRow>
                )}
              </>
            )}
          </InfoCard>

          {/* SLC Management — transfer students only */}
          {student.admission_type === 'transfer' && canManage && !isTeacher && (
            <InfoCard
              icon={<span style={{ fontSize: 18 }}>📄</span>}
              iconBg="#fffbeb"
              title="School Leaving Certificate (SLC)"
              sub="Track SLC submission for this transfer student"
            >
              {(() => {
                const slc = student.slc_status;
                const isSubmitted = slc === 'submitted';
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: isSubmitted ? '#f0fdf4' : '#fffbeb', border: `1.5px solid ${isSubmitted ? '#bbf7d0' : '#fde68a'}`, borderRadius: 10, padding: '14px 16px' }}>
                      <span style={{ fontSize: 28 }}>{isSubmitted ? '✅' : '⏳'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: isSubmitted ? '#166534' : '#92400e' }}>
                          {isSubmitted ? 'SLC Received' : 'SLC Not Yet Submitted'}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                          {isSubmitted
                            ? `Submitted on ${student.slc_submitted_date || '—'}`
                            : 'Remind the parent/guardian to submit the SLC from the previous school.'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {isSubmitted ? (
                        <button onClick={() => handleSlc('pending')} disabled={slcSaving}
                          style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid #fde68a', background: '#fffbeb', color: '#92400e', fontSize: 13, fontWeight: 600, cursor: slcSaving ? 'not-allowed' : 'pointer', opacity: slcSaving ? 0.6 : 1 }}>
                          {slcSaving ? 'Saving…' : '⏳ Mark as Pending'}
                        </button>
                      ) : (
                        <button onClick={() => handleSlc('submitted')} disabled={slcSaving}
                          style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid #bbf7d0', background: '#f0fdf4', color: '#166534', fontSize: 13, fontWeight: 600, cursor: slcSaving ? 'not-allowed' : 'pointer', opacity: slcSaving ? 0.6 : 1 }}>
                          {slcSaving ? 'Saving…' : '✅ Mark as Submitted'}
                        </button>
                      )}
                      {slcMsg && (
                        <span style={{ fontSize: 12, color: slcMsg.includes('Failed') ? '#dc2626' : '#059669', fontWeight: 500 }}>
                          {slcMsg}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </InfoCard>
          )}

          {/* Transport Management */}
          {student.current_enrollment && !isTeacher && (
            <InfoCard
              icon={<span style={{ fontSize: 18 }}>🚌</span>}
              iconBg="#ecfeff"
              title="Transport"
              sub="Manage school transport for the current enrollment"
            >
              {(() => {
                const active = student.current_enrollment.transport_required;
                const currentFee = student.fee_package ? parseFloat(student.fee_package.transport_fee) : 0;
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Status banner */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: active ? '#ecfeff' : '#f8fafc', border: `1.5px solid ${active ? '#a5f3fc' : '#e2e8f0'}`, borderRadius: 10, padding: '14px 16px' }}>
                      <span style={{ fontSize: 28 }}>{active ? '🚌' : '🚶'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: active ? '#0891b2' : '#64748b' }}>
                          {active ? 'Transport Currently Active' : 'Transport Not Enrolled'}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                          {active
                            ? `Monthly fee: PKR ${currentFee.toLocaleString()}`
                            : 'This student is not using school transport this session.'}
                        </div>
                      </div>
                      <span style={{ ...s.typeBadge, ...(active ? s.transportYes : s.transportNo) }}>
                        {active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Actions */}
                    {canManage && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {active ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button
                              onClick={handleDisableTransport}
                              disabled={transportSaving}
                              style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid #fca5a5', background: '#fff', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: transportSaving ? 'not-allowed' : 'pointer', opacity: transportSaving ? 0.6 : 1 }}
                            >
                              {transportSaving ? 'Saving…' : '✕ Remove Transport'}
                            </button>
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>Fee will be set to PKR 0</span>
                          </div>
                        ) : (
                          <>
                            {!showFeeInput ? (
                              <button
                                onClick={() => { fetchTransportInfo(); setShowFeeInput(true); setTransportMsg(''); }}
                                style={{ alignSelf: 'flex-start', padding: '9px 18px', borderRadius: 8, border: '1.5px solid #a5f3fc', background: '#ecfeff', color: '#0891b2', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                              >
                                🚌 Enable Transport
                              </button>
                            ) : (
                              <div style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#0369a1' }}>Set Monthly Transport Fee</div>
                                {suggestedFee > 0 && (
                                  <div style={{ fontSize: 12, color: '#64748b' }}>
                                    💡 Suggested from class fee structure: <strong>PKR {suggestedFee.toLocaleString()}</strong>
                                  </div>
                                )}
                                {suggestedFee === 0 && (
                                  <div style={{ fontSize: 12, color: '#f59e0b' }}>
                                    ⚠ No class fee structure found. Enter the transport fee manually.
                                  </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>PKR</span>
                                  <input
                                    type="number" min="0"
                                    value={transportFeeInput}
                                    onChange={e => setTransportFeeInput(e.target.value)}
                                    placeholder="e.g. 800"
                                    style={{ width: 120, padding: '8px 10px', borderRadius: 7, border: '1.5px solid #bae6fd', fontSize: 14, fontWeight: 600, outline: 'none' }}
                                  />
                                  <span style={{ fontSize: 12, color: '#94a3b8' }}>/ month</span>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button
                                    onClick={handleEnableTransport}
                                    disabled={transportSaving}
                                    style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: '#0891b2', color: '#fff', fontSize: 13, fontWeight: 600, cursor: transportSaving ? 'not-allowed' : 'pointer', opacity: transportSaving ? 0.6 : 1 }}
                                  >
                                    {transportSaving ? 'Saving…' : '✓ Confirm & Enable'}
                                  </button>
                                  <button
                                    onClick={() => { setShowFeeInput(false); setTransportMsg(''); }}
                                    style={{ padding: '9px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        {transportMsg && (
                          <span style={{ fontSize: 12, color: transportMsg.includes('Failed') ? '#dc2626' : '#059669', fontWeight: 500 }}>
                            {transportMsg}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </InfoCard>
          )}

          {/* Fee Package */}
          {student.fee_package && !isTeacher && (
            <InfoCard
              icon={<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
              iconBg="#ecfdf5" title="Fee Structure" sub="Monthly and one-time fees at enrollment"
            >
              {/* Summary row */}
              <div style={{ display: 'flex', gap: 0, background: 'linear-gradient(135deg,#f0fdf4,#eff6ff)', borderRadius: 10, margin: '12px 0', overflow: 'hidden' }}>
                {[
                  { label: 'Monthly', value: `PKR ${parseFloat(student.fee_package.total_monthly).toLocaleString()}`, color: '#3b82f6' },
                  { label: 'One-Time', value: `PKR ${parseFloat(student.fee_package.total_onetime).toLocaleString()}`, color: '#059669' },
                  { label: 'Annual Est.', value: `PKR ${(parseFloat(student.fee_package.total_monthly) * 12 + parseFloat(student.fee_package.total_onetime)).toLocaleString()}`, color: '#7c3aed' },
                ].map((item, i) => (
                  <div key={item.label} style={{ flex: 1, padding: '12px 14px', borderLeft: i > 0 ? '1px solid #e2e8f0' : 'none' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: item.color, marginTop: 3 }}>{item.value}</div>
                  </div>
                ))}
              </div>
              {/* Breakdown */}
              {[
                { label: 'Tuition Fee',      value: student.fee_package.tuition_fee,      badge: '🔁 Monthly' },
                { label: 'Transport Fee',    value: student.fee_package.transport_fee,    badge: '🔁 Monthly' },
                { label: 'Registration Fee', value: student.fee_package.registration_fee, badge: '1️⃣ One-Time' },
                { label: 'Books Fee',        value: student.fee_package.books_fee,        badge: '1️⃣ One-Time' },
                { label: 'Exam Fee',         value: student.fee_package.exam_fee,         badge: '1️⃣ One-Time' },
              ].filter(r => parseFloat(r.value) > 0).map(r => (
                <DetailRow key={r.label} label={r.label}>
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>PKR {parseFloat(r.value).toLocaleString()}</span>
                  <span style={{ marginLeft: 8, fontSize: 11, color: '#94a3b8' }}>{r.badge}</span>
                </DetailRow>
              ))}
              {student.fee_package.note && (
                <DetailRow label="Note">
                  <span style={{ color: '#64748b', fontStyle: 'italic' }}>{student.fee_package.note}</span>
                </DetailRow>
              )}
            </InfoCard>
          )}

        </div>
      )}

      {/* ── Tab: Documents ── */}
      {activeTab === 'docs' && canManage && (
        <div style={s.docsCard}>
          <div style={s.cardHeader}>
            <div style={{ ...s.cardIconBox, background: '#fffbeb' }}>
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#d97706" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 style={s.cardTitle}>Student Documents</h3>
              <p style={s.cardSub}>Upload and manage official documents</p>
            </div>
          </div>

          {/* Upload section */}
          <div style={s.uploadSection}>
            <h4 style={s.uploadTitle}>Upload New Document</h4>
            <div style={s.uploadGrid}>
              <div style={s.uploadField}>
                <label style={s.uploadLabel}>Title *</label>
                <input style={s.uploadInput} value={docForm.title} onChange={e => setDocForm({ ...docForm, title: e.target.value })} placeholder="e.g. Birth Certificate" />
              </div>
              <div style={s.uploadField}>
                <label style={s.uploadLabel}>Document Type</label>
                <select style={s.uploadInput} value={docForm.doc_type} onChange={e => setDocForm({ ...docForm, doc_type: e.target.value })}>
                  {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div style={s.uploadField}>
                <label style={s.uploadLabel}>Note (optional)</label>
                <input style={s.uploadInput} value={docForm.note} onChange={e => setDocForm({ ...docForm, note: e.target.value })} placeholder="Any remarks…" />
              </div>
              <div style={s.uploadField}>
                <label style={s.uploadLabel}>File *</label>
                <input ref={docFileRef} type="file" style={{ display: 'none' }} onChange={e => setDocFile(e.target.files[0])} />
                <button style={s.filePickBtn} onClick={() => docFileRef.current.click()}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  {docFile ? docFile.name.slice(0, 22) + (docFile.name.length > 22 ? '…' : '') : 'Choose file'}
                </button>
              </div>
            </div>
            {docError && <p style={s.docErr}>{docError}</p>}
            <button style={s.uploadBtn} onClick={handleUpload} disabled={docSaving}>
              {docSaving
                ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Spinner color="#fff" /> Uploading…</span>
                : '⬆ Upload Document'}
            </button>
          </div>

          {/* Document list */}
          <div style={s.docList}>
            {docs.length === 0 ? (
              <div style={s.docEmpty}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>📂</div>
                <p style={{ color: '#94a3b8', margin: 0 }}>No documents uploaded yet.</p>
              </div>
            ) : docs.map(doc => (
              <div key={doc.id} style={s.docItem}>
                <div style={s.docIconBox}>{DOC_ICONS[doc.doc_type] || '📄'}</div>
                <div style={s.docInfo}>
                  <div style={s.docTitle}>{doc.title}</div>
                  <div style={s.docMeta}>
                    <span style={s.docType}>{DOC_TYPES.find(t => t.value === doc.doc_type)?.label || doc.doc_type}</span>
                    <span>·</span>
                    <span>{doc.uploaded_at}</span>
                    <span>·</span>
                    <span>by {doc.uploaded_by}</span>
                    {doc.note && <><span>·</span><span>{doc.note}</span></>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a href={doc.file} target="_blank" rel="noreferrer" style={s.viewDocBtn}>View</a>
                  <button style={s.deleteDocBtn} onClick={() => handleDeleteDoc(doc.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'docs' && !canManage && (
        <div style={s.docsCard}>
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 0' }}>You don't have permission to view documents.</p>
        </div>
      )}

      {/* ── Tab: Attendance ── */}
      {activeTab === 'attendance' && (
        <div>
          {attendanceLoading && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
              <Spinner size={24} color="#3b82f6" />
              <p style={{ marginTop: 12, fontSize: 14 }}>Loading attendance...</p>
            </div>
          )}

          {!attendanceLoading && attendance && (() => {
            const sum = attendance.summary;
            const pct = sum.percentage || 0;
            const radius = 54;
            const circ = 2 * Math.PI * radius;
            const dash = (pct / 100) * circ;
            const ringColor = pct >= 75 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';

            return (
              <>
                {/* Summary */}
                <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', padding: '24px', marginBottom: 16 }}>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
                    {/* Circle */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <svg width="140" height="140" viewBox="0 0 140 140">
                        <circle cx="70" cy="70" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="12" />
                        <circle cx="70" cy="70" r={radius} fill="none" stroke={ringColor} strokeWidth="12"
                          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                          transform="rotate(-90 70 70)" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
                        <text x="70" y="65" textAnchor="middle" fontSize="22" fontWeight="800" fill={ringColor}>{pct}%</text>
                        <text x="70" y="83" textAnchor="middle" fontSize="11" fill="#94a3b8">Attendance</text>
                      </svg>
                      <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center', lineHeight: 1.5 }}>
                        <div>Total school days: <strong>{sum.total}</strong></div>
                        <div style={{ color: '#94a3b8' }}>Leave excluded: <strong>{sum.leave || 0}</strong></div>
                      </div>
                    </div>

                    {/* Stat cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, flex: 1, minWidth: 220 }}>
                      <div style={{ background: '#dcfce7', border: '1.5px solid #86efac', borderRadius: 12, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginBottom: 4 }}>✓ PRESENT</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>{sum.present}</div>
                        <div style={{ fontSize: 11, color: '#4ade80' }}>Full day</div>
                      </div>
                      <div style={{ background: '#fee2e2', border: '1.5px solid #fca5a5', borderRadius: 12, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>✗ ABSENT</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#dc2626' }}>{sum.absent + (sum.late_absent || 0)}</div>
                        <div style={{ fontSize: 11, color: '#fca5a5' }}>incl. late &gt;2h</div>
                      </div>
                      <div style={{ background: '#fef3c7', border: '1.5px solid #fcd34d', borderRadius: 12, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', marginBottom: 4 }}>⏰ LATE</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706' }}>{sum.late || 0}</div>
                        <div style={{ fontSize: 11, color: '#fcd34d' }}>
                          {sum.late_full > 0 && `${sum.late_full} full · `}
                          {sum.late_half > 0 && `${sum.late_half} half-day`}
                          {(sum.late || 0) === 0 && '—'}
                        </div>
                      </div>
                      <div style={{ background: '#ede9fe', border: '1.5px solid #c4b5fd', borderRadius: 12, padding: '12px 14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', marginBottom: 4 }}>📋 LEAVE</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed' }}>{sum.leave || 0}</div>
                        <div style={{ fontSize: 11, color: '#c4b5fd' }}>Excused</div>
                      </div>
                    </div>
                  </div>

                  {/* Policy explanation */}
                  <div style={{ marginTop: 16, padding: '10px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6 }}>HOW PERCENTAGE IS CALCULATED</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Present',           value: '= 1 full day',     color: '#16a34a' },
                        { label: 'Late ≤ 30 min',     value: '= 1 full day',     color: '#16a34a' },
                        { label: 'Late 30–120 min',   value: '= 0.5 half day',   color: '#d97706' },
                        { label: 'Late > 2 hours',    value: '= Absent',         color: '#dc2626' },
                        { label: 'Leave (excused)',   value: '= Not counted',    color: '#7c3aed' },
                        { label: 'Absent',            value: '= 0',              color: '#dc2626' },
                      ].map(p => (
                        <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                          <span style={{ color: '#475569', fontWeight: 600 }}>{p.label}</span>
                          <span style={{ color: '#94a3b8' }}>{p.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Alerts */}
                  {pct < 75 && sum.total > 0 && (
                    <div style={{ marginTop: 12, background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                      ⚠️ Attendance below 75% — currently {pct}%. Minimum required is 75%.
                    </div>
                  )}
                  {(sum.late_half > 0 || sum.late_absent > 0) && (
                    <div style={{ marginTop: 8, background: '#fef3c7', border: '1.5px solid #fcd34d', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#92400e', fontWeight: 600 }}>
                      ⏰ {sum.late_half > 0 && `${sum.late_half} late arrival${sum.late_half > 1 ? 's' : ''} counted as half-day. `}
                      {sum.late_absent > 0 && `${sum.late_absent} late arrival${sum.late_absent > 1 ? 's' : ''} over 2 hours counted as absent.`}
                    </div>
                  )}
                </div>

                {/* Records table */}
                {attendance.records.length > 0 ? (
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'auto', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Recent Records</h3>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Last {Math.min(attendance.records.length, 30)} entries</p>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          {['Date', 'Status', 'Arrival Time', 'Note', 'Marked By'].map(h => (
                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {attendance.records.slice(0, 30).map(rec => {
                          const STATUS_STYLE = {
                            present: { icon: '✓', color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
                            absent:  { icon: '✗', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
                            late:    { icon: '⏰', color: '#d97706', bg: '#fef3c7', border: '#fcd34d' },
                            leave:   { icon: '📋', color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd' },
                          };
                          const st = STATUS_STYLE[rec.status] || {};
                          return (
                            <tr key={rec.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                              <td style={{ padding: '11px 16px', fontSize: 13, color: '#0f172a', fontWeight: 600 }}>
                                {new Date(rec.date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </td>
                              <td style={{ padding: '11px 16px' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                                  {st.icon} {capitalize(rec.status)}
                                </span>
                              </td>
                              <td style={{ padding: '11px 16px', fontSize: 13, color: rec.arrival_time ? '#d97706' : '#cbd5e1', fontWeight: rec.arrival_time ? 600 : 400 }}>
                                {rec.arrival_time ? `⏰ ${rec.arrival_time.slice(0,5)}` : '—'}
                              </td>
                              <td style={{ padding: '11px 16px', fontSize: 13, color: '#64748b' }}>
                                {rec.note || <span style={{ color: '#cbd5e1' }}>—</span>}
                              </td>
                              <td style={{ padding: '11px 16px', fontSize: 12, color: '#94a3b8' }}>
                                {rec.marked_by_name || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                    No attendance records found for this student.
                  </div>
                )}
              </>
            );
          })()}

          {!attendanceLoading && !attendance && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
              Could not load attendance data.
            </div>
          )}
        </div>
      )}

      {/* ── Deactivate Modal ── */}
      {deactivateOpen && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setDeactivateOpen(false)}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <div style={{ fontSize: 32 }}>🚫</div>
              <div>
                <div style={s.modalTitle}>Mark Student Inactive</div>
                <div style={s.modalSub}>{student.full_name} · {student.admission_number}</div>
              </div>
              <button style={s.closeBtn} onClick={() => setDeactivateOpen(false)}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={{ marginBottom: 16 }}>
                <label style={s.fieldLabel}>Reason <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {LEAVING_REASONS.map(r => {
                    const active = deactivateForm.leaving_reason === r.value;
                    return (
                      <button key={r.value} type="button"
                        onClick={() => { setDeactivateForm(f => ({ ...f, leaving_reason: r.value })); setDeactivateErr(''); }}
                        style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          background: active ? '#dc2626' : '#f8fafc', color: active ? '#fff' : '#475569',
                          border: `2px solid ${active ? '#dc2626' : '#e2e8f0'}` }}>
                        {r.icon} {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={s.fieldLabel}>Leaving Date</label>
                <input type="date" style={s.modalInput}
                  value={deactivateForm.leaving_date}
                  onChange={e => setDeactivateForm(f => ({ ...f, leaving_date: e.target.value }))} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={s.fieldLabel}>Additional Note (optional)</label>
                <textarea rows={3} style={{ ...s.modalInput, resize: 'vertical' }}
                  placeholder="e.g. Student passed final exams and graduated…"
                  value={deactivateForm.leaving_note}
                  onChange={e => setDeactivateForm(f => ({ ...f, leaving_note: e.target.value }))} />
              </div>
              {deactivateErr && <div style={s.errBox}>{deactivateErr}</div>}
            </div>
            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={() => setDeactivateOpen(false)}>Cancel</button>
              <button style={{ ...s.confirmBtn, background: '#dc2626' }} disabled={deactivating} onClick={handleDeactivate}>
                {deactivating ? 'Saving…' : 'Mark Inactive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Re-admit Modal ── */}
      {readmitOpen && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setReadmitOpen(false)}>
          <div style={s.modal}>
            <div style={{ ...s.modalHeader, background: '#f0fdf4' }}>
              <div style={{ fontSize: 32 }}>↩</div>
              <div>
                <div style={s.modalTitle}>Re-admit Student</div>
                <div style={s.modalSub}>{student.full_name} · {student.admission_number}</div>
              </div>
              <button style={s.closeBtn} onClick={() => setReadmitOpen(false)}>✕</button>
            </div>
            <div style={s.modalBody}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#1d4ed8', marginBottom: 18 }}>
                The student's existing record, admission number, and previous history will be preserved. A new enrollment will be created for the selected session.
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={s.fieldLabel}>Academic Session <span style={{ color: '#ef4444' }}>*</span></label>
                <select style={{ ...s.modalInput, marginTop: 4 }}
                  value={readmitForm.session}
                  onChange={e => setReadmitForm(f => ({ ...f, session: e.target.value, course: '', class_section: '' }))}>
                  <option value="">— Select session —</option>
                  {sessions.map(sess => (
                    <option key={sess.id} value={sess.id}>{sess.name}{sess.is_active ? ' (Current)' : ''}</option>
                  ))}
                </select>
                {readmitErrors.session && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 3 }}>{readmitErrors.session}</div>}
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={s.fieldLabel}>Class <span style={{ color: '#ef4444' }}>*</span></label>
                <select style={{ ...s.modalInput, marginTop: 4 }}
                  value={readmitForm.course}
                  onChange={e => setReadmitForm(f => ({ ...f, course: e.target.value, class_section: '' }))}>
                  <option value="">— Select class —</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {readmitErrors.course && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 3 }}>{readmitErrors.course}</div>}
              </div>
              {readmitForm.course && (
                <div style={{ marginBottom: 14 }}>
                  <label style={s.fieldLabel}>Section <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                  <select style={{ ...s.modalInput, marginTop: 4 }}
                    value={readmitForm.class_section}
                    onChange={e => setReadmitForm(f => ({ ...f, class_section: e.target.value }))}>
                    <option value="">— No section —</option>
                    {sections.filter(sec =>
                      String(sec.session) === String(readmitForm.session) &&
                      String(sec.course)  === String(readmitForm.course)
                    ).map(sec => (
                      <option key={sec.id} value={sec.id}>{sec.name ? `Section ${sec.name}` : sec.display_name}</option>
                    ))}
                  </select>
                </div>
              )}
              {readmitErrors.general && <div style={s.errBox}>{readmitErrors.general}</div>}
            </div>
            <div style={s.modalFooter}>
              <button style={s.cancelBtn} onClick={() => setReadmitOpen(false)}>Cancel</button>
              <button style={{ ...s.confirmBtn, background: '#059669' }} disabled={readmitting} onClick={handleReadmit}>
                {readmitting ? 'Processing…' : '↩ Re-admit Student'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function InfoCard({ icon, iconBg, title, sub, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{title}</h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>{sub}</p>
        </div>
      </div>
      <div style={{ padding: '0 20px 8px' }}>{children}</div>
    </div>
  );
}

function DetailRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid #f8fafc' }}>
      <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600, width: 140, flexShrink: 0, paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: 14, color: '#1e293b', flex: 1 }}>{children}</span>
    </div>
  );
}

function Spinner({ size = 13, color = '#6366f1' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeOpacity="0.25" strokeWidth="4" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

const s = {
  page:      { padding: '28px', background: '#f1f5f9', minHeight: '100%' },
  centerMsg: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 },

  backBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 9, cursor: 'pointer', fontSize: 13, color: '#475569', fontWeight: 600, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },

  // Hero
  hero: { background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '24px 28px', display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 20, flexWrap: 'wrap' },
  heroAvatar: { width: 80, height: 80, borderRadius: '50%', color: '#fff', fontWeight: 800, fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' },
  heroInfo: { flex: 1, minWidth: 200 },
  heroName: { margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: '#0f172a' },
  heroBadges: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  admBadge:  { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#f1f5f9', color: '#475569', borderRadius: 20, fontSize: 12, fontWeight: 700, border: '1px solid #e2e8f0' },
  classBadge:{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#eff6ff', color: '#3b82f6', borderRadius: 20, fontSize: 12, fontWeight: 700, border: '1px solid #bfdbfe' },
  statusBadge:    { display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  statusActive:   { background: '#dcfce7', color: '#15803d' },
  statusInactive: { background: '#fee2e2', color: '#dc2626' },
  heroMeta: { display: 'flex', gap: 14, flexWrap: 'wrap' },
  metaItem: { fontSize: 13, color: '#64748b' },

  editBtn:   { display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: '#eff6ff', color: '#3b82f6', border: '1.5px solid #bfdbfe', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 },
  deactivateHeroBtn: { padding: '9px 18px', background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 },
  readmitHeroBtn:    { padding: '9px 18px', background: '#f0fdf4', color: '#059669', border: '1.5px solid #86efac', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 },
  saveBtn:   { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: 'linear-gradient(135deg,#059669,#34d399)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  cancelBtn: { padding: '9px 16px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  errorBox:  { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 16px', borderRadius: 10, marginBottom: 16, fontSize: 13 },
  errBox:    { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 16px', borderRadius: 10, marginBottom: 16, fontSize: 13 },

  // Modals
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal:      { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' },
  modalHeader:{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#fef2f2' },
  modalTitle: { fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 },
  modalSub:   { fontSize: 13, color: '#64748b', marginTop: 2 },
  modalBody:  { padding: '20px 24px' },
  modalFooter:{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '16px 24px', borderTop: '1px solid #f1f5f9' },
  modalInput: { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' },
  fieldLabel: { fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
  confirmBtn: { padding: '9px 20px', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  closeBtn:   { marginLeft: 'auto', background: 'none', border: 'none', fontSize: 18, color: '#94a3b8', cursor: 'pointer', lineHeight: 1 },

  // Tabs
  tabs:      { display: 'flex', gap: 4, marginBottom: 20, background: '#fff', borderRadius: 12, padding: 5, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', width: 'fit-content' },
  tab:       { padding: '9px 18px', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none', color: '#64748b', transition: 'all 0.15s' },
  tabActive: { background: 'linear-gradient(135deg,#1e40af,#3b82f6)', color: '#fff', boxShadow: '0 2px 8px rgba(59,130,246,0.35)' },

  // Info grid layout
  infoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20, alignItems: 'flex-start' },

  // Cards
  docsCard: { background: '#fff', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.07)', overflow: 'hidden' },
  cardHeader: { padding: '18px 20px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 14 },
  cardIconBox:{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardTitle:  { margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' },
  cardSub:    { margin: '2px 0 0', fontSize: 12, color: '#94a3b8' },

  // Detail rows
  inlineInput:  { padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' },
  inlineSelect: { padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' },
  codeVal:      { fontFamily: 'monospace', background: '#f1f5f9', padding: '3px 10px', borderRadius: 6, fontSize: 13, color: '#475569' },
  nullVal:      { color: '#cbd5e1', fontStyle: 'italic' },
  bloodBadge:   { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  typeBadge:    { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  newBadge:     { background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' },
  transferBadge:{ background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe' },
  transportYes: { background: '#ecfeff', color: '#0891b2', border: '1px solid #a5f3fc' },
  transportNo:  { background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0' },

  // Documents
  uploadSection:{ padding: '20px', borderBottom: '1px solid #f8fafc', background: '#fafbfc' },
  uploadTitle:  { margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#374151' },
  uploadGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 12 },
  uploadField:  { display: 'flex', flexDirection: 'column', gap: 5 },
  uploadLabel:  { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' },
  uploadInput:  { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' },
  filePickBtn:  { display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', border: '1.5px dashed #94a3b8', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#fff', color: '#475569', fontFamily: 'inherit' },
  docErr:       { color: '#dc2626', fontSize: 12, margin: '0 0 8px' },
  uploadBtn:    { padding: '10px 20px', background: 'linear-gradient(135deg,#d97706,#fbbf24)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' },

  docList:  { padding: '0 4px 4px' },
  docEmpty: { padding: '48px 24px', textAlign: 'center' },
  docItem:  { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #f8fafc' },
  docIconBox:{ width: 40, height: 40, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  docInfo:  { flex: 1 },
  docTitle: { fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 3 },
  docMeta:  { display: 'flex', gap: 6, fontSize: 12, color: '#94a3b8', flexWrap: 'wrap' },
  docType:  { background: '#f1f5f9', color: '#64748b', padding: '1px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600 },
  viewDocBtn:  { padding: '6px 14px', background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe', borderRadius: 7, fontSize: 12, fontWeight: 700, textDecoration: 'none' },
  deleteDocBtn:{ padding: '6px 12px', background: '#fff', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' },
};

