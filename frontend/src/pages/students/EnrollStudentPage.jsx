import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const emptyForm = {
  // Login account (auto-created)
  first_name: '', middle_name: '', last_name: '',
  username: '', email: '',
  // Personal
  date_of_birth: '', gender: '', blood_group: '',
  // Contact
  cnic: '', phone_number: '', address: '',
  // Father
  father_name: '', father_cnic: '', father_phone: '',
  // Mother
  mother_name: '', mother_cnic: '', mother_phone: '',
  // Guardian
  guardian_name: '', guardian_relation: '', guardian_phone: '',
  // Emergency
  emergency_contact_name: '', emergency_contact_phone: '',
  // Academic background
  admission_type: 'new', previous_school: '', previous_class: '',
  slc_status: 'pending',
  // Transport
  transport_required: false,
  // Placement
  class_enrolled: '', class_section: '', parent: '',
  // Fees
  tuition_fee: '', transport_fee: '', registration_fee: '',
  books_fee: '', exam_fee: '', fee_note: '',
};

const AVATAR_COLORS = ['#6366f1','#0891b2','#059669','#d97706','#db2777','#7c3aed','#dc2626','#0284c7'];
function avatarColor(name) { return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]; }
function initials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

const STEPS = [
  { num: '1', label: 'Student Account',    sub: 'Name, username & email',          color: '#6366f1' },
  { num: '2', label: 'Personal Info',       sub: 'DOB, gender, blood group, CNIC',  color: '#0891b2' },
  { num: '3', label: 'Contact Details',     sub: 'Phone & address',                 color: '#db2777' },
  { num: '4', label: 'Father Information',  sub: 'Father name, CNIC, phone',        color: '#d97706' },
  { num: '5', label: 'Mother Information',  sub: 'Mother name, CNIC, phone',        color: '#7c3aed' },
  { num: '6', label: 'Guardian Info',       sub: 'Guardian name, relation, phone',  color: '#0891b2' },
  { num: '7', label: 'Emergency Contact',   sub: 'Emergency person details',        color: '#dc2626' },
  { num: '8', label: 'Academic Background', sub: 'Previous school & type',          color: '#059669' },
  { num: '9', label: 'Class Placement',     sub: 'Section, parent, transport',      color: '#0284c7' },
  { num: '10', label: 'Fee Structure',      sub: 'Tuition, transport & one-time fees', color: '#059669' },
];

const FIELD_LABELS = {
  first_name:               'First Name',
  last_name:                'Last Name',
  middle_name:              'Middle Name',
  username:                 'Username',
  email:                    'Email Address',
  date_of_birth:            'Date of Birth',
  gender:                   'Gender',
  cnic:                     'CNIC / B-Form',
  phone_number:             'Phone Number',
  emergency_contact_name:   'Emergency Contact Name',
  emergency_contact_phone:  'Emergency Contact Phone',
  session:                  'Academic Session',
  course:                   'Class',
  class_enrolled:           'Class',
  class_section:            'Section',
  transport_required:       'Transport',
  father_name:              'Father Name',
  mother_name:              'Mother Name',
  guardian_name:            'Guardian Name',
};

export default function EnrollStudentPage() {
  const navigate = useNavigate();

  const [form,            setForm]            = useState(emptyForm);
  const [createAccount,   setCreateAccount]   = useState(false);
  const [selectedSession, setSelectedSession] = useState(''); // UI-only: session filter
  const [selectedClass,   setSelectedClass]   = useState(''); // UI-only: class filter
  const [parents,       setParents]       = useState([]);
  const [sessions,      setSessions]      = useState([]);
  const [courses,       setCourses]       = useState([]);
  const [sections,      setSections]      = useState([]);
  const [feeStructures, setFeeStructures] = useState([]);
  const [feeAutoFilled, setFeeAutoFilled] = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [errors,        setErrors]        = useState({});
  const [success,       setSuccess]       = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/students/parents/'),
      api.get('/courses/sessions/'),
      api.get('/courses/'),
      api.get('/courses/sections/'),
      api.get('/fees/class-structures/'),
    ]).then(([p, sess, c, s, fs]) => {
      setParents(p.data);
      setSessions(sess.data);
      setCourses(c.data);
      setSections(s.data);
      setFeeStructures(fs.data);
    });
  }, []);

  const set = (field, val) => {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => ({ ...e, [field]: '' }));
  };
  const handleChange = e => set(
    e.target.name,
    e.target.type === 'checkbox' ? e.target.checked : e.target.value
  );

  // Auto-suggest username from first+last name
  const suggestUsername = () => {
    if (!form.username && form.first_name && form.last_name) {
      const suggested = (form.first_name + '.' + form.last_name).toLowerCase().replace(/\s+/g, '');
      set('username', suggested);
    }
  };

  const validate = () => {
    const errs = {};
    // Step 1 — Account
    if (!form.first_name.trim())  errs.first_name  = 'First name is required.';
    if (!form.last_name.trim())   errs.last_name   = 'Last name is required.';
    if (createAccount) {
      if (!form.username.trim())  errs.username    = 'Username is required.';
      if (!form.email.trim())     errs.email       = 'Email address is required.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                                  errs.email       = 'Enter a valid email address.';
    }
    // Step 2 — Personal
    if (!form.date_of_birth)      errs.date_of_birth = 'Date of birth is required.';
    if (!form.gender)             errs.gender        = 'Gender is required.';
    // Step 8 — Transfer fields
    if (form.admission_type === 'transfer') {
      if (!form.previous_school.trim()) errs.previous_school = 'Previous school name is required for transfer students.';
      if (!form.previous_class.trim())  errs.previous_class  = 'Previous class is required for transfer students.';
    }
    // Step 3 — Contact (phone is optional)
    // Step 4/5/6 — At least one family contact
    const hasFather   = form.father_name.trim()   || form.father_cnic.trim()   || form.father_phone.trim();
    const hasMother   = form.mother_name.trim()   || form.mother_cnic.trim()   || form.mother_phone.trim();
    const hasGuardian = form.guardian_name.trim() || form.guardian_relation.trim() || form.guardian_phone.trim();
    if (!hasFather && !hasMother && !hasGuardian)
      errs._family = 'Please fill at least one: Father, Mother, or Guardian information.';
    // Step 7 — Emergency contact phone required
    if (!form.emergency_contact_phone.trim())
      errs.emergency_contact_phone = 'Emergency contact phone is required.';
    // Step 9 — Placement
    if (!selectedSession)         errs.session        = 'Academic session is required.';
    if (!form.class_enrolled)     errs.class_enrolled = 'Class is required.';
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess(null);

    // Client-side validation first
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Scroll to the first error
      setTimeout(() => {
        const el = document.querySelector('[data-error="true"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }

    setErrors({}); setLoading(true);
    try {
      const payload = { ...form, create_account: createAccount, session: selectedSession };
      if (!createAccount)       { delete payload.username; delete payload.email; }
      if (!payload.parent)        delete payload.parent;
      if (!payload.class_section) delete payload.class_section;
      const res = await api.post('/students/enroll/', payload);
      setSuccess(res.data);
      setForm(emptyForm);
      setCreateAccount(false);
      setSelectedClass('');
      setSelectedSession('');
    } catch (err) {
      const data = err.response?.data || { general: 'Enrollment failed. Please check the form and try again.' };
      // Normalize raw 'error' key → 'general' so it shows in the error box, not the field list
      if (data.error && !data.general) { data.general = data.error; delete data.error; }
      setErrors(data);
      // Scroll to the highlighted field if it's a known field error
      setTimeout(() => {
        const el = document.querySelector('[data-error="true"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    } finally { setLoading(false); }
  };

  // Active session (auto-select if there's one marked active)
  const activeSession = sessions.find(s => s.is_active);

  // Sections filtered by selected session + class
  const sessionsFiltered = selectedSession
    ? sections.filter(s => String(s.session) === String(selectedSession))
    : sections;
  const filteredSections = selectedClass
    ? sessionsFiltered.filter(s => String(s.course) === String(selectedClass))
    : [];

  const selectedSection = sections.find(s => String(s.id) === String(form.class_section));
  const selectedParent  = parents.find(p => String(p.id) === String(form.parent));

  const filledFields = [
    form.first_name, form.last_name,
    createAccount ? form.username : true, createAccount ? form.email : true,
    form.date_of_birth, form.gender,
    form.father_name || form.mother_name || form.guardian_name,
    form.emergency_contact_phone,
    form.class_enrolled,
  ].filter(Boolean).length;
  const progress = Math.round((filledFields / 9) * 100);

  return (
    <div style={s.page}>

      {/* ── Top bar ── */}
      <div style={s.topBar}>
        <button style={s.backBtn} onClick={() => navigate('/students')}>
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Students
        </button>
        <div>
          <h1 style={s.pageTitle}>Enroll New Student</h1>
          <p style={s.pageSubtitle}>Al Azmat Public High School — Complete Enrollment Form</p>
        </div>
      </div>

      {/* ── Success Overlay ── */}
      {success && (
        <div style={s.overlay}>
          <div style={s.successModal}>
            <div style={s.successTop}>
              <div style={s.successRing}>
                <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#15803d" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span style={s.confetti}>🎉</span>
            </div>
            <h2 style={s.successTitle}>Student Enrolled!</h2>
            <p style={s.successSub}>{success.temp_password ? 'Account & profile created for' : 'Profile enrolled for'} <strong>{success.full_name}</strong></p>

            {/* IDs */}
            <div style={s.successIds}>
              <IdBadge icon="🪪" label="Student ID"    value={success.student_id}        color="#6366f1" />
              <IdBadge icon="🔖" label="Admission No." value={success.admission_number}   color="#0891b2" />
              <IdBadge icon="🎫" label="Roll Number"   value={success.current_enrollment?.roll_number || '—'} color="#059669" />
            </div>

            {/* Login credentials — shown once (only if account was created) */}
            {success.temp_password ? (
              <div style={s.credentialsBanner}>
                <div style={s.credentialsBannerTitle}>
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>
                  Login Credentials — Save these now!
                </div>
                <div style={s.credentialsGrid}>
                  <div style={s.credentialItem}>
                    <span style={s.credentialLabel}>Username</span>
                    <code style={s.credentialValue}>{success.username}</code>
                  </div>
                  <div style={s.credentialItem}>
                    <span style={s.credentialLabel}>Temp Password</span>
                    <code style={{ ...s.credentialValue, background: '#fef9c3', color: '#854d0e', border: '1px solid #fde047' }}>{success.temp_password}</code>
                  </div>
                  <div style={s.credentialItem}>
                    <span style={s.credentialLabel}>Email</span>
                    <code style={s.credentialValue}>{success.email}</code>
                  </div>
                </div>
                <p style={s.credentialsWarning}>⚠ This password is shown only once. Share it with the student — they must change it on first login.</p>
              </div>
            ) : (
              <div style={{ ...s.credentialsBanner, background: '#f8fafc', border: '1.5px solid #e2e8f0' }}>
                <div style={{ ...s.credentialsBannerTitle, color: '#64748b' }}>
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  No Login Account
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
                  This student was enrolled without a login account. You can create one later from the student's profile page.
                </p>
              </div>
            )}

            <div style={s.successDetails}>
              {[
                { icon: '🏷️', label: 'Full Name',  value: success.full_name },
                { icon: '🏫', label: 'Class',      value: success.current_enrollment ? `${success.current_enrollment.course_name}${success.current_enrollment.section_name ? ' – ' + success.current_enrollment.section_name : ''}` : '—' },
                { icon: '👨‍👩‍👧', label: 'Parent',     value: success.parent_name || '—' },
                { icon: '🚌', label: 'Transport',  value: success.current_enrollment?.transport_required ? 'Required' : 'Not required' },
              ].map(r => (
                <div key={r.label} style={s.detailRow}>
                  <span style={s.detailIcon}>{r.icon}</span>
                  <span style={s.detailLabel}>{r.label}</span>
                  <span style={s.detailValue}>{r.value}</span>
                </div>
              ))}
            </div>

            <div style={s.successBtns}>
              <button style={s.anotherBtn} onClick={() => { setSuccess(null); setCreateAccount(true); setSelectedSession(''); setSelectedClass(''); }}>+ Enroll Another</button>
              <button style={s.goListBtn}  onClick={() => navigate('/students')}>View All Students →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main layout ── */}
      <div style={s.layout}>

        {/* ════ LEFT: Form ════ */}
        <div style={s.formCol}>
          <form onSubmit={handleSubmit}>

            {/* Step 1 — Account */}
            <StepCard step={STEPS[0]}>
              {/* Full name row */}
              <div style={s.row}>
                <Field label="First Name" required error={errors.first_name}>
                  <IconInput icon="👤" name="first_name" value={form.first_name} onChange={handleChange} onBlur={createAccount ? suggestUsername : undefined} placeholder="e.g. Ali" hasError={!!errors.first_name} />
                </Field>
                <Field label="Middle Name" error={errors.middle_name}>
                  <IconInput icon="👤" name="middle_name" value={form.middle_name} onChange={handleChange} placeholder="(optional)" />
                </Field>
                <Field label="Last Name" required error={errors.last_name}>
                  <IconInput icon="👤" name="last_name" value={form.last_name} onChange={handleChange} onBlur={createAccount ? suggestUsername : undefined} placeholder="e.g. Khan" hasError={!!errors.last_name} />
                </Field>
              </div>

              {/* Login account toggle */}
              <div style={s.accountToggleRow}>
                <div>
                  <div style={s.accountToggleLabel}>🔐 Create Login Account?</div>
                  <div style={s.accountToggleSub}>
                    {createAccount
                      ? 'Student will receive a username & temporary password to log in.'
                      : 'No login account — student can be added to the portal later.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCreateAccount(v => !v);
                    setErrors(e => { const n = { ...e }; delete n.username; delete n.email; return n; });
                  }}
                  style={{ ...s.toggle, background: createAccount ? '#6366f1' : '#e2e8f0', flexShrink: 0 }}
                >
                  <div style={{ ...s.toggleThumb, transform: createAccount ? 'translateX(22px)' : 'translateX(2px)' }} />
                </button>
              </div>

              {/* Credentials — shown only when createAccount is true */}
              {createAccount && (
                <div style={s.credentialsBox}>
                  <div style={s.credentialsTitle}>🔐 Login Credentials</div>
                  <div style={s.row}>
                    <Field label="Username" required error={errors.username}>
                      <IconInput icon="@" name="username" value={form.username} onChange={handleChange} placeholder="e.g. ali.khan" hasError={!!errors.username} />
                    </Field>
                    <Field label="Email Address" required error={errors.email}>
                      <IconInput icon="✉️" type="email" name="email" value={form.email} onChange={handleChange} placeholder="student@email.com" hasError={!!errors.email} />
                    </Field>
                  </div>
                  <div style={s.credentialsHint}>
                    <span>🔑</span>
                    <span>A temporary password will be auto-generated and shown after enrollment. Student must change it on first login.</span>
                  </div>
                </div>
              )}
            </StepCard>

            {/* Step 2 — Personal */}
            <StepCard step={STEPS[1]}>
              <div style={s.row}>
                <Field label="Date of Birth" required error={errors.date_of_birth}>
                  <IconInput icon="📅" type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} hasError={!!errors.date_of_birth} />
                </Field>
                <Field label="Gender" required error={errors.gender}>
                  <IconSelect icon={form.gender === 'male' ? '👦' : form.gender === 'female' ? '👧' : '🧑'} name="gender" value={form.gender} onChange={handleChange} placeholder="— Select —" hasError={!!errors.gender}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </IconSelect>
                </Field>
                <Field label="Blood Group" error={errors.blood_group}>
                  <IconSelect icon="🩸" name="blood_group" value={form.blood_group} onChange={handleChange} placeholder="— Select —">
                    {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(g => <option key={g} value={g}>{g}</option>)}
                  </IconSelect>
                </Field>
              </div>
              <Field label="CNIC / B-Form Number" error={errors.cnic}>
                <IconInput icon="🪪" name="cnic" value={form.cnic} onChange={handleChange} placeholder="e.g. 12345-1234567-1 or B-Form no." />
              </Field>
            </StepCard>

            {/* Step 3 — Contact */}
            <StepCard step={STEPS[2]}>
              <Field label="Phone Number" error={errors.phone_number}>
                <IconInput icon="📞" name="phone_number" value={form.phone_number} onChange={handleChange} placeholder="+92 300 0000000" />
              </Field>
              <Field label="Home Address" error={errors.address}>
                <div style={s.inputWrap}>
                  <span style={{ ...s.inputIcon, top: 12 }}>📍</span>
                  <textarea style={{ ...s.input, ...s.inputPadIcon, resize: 'none', height: 80, lineHeight: 1.6 }} name="address" value={form.address} onChange={handleChange} placeholder="Full home address…" />
                </div>
              </Field>
            </StepCard>

            {/* Family required banner */}
            {errors._family && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#dc2626', fontWeight: 500, marginBottom: 2 }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
                </svg>
                {errors._family}
              </div>
            )}

            {/* Step 4 — Father */}
            <StepCard step={STEPS[3]}>
              <div style={s.row}>
                <Field label="Father's Full Name" error={errors.father_name}>
                  <IconInput icon="👨" name="father_name" value={form.father_name} onChange={handleChange} placeholder="Full name" />
                </Field>
                <Field label="Father's CNIC" error={errors.father_cnic}>
                  <IconInput icon="🪪" name="father_cnic" value={form.father_cnic} onChange={handleChange} placeholder="12345-1234567-1" />
                </Field>
                <Field label="Father's Phone" error={errors.father_phone}>
                  <IconInput icon="📞" name="father_phone" value={form.father_phone} onChange={handleChange} placeholder="+92 300 0000000" />
                </Field>
              </div>
            </StepCard>

            {/* Step 5 — Mother */}
            <StepCard step={STEPS[4]}>
              <div style={s.row}>
                <Field label="Mother's Full Name" error={errors.mother_name}>
                  <IconInput icon="👩" name="mother_name" value={form.mother_name} onChange={handleChange} placeholder="Full name" />
                </Field>
                <Field label="Mother's CNIC" error={errors.mother_cnic}>
                  <IconInput icon="🪪" name="mother_cnic" value={form.mother_cnic} onChange={handleChange} placeholder="12345-1234567-1" />
                </Field>
                <Field label="Mother's Phone" error={errors.mother_phone}>
                  <IconInput icon="📞" name="mother_phone" value={form.mother_phone} onChange={handleChange} placeholder="+92 300 0000000" />
                </Field>
              </div>
            </StepCard>

            {/* Step 6 — Guardian */}
            <StepCard step={STEPS[5]}>
              <div style={s.guardianNote}>
                <span>💡</span>
                <span>Fill this section only if the guardian is different from the father or mother. All fields are optional — at least one parent/guardian info is enough.</span>
              </div>
              <div style={s.row}>
                <Field label="Guardian Name" error={errors.guardian_name}>
                  <IconInput icon="🧑" name="guardian_name" value={form.guardian_name} onChange={handleChange} placeholder="Guardian's full name" />
                </Field>
                <Field label="Relation to Student" error={errors.guardian_relation}>
                  <IconInput icon="🔗" name="guardian_relation" value={form.guardian_relation} onChange={handleChange} placeholder="e.g. Uncle, Grandparent…" />
                </Field>
                <Field label="Guardian Phone" error={errors.guardian_phone}>
                  <IconInput icon="📞" name="guardian_phone" value={form.guardian_phone} onChange={handleChange} placeholder="+92 300 0000000" />
                </Field>
              </div>
            </StepCard>

            {/* Step 7 — Emergency */}
            <StepCard step={STEPS[6]}>
              <div style={s.row}>
                <Field label="Emergency Contact Name" error={errors.emergency_contact_name}>
                  <IconInput icon="🆘" name="emergency_contact_name" value={form.emergency_contact_name} onChange={handleChange} placeholder="Contact person name" />
                </Field>
                <Field label="Emergency Contact Phone" required error={errors.emergency_contact_phone}>
                  <IconInput icon="📞" name="emergency_contact_phone" value={form.emergency_contact_phone} onChange={handleChange} placeholder="+92 300 0000000" hasError={!!errors.emergency_contact_phone} />
                </Field>
              </div>
            </StepCard>

            {/* Step 8 — Academic Background */}
            <StepCard step={STEPS[7]}>
              <Field label="Admission Type" error={errors.admission_type}>
                <div style={s.admTypeRow}>
                  {[
                    { v: 'new',      label: 'New Admission', icon: '✨', desc: 'First time enrolling in any school' },
                    { v: 'transfer', label: 'Transfer',      icon: '🔄', desc: 'Coming from another school (SLC required)' },
                  ].map(opt => (
                    <button
                      key={opt.v} type="button"
                      onClick={() => {
                        set('admission_type', opt.v);
                        if (opt.v === 'new') {
                          set('previous_school', '');
                          set('previous_class', '');
                        }
                      }}
                      style={{
                        ...s.admTypeBtn,
                        background: form.admission_type === opt.v ? STEPS[7].color : '#f8fafc',
                        color:      form.admission_type === opt.v ? '#fff' : '#64748b',
                        border:     `2px solid ${form.admission_type === opt.v ? STEPS[7].color : '#e2e8f0'}`,
                        textAlign: 'left', padding: '12px 14px',
                      }}
                    >
                      <div style={{ fontSize: 15 }}>{opt.icon} {opt.label}</div>
                      <div style={{ fontSize: 11, marginTop: 3, opacity: 0.8 }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </Field>

              {/* Transfer-only fields */}
              {form.admission_type === 'transfer' && (
                <>
                  <div style={{ background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#92400e', marginBottom: 4 }}>
                    📄 <strong>School Leaving Certificate (SLC)</strong> is required for transfer students. Collect it from the previous school before or at the time of admission.
                  </div>
                  <div style={s.row}>
                    <Field label="Previous School Name" required error={errors.previous_school}>
                      <IconInput icon="🏫" name="previous_school" value={form.previous_school} onChange={handleChange} placeholder="e.g. Govt. High School, Lahore" />
                    </Field>
                    <Field label="Previous Class" required error={errors.previous_class}>
                      <IconInput icon="📚" name="previous_class" value={form.previous_class} onChange={handleChange} placeholder="e.g. Class 5" />
                    </Field>
                  </div>
                  <Field label="SLC Status">
                    <div style={s.admTypeRow}>
                      {[
                        { v: 'pending',   label: 'Pending',   icon: '⏳', desc: 'Not yet submitted' },
                        { v: 'submitted', label: 'Submitted', icon: '✅', desc: 'SLC received from parent' },
                      ].map(opt => (
                        <button key={opt.v} type="button"
                          onClick={() => set('slc_status', opt.v)}
                          style={{
                            ...s.admTypeBtn,
                            background: form.slc_status === opt.v ? (opt.v === 'submitted' ? '#059669' : '#d97706') : '#f8fafc',
                            color:      form.slc_status === opt.v ? '#fff' : '#64748b',
                            border:     `2px solid ${form.slc_status === opt.v ? (opt.v === 'submitted' ? '#059669' : '#d97706') : '#e2e8f0'}`,
                            textAlign: 'left', padding: '12px 14px',
                          }}
                        >
                          <div style={{ fontSize: 15 }}>{opt.icon} {opt.label}</div>
                          <div style={{ fontSize: 11, marginTop: 3, opacity: 0.8 }}>{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </Field>
                </>
              )}

              {/* New admission — simple confirmation */}
              {form.admission_type === 'new' && (
                <div style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#166534' }}>
                  ✨ <strong>New Admission</strong> — No previous school record needed. SLC not required.
                </div>
              )}
            </StepCard>

            {/* Step 9 — Placement */}
            <StepCard step={STEPS[8]}>

              {/* ── 1. Academic Session ── */}
              <Field label="Academic Session" required error={errors.session}>
                <div style={s.sessionGrid}>
                  {sessions.length === 0 ? (
                    <div style={s.noSectionNote}>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 8v4m0 4h.01"/></svg>
                      No sessions yet. Create an academic session first.
                    </div>
                  ) : sessions.map(sess => {
                    const active = String(selectedSession) === String(sess.id);
                    return (
                      <button key={sess.id} type="button"
                        onClick={() => {
                          setSelectedSession(sess.id);
                          setSelectedClass('');
                          set('class_enrolled', '');
                          set('class_section', '');
                          setFeeAutoFilled(false);
                        }}
                        style={{
                          ...s.sessionBtn,
                          background: active ? '#0284c7' : '#f8fafc',
                          color:      active ? '#fff'    : '#334155',
                          border:     `2px solid ${active ? '#0284c7' : '#e2e8f0'}`,
                          boxShadow:  active ? '0 2px 8px #0284c744' : 'none',
                        }}
                      >
                        <span style={s.sessionBtnName}>{sess.name}</span>
                        {sess.is_active && (
                          <span style={{ ...s.sessionBtnBadge, background: active ? 'rgba(255,255,255,0.25)' : '#dcfce7', color: active ? '#fff' : '#15803d' }}>Active</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Field>

              {/* ── 2. Class ── */}
              {selectedSession && (
                <Field label="Class" required error={errors.class_enrolled}>
                  <IconSelect
                    icon="🏫"
                    value={form.class_enrolled}
                    onChange={e => {
                      const courseId = e.target.value;
                      setSelectedClass(courseId);
                      set('class_enrolled', courseId);
                      const sectionA = sections.find(sec =>
                        String(sec.session) === String(selectedSession) &&
                        String(sec.course)  === String(courseId) &&
                        sec.name === 'A'
                      );
                      set('class_section', sectionA?.id || '');
                      // Auto-fill fees from class fee structure
                      const fs = feeStructures.find(f =>
                        String(f.course) === String(courseId) &&
                        (f.session === null || String(f.session) === String(selectedSession))
                      );
                      if (fs) {
                        setForm(prev => ({
                          ...prev,
                          class_enrolled:   courseId,
                          class_section:    sectionA?.id || prev.class_section,
                          tuition_fee:      fs.tuition_fee      ?? '',
                          transport_fee:    fs.transport_fee    ?? '',
                          registration_fee: fs.registration_fee ?? '',
                          books_fee:        fs.books_fee        ?? '',
                          exam_fee:         fs.exam_fee         ?? '',
                        }));
                        setFeeAutoFilled(true);
                      } else {
                        setFeeAutoFilled(false);
                      }
                    }}
                    placeholder="— Select class —"
                    hasError={!!errors.class_enrolled}
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </IconSelect>
                </Field>
              )}

              {/* ── 3. Section (optional) ── */}
              {selectedClass && (
                <Field label="Section (optional)">
                  <div style={s.sectionGrid}>
                    {/* "No section" button */}
                    <button type="button"
                      onClick={() => set('class_section', '')}
                      style={{
                        ...s.sectionBtn,
                        background: !form.class_section ? STEPS[8].color : '#f8fafc',
                        color:      !form.class_section ? '#fff' : '#334155',
                        border:     `2px solid ${!form.class_section ? STEPS[8].color : '#e2e8f0'}`,
                        boxShadow:  !form.class_section ? `0 2px 8px ${STEPS[8].color}44` : 'none',
                        width: 'auto', padding: '10px 16px',
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 600 }}>No Section</span>
                    </button>
                    {filteredSections.map(sec => {
                      const active = String(form.class_section) === String(sec.id);
                      return (
                        <button key={sec.id} type="button"
                          onClick={() => set('class_section', sec.id)}
                          style={{
                            ...s.sectionBtn,
                            background: active ? STEPS[8].color : '#f8fafc',
                            color:      active ? '#fff' : '#334155',
                            border:     `2px solid ${active ? STEPS[8].color : '#e2e8f0'}`,
                            boxShadow:  active ? `0 2px 8px ${STEPS[8].color}44` : 'none',
                          }}
                        >
                          <span style={s.sectionBtnLetter}>{sec.name || '—'}</span>
                          <span style={{ ...s.sectionBtnSub, color: active ? 'rgba(255,255,255,0.8)' : '#94a3b8' }}>
                            {sec.student_count} student{sec.student_count !== 1 ? 's' : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}

              {/* Placement summary chip */}
              {form.class_enrolled && (
                <div style={s.placementChip}>
                  <span style={s.placementChipIcon}>✅</span>
                  <span>
                    <strong>{courses.find(c => String(c.id) === String(form.class_enrolled))?.name}</strong>
                    {selectedSection && <> — Section <strong>{selectedSection.name}</strong></>}
                    {selectedSession && <span style={s.placementChipYear}> · {sessions.find(s => String(s.id) === String(selectedSession))?.name}</span>}
                  </span>
                </div>
              )}
              <Field label="Parent / Guardian Account" error={errors.parent}>
                <IconSelect icon="👨‍👩‍👧" name="parent" value={form.parent} onChange={handleChange} placeholder="— No parent linked (optional) —">
                  {parents.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name} — {p.email}</option>
                  ))}
                </IconSelect>
              </Field>
              {/* Transport toggle */}
              <div style={s.transportRow}>
                <div>
                  <div style={s.transportLabel}>🚌 Transport Required?</div>
                  <div style={s.transportSub}>Student needs school transport service</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !form.transport_required;
                    setForm(f => ({ ...f, transport_required: next, transport_fee: next ? f.transport_fee : '' }));
                  }}
                  style={{ ...s.toggle, background: form.transport_required ? '#059669' : '#e2e8f0' }}
                >
                  <div style={{ ...s.toggleThumb, transform: form.transport_required ? 'translateX(22px)' : 'translateX(2px)' }} />
                </button>
              </div>
            </StepCard>

            {/* Step 10 — Fee Structure */}
            <StepCard step={STEPS[9]}>
              {feeAutoFilled ? (
                <div style={s.feeAutoBanner}>
                  <span style={{ fontSize: 18 }}>✅</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#15803d' }}>
                      Auto-filled from <strong>{courses.find(c => String(c.id) === String(form.class_enrolled))?.name}</strong> fee structure
                    </div>
                    <div style={{ fontSize: 12, color: '#166534', marginTop: 2 }}>
                      You can edit any value below to customize fees for this student.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setForm(f => ({ ...f, tuition_fee: '', transport_fee: '', registration_fee: '', books_fee: '', exam_fee: '' }));
                      setFeeAutoFilled(false);
                    }}
                    style={{ fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    Clear & Enter Manually
                  </button>
                </div>
              ) : (
                <div style={s.feeNote}>
                  <span>💡</span>
                  <span>
                    {form.class_enrolled
                      ? 'No fee structure found for this class. Enter fees manually below.'
                      : 'Select a class in Step 9 — fees will auto-fill from the class fee structure.'}
                  </span>
                </div>
              )}

              {/* Monthly fees */}
              <div style={s.feeSection}>
                <div style={s.feeSectionTitle}>
                  <span style={{ ...s.feeSectionBadge, background: '#eff6ff', color: '#3b82f6', border: '1px solid #bfdbfe' }}>🔁 Monthly</span>
                </div>
                <div style={s.row}>
                  <Field label="Tuition Fee (PKR/month)" error={errors.tuition_fee}>
                    <IconInput icon="🎓" type="number" name="tuition_fee" value={form.tuition_fee} onChange={handleChange} placeholder="e.g. 3500" min="0" />
                  </Field>
                  <Field label="Transport Fee (PKR/month)" error={errors.transport_fee}>
                    <IconInput icon="🚌" type="number" name="transport_fee" value={form.transport_fee} onChange={handleChange} placeholder="e.g. 800" min="0" disabled={!form.transport_required} style={!form.transport_required ? { opacity: 0.45, cursor: 'not-allowed', background: '#f1f5f9' } : {}} />
                    {!form.transport_required && <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>Enable transport above to set a fee</span>}
                  </Field>
                </div>
              </div>

              {/* One-time fees */}
              <div style={s.feeSection}>
                <div style={s.feeSectionTitle}>
                  <span style={{ ...s.feeSectionBadge, background: '#f0fdf4', color: '#059669', border: '1px solid #86efac' }}>1️⃣ One-Time</span>
                </div>
                <div style={s.row}>
                  <Field label="Registration Fee (PKR)" error={errors.registration_fee}>
                    <IconInput icon="📋" type="number" name="registration_fee" value={form.registration_fee} onChange={handleChange} placeholder="e.g. 5000" min="0" />
                  </Field>
                  <Field label="Books Fee (PKR) — optional" error={errors.books_fee}>
                    <IconInput icon="📚" type="number" name="books_fee" value={form.books_fee} onChange={handleChange} placeholder="e.g. 2000" min="0" />
                  </Field>
                  <Field label="Exam Fee (PKR) — optional" error={errors.exam_fee}>
                    <IconInput icon="📝" type="number" name="exam_fee" value={form.exam_fee} onChange={handleChange} placeholder="e.g. 500" min="0" />
                  </Field>
                </div>
              </div>

              {/* Summary row */}
              {(form.tuition_fee || form.transport_fee || form.registration_fee || form.books_fee || form.exam_fee) && (
                <div style={s.feeSummary}>
                  <div style={s.feeSummaryItem}>
                    <span style={s.feeSummaryLabel}>Monthly Total</span>
                    <span style={{ ...s.feeSummaryVal, color: '#3b82f6' }}>
                      PKR {(parseFloat(form.tuition_fee || 0) + parseFloat(form.transport_fee || 0)).toLocaleString()}
                    </span>
                  </div>
                  <div style={s.feeSummaryDivider} />
                  <div style={s.feeSummaryItem}>
                    <span style={s.feeSummaryLabel}>One-Time Total</span>
                    <span style={{ ...s.feeSummaryVal, color: '#059669' }}>
                      PKR {(parseFloat(form.registration_fee || 0) + parseFloat(form.books_fee || 0) + parseFloat(form.exam_fee || 0)).toLocaleString()}
                    </span>
                  </div>
                  <div style={s.feeSummaryDivider} />
                  <div style={s.feeSummaryItem}>
                    <span style={s.feeSummaryLabel}>Annual Estimate</span>
                    <span style={{ ...s.feeSummaryVal, color: '#7c3aed', fontWeight: 800 }}>
                      PKR {((parseFloat(form.tuition_fee || 0) + parseFloat(form.transport_fee || 0)) * 12 + parseFloat(form.registration_fee || 0) + parseFloat(form.books_fee || 0) + parseFloat(form.exam_fee || 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              <Field label="Concession / Note (optional)" error={errors.fee_note}>
                <div style={s.inputWrap}>
                  <span style={{ ...s.inputIcon, top: 12 }}>🗒️</span>
                  <textarea style={{ ...s.input, ...s.inputPadIcon, resize: 'none', height: 60, lineHeight: 1.6 }} name="fee_note" value={form.fee_note} onChange={handleChange} placeholder="e.g. 50% sibling concession on tuition…" />
                </div>
              </Field>
            </StepCard>

            {(errors.general || errors.non_field_errors) && (
              <div style={s.errorBox}>⚠ {errors.general || errors.non_field_errors}</div>
            )}

            {/* Validation summary — shown after a failed submit attempt */}
            {Object.keys(errors).length > 0 && !errors.general && !errors.non_field_errors && (
              <div style={s.validationSummary}>
                <div style={s.validationSummaryTitle}>
                  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 8v4m0 4h.01"/></svg>
                  Please fix the following before submitting:
                </div>
                <ul style={s.validationList}>
                  {Object.entries(errors).filter(([k]) => k !== '_family').map(([k, v]) => {
                    const msg = Array.isArray(v) ? v[0] : v;
                    const label = FIELD_LABELS[k] || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    return (
                      <li key={k} style={s.validationItem}>
                        <span style={{ fontWeight: 700, color: '#b91c1c' }}>{label}:</span> {msg}
                      </li>
                    );
                  })}
                  {errors._family && <li style={s.validationItem}>• {errors._family}</li>}
                </ul>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !form.first_name || !form.last_name || (createAccount && (!form.username || !form.email))}
              style={{ ...s.submitBtn, opacity: (loading || !form.first_name || !form.last_name || (createAccount && (!form.username || !form.email))) ? 0.55 : 1 }}
            >
              {loading
                ? <span style={s.btnInner}><Spinner /> Enrolling Student…</span>
                : <span style={s.btnInner}>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Enroll Student
                  </span>}
            </button>
          </form>
        </div>

        {/* ════ RIGHT: Preview ════ */}
        <div style={s.previewCol}>

          {/* Progress */}
          <div style={s.progressCard}>
            <div style={s.progressTop}>
              <span style={s.progressLabel}>Form Progress</span>
              <span style={{ ...s.progressPct, color: progress === 100 ? '#059669' : '#6366f1' }}>{progress}%</span>
            </div>
            <div style={s.progressTrack}>
              <div style={{ ...s.progressFill, width: `${progress}%`, background: progress === 100 ? 'linear-gradient(90deg,#059669,#34d399)' : 'linear-gradient(90deg,#6366f1,#818cf8)' }} />
            </div>
            <p style={s.progressHint}>
              {progress === 0 ? 'Start by entering the student\'s name.'
                : progress < 50 ? 'Keep filling in the details…'
                : progress < 100 ? 'Almost done!'
                : '✓ Ready to enroll!'}
            </p>
          </div>

          {/* Student preview */}
          <div style={s.previewCard}>
            <div style={s.previewHead}>
              <span style={s.previewHeadTxt}>👁 Live Preview</span>
            </div>
            <div style={s.previewAvWrap}>
              {(() => {
                const fullName = [form.first_name, form.middle_name, form.last_name].filter(Boolean).join(' ');
                return <>
                  <div style={{ ...s.previewAv, background: fullName ? avatarColor(fullName) : '#e2e8f0' }}>
                    {fullName
                      ? initials(fullName)
                      : <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                  </div>
                  <div style={s.previewName}>{fullName || <em style={{ color: '#cbd5e1', fontWeight: 400 }}>Enter student name</em>}</div>
                  {createAccount && form.username && <div style={s.previewUser}>@{form.username}</div>}
                </>;
              })()}
            </div>

            <div style={s.previewRows}>
              <PRow icon="🪪"  label="Student ID"     value="Auto-generated" empty />
              <PRow icon="🔖" label="Admission No."   value="Auto-generated" empty />
              <PRow icon="🎫" label="Roll No."        value="Auto-generated" empty />
              <PRow icon="📅" label="Date of Birth"   value={form.date_of_birth} />
              <PRow icon="🩸" label="Blood Group"     value={form.blood_group} />
              <PRow icon="👨" label="Father"          value={form.father_name} />
              <PRow icon="👩" label="Mother"          value={form.mother_name} />
              <PRow icon="🆘" label="Emergency"       value={form.emergency_contact_name} />
              <PRow icon="🏫" label="Class"
                value={form.class_enrolled
                  ? `${courses.find(c => String(c.id) === String(form.class_enrolled))?.name || ''}${selectedSection ? ' · Sec ' + selectedSection.name : ''}`
                  : ''} />
              <PRow icon="👨‍👩‍👧" label="Parent Acct."   value={selectedParent?.full_name} />
              <PRow icon="🚌" label="Transport"       value={form.transport_required ? '✓ Required' : ''} />
            </div>
          </div>

          {/* Step index */}
          <div style={s.stepIndex}>
            <div style={s.stepIndexTitle}>📋 Sections</div>
            {STEPS.map(step => (
              <div key={step.num} style={s.stepIndexRow}>
                <div style={{ ...s.stepIndexBadge, background: step.color }}>{step.num}</div>
                <div style={s.stepIndexLabel}>{step.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Reusable field components ── */

function StepCard({ step, children }) {
  return (
    <div style={{ ...sc.card, borderLeft: `4px solid ${step.color}` }}>
      <div style={sc.header}>
        <div style={{ ...sc.badge, background: step.color }}>{step.num}</div>
        <div>
          <div style={sc.title}>{step.label}</div>
          <div style={sc.sub}>{step.sub}</div>
        </div>
      </div>
      <div style={sc.body}>{children}</div>
    </div>
  );
}

function Field({ label, error, required, children }) {
  return (
    <div data-error={!!error || undefined} style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 160 }}>
      <label style={{ ...s.label, color: error ? '#dc2626' : '#374151' }}>
        {label}
        {required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#dc2626', fontSize: 12, fontWeight: 500 }}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
          </svg>
          {error}
        </span>
      )}
    </div>
  );
}

function IconInput({ icon, hasError, style: extraStyle, ...props }) {
  return (
    <div style={s.inputWrap}>
      <span style={s.inputIcon}>{icon}</span>
      <input style={{ ...s.input, ...s.inputPad, borderColor: hasError ? '#f87171' : undefined, background: hasError ? '#fef2f2' : undefined, ...extraStyle }} {...props} />
    </div>
  );
}

function IconSelect({ icon, placeholder, hasError, children, ...props }) {
  return (
    <div style={s.selectWrap}>
      <span style={s.inputIcon}>{icon}</span>
      <select style={{ ...s.select, ...s.inputPad, color: props.value ? '#1e293b' : '#94a3b8', borderColor: hasError ? '#f87171' : undefined, background: hasError ? '#fef2f2' : undefined }} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
      <svg style={s.selectArrow} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

function PRow({ icon, label, value, empty }) {
  return (
    <div style={s.pRow}>
      <span style={s.pIcon}>{icon}</span>
      <span style={s.pLabel}>{label}</span>
      <span style={value ? (empty ? s.pAuto : s.pValue) : s.pEmpty}>
        {value || '—'}
      </span>
    </div>
  );
}

function IdBadge({ icon, label, value, color }) {
  return (
    <div style={{ ...s.idBadge, background: color + '15', border: `1px solid ${color}44` }}>
      <div style={s.idIcon}>{icon}</div>
      <div style={{ ...s.idValue, color }}>{value}</div>
      <div style={s.idLabel}>{label}</div>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="10" stroke="white" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/* ── Styles ── */
const s = {
  page:        { padding: '28px', background: '#f1f5f9', minHeight: '100%' },
  topBar:      { display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28, flexWrap: 'wrap' },
  backBtn:     { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 9, cursor: 'pointer', fontSize: 13, color: '#475569', fontWeight: 600, flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  pageTitle:   { margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' },
  pageSubtitle:{ margin: '3px 0 0', fontSize: 14, color: '#64748b' },

  layout:     { display: 'flex', gap: 24, alignItems: 'flex-start' },
  formCol:    { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' },
  previewCol: { width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 20 },

  autoNote:     { display: 'flex', alignItems: 'flex-start', gap: 8, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#15803d', lineHeight: 1.5, marginBottom: 4 },
  guardianNote: { display: 'flex', alignItems: 'flex-start', gap: 8, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#1d4ed8', lineHeight: 1.5, marginBottom: 12 },

  // Step 1 credentials box
  validationSummary:      { background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 12, padding: '14px 16px', marginTop: 4 },
  validationSummaryTitle: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 8 },
  validationList:         { margin: 0, padding: 0, listStyle: 'none' },
  validationItem:         { fontSize: 12, color: '#b91c1c', padding: '2px 0', lineHeight: 1.5 },

  credentialsBox:   { background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '14px 16px', marginTop: 12 },
  credentialsTitle: { fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 },
  credentialsHint:  { display: 'flex', alignItems: 'flex-start', gap: 6, background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#854d0e', lineHeight: 1.5, marginTop: 8 },

  // Success modal credentials banner
  credentialsBanner:      { background: '#1e293b', borderRadius: 12, padding: '16px', margin: '12px 0', textAlign: 'left' },
  credentialsBannerTitle: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: '#f1f5f9', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' },
  credentialsGrid:        { display: 'flex', flexDirection: 'column', gap: 8 },
  credentialItem:         { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  credentialLabel:        { fontSize: 12, color: '#94a3b8', fontWeight: 600, minWidth: 110 },
  credentialValue:        { fontFamily: 'monospace', fontSize: 13, background: '#0f172a', color: '#34d399', padding: '4px 10px', borderRadius: 6, fontWeight: 700, letterSpacing: '0.03em' },
  credentialsWarning:     { fontSize: 11, color: '#fbbf24', margin: '10px 0 0', lineHeight: 1.5 },

  namePrefillNote: { display: 'flex', alignItems: 'flex-start', gap: 8, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 9, padding: '8px 12px', fontSize: 12, color: '#15803d', lineHeight: 1.5, marginTop: 8 },
  feeAutoBanner:   { display: 'flex', alignItems: 'center', gap: 12, background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 10, padding: '12px 16px', marginBottom: 16 },
  feeNote:         { display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fefce8', border: '1px solid #fde047', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#854d0e', lineHeight: 1.5, marginBottom: 16 },
  feeSection:      { marginBottom: 16 },
  feeSectionTitle: { marginBottom: 10 },
  feeSectionBadge: { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  feeSummary:      { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0, background: 'linear-gradient(135deg,#f8fafc,#f0fdf4)', border: '1.5px solid #d1fae5', borderRadius: 12, padding: '14px 20px', marginBottom: 14 },
  feeSummaryItem:  { flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 3, padding: '4px 12px' },
  feeSummaryLabel: { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' },
  feeSummaryVal:   { fontSize: 16, fontWeight: 700 },
  feeSummaryDivider: { width: 1, height: 40, background: '#e2e8f0', flexShrink: 0 },

  row:      { display: 'flex', gap: 14, flexWrap: 'wrap' },
  label:    { fontSize: 13, fontWeight: 600, color: '#374151' },

  inputWrap:  { position: 'relative' },
  inputIcon:  { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: 15, zIndex: 1, display: 'flex', alignItems: 'center' },
  input:      { padding: '11px 14px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 14, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none', background: '#fff' },
  inputPad:   { paddingLeft: 40 },

  selectWrap:  { position: 'relative' },
  select:      { width: '100%', padding: '11px 36px 11px 14px', border: '1.5px solid #e2e8f0', borderRadius: 9, fontSize: 14, fontFamily: 'inherit', outline: 'none', appearance: 'none', background: '#fff', cursor: 'pointer' },
  selectArrow: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' },
  inputPadIcon:{ paddingLeft: 40 },

  admTypeRow: { display: 'flex', gap: 12 },
  admTypeBtn: { flex: 1, padding: '11px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' },

  transportRow:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: 10, padding: '14px 16px', border: '1.5px solid #e2e8f0', marginTop: 4 },
  transportLabel:{ fontSize: 14, fontWeight: 700, color: '#1e293b' },
  transportSub:  { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  accountToggleRow:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: 10, padding: '14px 16px', border: '1.5px solid #e2e8f0', marginBottom: 12, gap: 12 },
  accountToggleLabel:{ fontSize: 14, fontWeight: 700, color: '#1e293b' },
  accountToggleSub:  { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  sessionGrid:       { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  sessionBtn:        { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', border: 'none' },
  sessionBtnName:    { fontSize: 14, fontWeight: 700 },
  sessionBtnBadge:   { fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6 },
  sectionGrid:       { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  sectionBtn:        { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 80, height: 72, borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' },
  sectionBtnLetter:  { fontSize: 22, fontWeight: 800, lineHeight: 1.2 },
  sectionBtnSub:     { fontSize: 10, marginTop: 2 },
  noSectionNote:     { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#94a3b8', background: '#f8fafc', border: '1.5px dashed #e2e8f0', borderRadius: 8, padding: '10px 14px' },
  placementChip:     { display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#15803d', marginTop: 4 },
  placementChipIcon: { fontSize: 16 },
  placementChipYear: { color: '#86efac', fontSize: 12 },
  toggle:        { width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.25s', flexShrink: 0 },
  toggleThumb:   { position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'transform 0.25s' },

  errorBox:  { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 4 },
  submitBtn: { width: '100%', padding: 15, background: 'linear-gradient(135deg,#059669,#34d399)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 800, cursor: 'pointer', marginTop: 8, boxShadow: '0 6px 20px rgba(5,150,105,0.35)', transition: 'opacity 0.2s' },
  btnInner:  { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 },

  // Progress
  progressCard:  { background: '#fff', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)' },
  progressTop:   { display: 'flex', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontSize: 13, fontWeight: 700, color: '#374151' },
  progressPct:   { fontSize: 20, fontWeight: 800 },
  progressTrack: { height: 8, background: '#f1f5f9', borderRadius: 20, overflow: 'hidden', marginBottom: 8 },
  progressFill:  { height: '100%', borderRadius: 20, transition: 'width 0.4s ease' },
  progressHint:  { margin: 0, fontSize: 12, color: '#94a3b8', textAlign: 'center' },

  // Preview card
  previewCard:  { background: '#fff', borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.07)', overflow: 'hidden' },
  previewHead:  { padding: '10px 14px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' },
  previewHeadTxt:{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' },
  previewAvWrap:{ padding: '16px 14px 12px', borderBottom: '1px solid #f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
  previewAv:    { width: 56, height: 56, borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, boxShadow: '0 3px 10px rgba(0,0,0,0.12)' },
  previewName:  { fontSize: 14, fontWeight: 700, color: '#1e293b', textAlign: 'center' },
  previewUser:  { fontSize: 12, color: '#94a3b8' },
  previewRows:  { padding: '4px 0' },
  pRow:   { display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderBottom: '1px solid #f8fafc' },
  pIcon:  { fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0 },
  pLabel: { fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', width: 72, flexShrink: 0 },
  pValue: { fontSize: 12, fontWeight: 600, color: '#1e293b', flex: 1, textAlign: 'right' },
  pAuto:  { fontSize: 11, color: '#059669', fontWeight: 600, flex: 1, textAlign: 'right', fontStyle: 'italic' },
  pEmpty: { fontSize: 11, color: '#cbd5e1', flex: 1, textAlign: 'right' },

  // Step index
  stepIndex:      { background: '#fff', borderRadius: 14, padding: '14px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)' },
  stepIndexTitle: { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 },
  stepIndexRow:   { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' },
  stepIndexBadge: { width: 22, height: 22, borderRadius: '50%', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepIndexLabel: { fontSize: 13, color: '#475569', fontWeight: 500 },

  // Success overlay
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 },
  successModal: { background: '#fff', borderRadius: 24, padding: '32px 28px', maxWidth: 460, width: '100%', boxShadow: '0 30px 80px rgba(0,0,0,0.3)', textAlign: 'center' },
  successTop:   { position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: 16 },
  successRing:  { width: 80, height: 80, borderRadius: '50%', background: '#dcfce7', border: '5px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  confetti:     { position: 'absolute', top: -6, right: 70, fontSize: 30 },
  successTitle: { margin: '0 0 5px', fontSize: 22, fontWeight: 800, color: '#15803d' },
  successSub:   { margin: '0 0 20px', fontSize: 13, color: '#64748b' },

  successIds:   { display: 'flex', gap: 10, marginBottom: 18, justifyContent: 'center' },
  idBadge:      { flex: 1, borderRadius: 12, padding: '10px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 },
  idIcon:       { fontSize: 20 },
  idValue:      { fontSize: 13, fontWeight: 800, fontFamily: 'monospace', letterSpacing: '0.04em' },
  idLabel:      { fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' },

  successDetails:{ background: '#f8fafc', borderRadius: 12, padding: '4px 14px', marginBottom: 20, textAlign: 'left' },
  detailRow:     { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f1f5f9' },
  detailIcon:    { fontSize: 16, width: 22, textAlign: 'center' },
  detailLabel:   { fontSize: 12, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', flex: 1 },
  detailValue:   { fontSize: 13, fontWeight: 600, color: '#1e293b' },

  successBtns:   { display: 'flex', gap: 10 },
  anotherBtn:    { flex: 1, padding: '12px', background: '#f0fdf4', color: '#15803d', border: '1.5px solid #86efac', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  goListBtn:     { flex: 1, padding: '12px', background: 'linear-gradient(135deg,#059669,#34d399)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' },
};

const sc = {
  card:   { background: '#fff', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: 16, overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #f8fafc', background: '#fafbfc' },
  badge:  { width: 30, height: 30, borderRadius: '50%', color: '#fff', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title:  { margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' },
  sub:    { fontSize: 12, color: '#94a3b8', marginTop: 1 },
  body:   { padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 },
};
