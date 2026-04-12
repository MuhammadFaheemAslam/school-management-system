import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const DESIGNATION_META = {
  head_teacher:       { label: 'Head Teacher',       bg: '#fef3c7', color: '#92400e', icon: '👑' },
  senior_teacher:     { label: 'Senior Teacher',     bg: '#ede9fe', color: '#6d28d9', icon: '🎓' },
  junior_teacher:     { label: 'Junior Teacher',     bg: '#eff6ff', color: '#1d4ed8', icon: '📚' },
  subject_specialist: { label: 'Subject Specialist', bg: '#ecfdf5', color: '#065f46', icon: '🔬' },
  visiting_teacher:   { label: 'Visiting Teacher',   bg: '#fff7ed', color: '#c2410c', icon: '🔄' },
};

const AVATAR_COLORS = ['#6366f1','#0891b2','#059669','#d97706','#db2777','#7c3aed','#dc2626','#0284c7'];
function avatarColor(name) { return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]; }
function initials(name) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function TeachersPage() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const canManage = ['super_admin', 'school_admin', 'principal'].includes(user?.role);

  // Teachers cannot access this page — redirect to their own profile
  useEffect(() => {
    if (user?.role === 'teacher') navigate('/teachers/me', { replace: true });
  }, [user]);

  if (user?.role === 'teacher') return null;

  const [teachers,  setTeachers]  = useState([]);
  const [subjects,  setSubjects]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [filterDes, setFilterDes] = useState('');
  const [filterAct, setFilterAct] = useState('active');

  const [showModal, setShowModal] = useState(false);
  const [panelSuccess, setPanelSuccess] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/teachers/'),
      api.get('/courses/subjects/'),
    ]).then(([t, s]) => {
      setTeachers(t.data);
      setSubjects(s.data);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = teachers.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${t.full_name} ${t.employee_id} ${t.email} ${t.designation}`.toLowerCase().includes(q);
    const matchDes    = !filterDes || t.designation === filterDes;
    const matchAct    = filterAct === 'all' || (filterAct === 'active' ? t.is_active : !t.is_active);
    return matchSearch && matchDes && matchAct;
  });

  const stats = {
    total:        teachers.length,
    active:       teachers.filter(t => t.is_active).length,
    classTeachers: teachers.filter(t => t.class_teacher_of?.length > 0).length,
  };

  return (
    <div style={s.page}>

      {/* ── Header ── */}
      <div style={s.header}>
        <div>
          <h1 style={s.pageTitle}>Teachers</h1>
          <p style={s.pageSub}>Manage teaching staff and their assignments</p>
        </div>
        {canManage && (
          <button style={s.addBtn} onClick={() => { setShowModal(true); setPanelSuccess(null); }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            Add Teacher
          </button>
        )}
      </div>

      {/* ── Stats ── */}
      <div style={s.statsRow}>
        {[
          { label: 'Total Teachers', value: stats.total,        icon: '👨‍🏫', color: '#6366f1', bg: '#ede9fe' },
          { label: 'Active',         value: stats.active,       icon: '✅',  color: '#059669', bg: '#ecfdf5' },
          { label: 'Class Teachers', value: stats.classTeachers,icon: '🏫',  color: '#0891b2', bg: '#ecfeff' },
        ].map(stat => (
          <div key={stat.label} style={s.statCard}>
            <div style={{ ...s.statIcon, background: stat.bg, color: stat.color }}>{stat.icon}</div>
            <div>
              <div style={{ ...s.statValue, color: stat.color }}>{stat.value}</div>
              <div style={s.statLabel}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={s.filterRow}>
        <div style={s.searchWrap}>
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/>
          </svg>
          <input style={s.searchInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, employee ID, email…" />
        </div>
        <select style={s.select} value={filterDes} onChange={e => setFilterDes(e.target.value)}>
          <option value="">All Designations</option>
          {Object.entries(DESIGNATION_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
        </select>
        <div style={s.toggleGroup}>
          {[['active','Active'],['inactive','Inactive'],['all','All']].map(([v, l]) => (
            <button key={v} onClick={() => setFilterAct(v)}
              style={{ ...s.toggleBtn, ...(filterAct === v ? s.toggleBtnActive : {}) }}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── Grid ── */}
      {loading ? (
        <div style={s.emptyState}><div style={s.spinner}/><p style={{ color: '#94a3b8' }}>Loading teachers…</p></div>
      ) : filtered.length === 0 ? (
        <div style={s.emptyState}>
          <div style={{ fontSize: 48 }}>👨‍🏫</div>
          <p style={{ color: '#94a3b8', margin: 0 }}>
            {search || filterDes || filterAct === 'inactive'
              ? 'No teachers match your filters.'
              : 'No teachers added yet.'}
          </p>
          {canManage && !search && !filterDes && filterAct !== 'inactive' && (
            <button style={s.addBtn} onClick={() => { setShowModal(true); setPanelSuccess(null); }}>+ Add First Teacher</button>
          )}
        </div>
      ) : (
        <div style={s.grid}>
          {filtered.map(t => {
            const des  = DESIGNATION_META[t.designation] || DESIGNATION_META.junior_teacher;
            const color = avatarColor(t.full_name);
            const isClassTeacher = t.class_teacher_of?.length > 0;
            return (
              <div key={t.id} style={{ ...s.card, opacity: t.is_active ? 1 : 0.65 }}
                onClick={() => navigate(`/teachers/${t.id}`)}
              >
                {/* Top bar */}
                <div style={{ ...s.cardAccent, background: color }} />

                {/* Inactive ribbon */}
                {!t.is_active && (
                  <div style={s.inactiveRibbon}>Inactive</div>
                )}

                {/* Avatar + name */}
                <div style={s.cardHead}>
                  <div style={{ ...s.avatar, background: color }}>
                    {initials(t.full_name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={s.cardName}>{t.full_name}</div>
                    <div style={s.cardEmpId}>{t.employee_id}</div>
                  </div>
                </div>

                {/* Designation badge */}
                <div style={{ ...s.desBadge, background: des.bg, color: des.color }}>
                  {des.icon} {des.label}
                </div>

                {/* Info rows */}
                <div style={s.cardInfo}>
                  {t.email && <div style={s.cardInfoRow}><span>✉</span><span style={s.cardInfoVal}>{t.email}</span></div>}
                  {t.phone_number && <div style={s.cardInfoRow}><span>📞</span><span style={s.cardInfoVal}>{t.phone_number}</span></div>}
                  {t.qualification && <div style={s.cardInfoRow}><span>🎓</span><span style={s.cardInfoVal}>{t.qualification.toUpperCase()}</span></div>}
                </div>

                {/* Subjects */}
                {t.subjects_detail?.length > 0 && (
                  <div style={s.subjectRow}>
                    {t.subjects_detail.slice(0, 3).map(sub => (
                      <span key={sub.id} style={s.subBadge}>{sub.name}</span>
                    ))}
                    {t.subjects_detail.length > 3 && (
                      <span style={s.subMore}>+{t.subjects_detail.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Class teacher badge */}
                {isClassTeacher && (
                  <div style={s.classTeacherBadge}>
                    🏫 Class Teacher — {t.class_teacher_of.map(c => `${c.course_name}${c.name ? ' ' + c.name : ''}`).join(', ')}
                  </div>
                )}

                <div style={s.viewHint}>Click to view profile →</div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Teacher Panel ── */}
      {showModal && (
        <AddTeacherPanel
          subjects={subjects}
          onClose={() => setShowModal(false)}
          onCreated={teacher => {
            setTeachers(prev => [teacher, ...prev]);
            setPanelSuccess(teacher);
          }}
          success={panelSuccess}
          onReset={() => setPanelSuccess(null)}
        />
      )}
    </div>
  );
}

function emptyForm() {
  return {
    first_name: '', last_name: '', username: '', email: '',
    designation: 'junior_teacher', qualification: '', gender: '',
    date_of_birth: '', date_of_joining: '', cnic: '', phone_number: '', address: '',
    subjects: [],
    basic_salary: '', payment_mode: 'cash', bank_name: '', bank_account_number: '',
    class_section: '',
  };
}

/* ─────────────────────────────────────────────
   Add Teacher Full-Screen Panel
───────────────────────────────────────────── */
function AddTeacherPanel({ subjects, onClose, onCreated, success, onReset }) {
  const [form,     setForm]     = useState(emptyForm());
  const [saving,   setSaving]   = useState(false);
  const [errors,   setErrors]   = useState({});
  const [sections, setSections] = useState([]);

  useEffect(() => {
    api.get('/courses/sections/').then(r => setSections(r.data)).catch(() => {});
  }, []);

  const previewName  = [form.first_name, form.last_name].filter(Boolean).join(' ') || 'Teacher Name';
  const previewColor = avatarColor(previewName);
  const previewDes   = DESIGNATION_META[form.designation] || DESIGNATION_META.junior_teacher;

  const toggleSubject = (id) =>
    setForm(f => ({ ...f, subjects: f.subjects.includes(id) ? f.subjects.filter(s => s !== id) : [...f.subjects, id] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({}); setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.date_of_birth)   delete payload.date_of_birth;
      if (!payload.date_of_joining) delete payload.date_of_joining;
      if (!payload.cnic)            delete payload.cnic;
      delete payload.class_section;
      const res = await api.post('/teachers/create/', payload);
      const teacher = res.data;
      // Assign class incharge (optional)
      if (form.class_section) {
        await api.put(`/courses/sections/${form.class_section}/`, { class_teacher: teacher.id });
        const sec = sections.find(s => s.id === Number(form.class_section));
        onCreated({ ...teacher, class_teacher_of: sec ? [{ id: sec.id, name: sec.name, course_name: sec.course_name, session_name: sec.session_name }] : teacher.class_teacher_of });
      } else {
        onCreated(teacher);
      }
    } catch (err) {
      const d = err.response?.data || {};
      if (d.error) setErrors({ general: d.error });
      else setErrors(d);
    } finally { setSaving(false); }
  };

  const selectedSubjects = subjects.filter(s => form.subjects.includes(s.id));

  return (
    <div style={p.overlay}>
      <div style={p.panel}>

        {/* ── Left: Preview Pane ── */}
        <div style={p.left}>
          <div style={p.leftBg} />
          <div style={p.leftContent}>
            <div style={p.brandRow}>
              <div style={p.brandDot} />
              <span style={p.brandText}>New Teacher</span>
            </div>

            {success ? (
              /* Success state left panel */
              <div style={p.previewCard}>
                <div style={{ ...p.bigAvatar, background: avatarColor(success.full_name) }}>
                  {initials(success.full_name)}
                </div>
                <div style={p.previewName}>{success.full_name}</div>
                <div style={p.previewEmpId}>{success.employee_id}</div>
                <div style={{ ...p.previewDesBadge, background: (DESIGNATION_META[success.designation]||DESIGNATION_META.junior_teacher).bg, color: (DESIGNATION_META[success.designation]||DESIGNATION_META.junior_teacher).color }}>
                  {(DESIGNATION_META[success.designation]||DESIGNATION_META.junior_teacher).icon}{' '}
                  {(DESIGNATION_META[success.designation]||DESIGNATION_META.junior_teacher).label}
                </div>
                {success.subjects_detail?.length > 0 && (
                  <div style={p.previewSubjects}>
                    {success.subjects_detail.map(sub => (
                      <span key={sub.id} style={p.previewSubBadge}>{sub.name}</span>
                    ))}
                  </div>
                )}
                <div style={p.successCheckCircle}>✓</div>
                <div style={p.successLabel}>Profile Created!</div>
              </div>
            ) : (
              /* Live preview card */
              <div style={p.previewCard}>
                <div style={{ ...p.bigAvatar, background: previewColor }}>
                  {initials(previewName)}
                </div>
                <div style={p.previewName}>{previewName}</div>
                {form.username && <div style={p.previewUsername}>@{form.username}</div>}
                <div style={{ ...p.previewDesBadge, background: previewDes.bg, color: previewDes.color }}>
                  {previewDes.icon} {previewDes.label}
                </div>
                {form.email && <div style={p.previewMeta}>✉ {form.email}</div>}
                {form.phone_number && <div style={p.previewMeta}>📞 {form.phone_number}</div>}
                {selectedSubjects.length > 0 && (
                  <div style={p.previewSubjects}>
                    {selectedSubjects.map(sub => (
                      <span key={sub.id} style={p.previewSubBadge}>{sub.name}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={p.leftHint}>
              {success ? 'Share the credentials below with the teacher.' : 'Preview updates as you type.'}
            </div>
          </div>
        </div>

        {/* ── Right: Form Pane ── */}
        <div style={p.right}>
          {/* Header */}
          <div style={p.rightHeader}>
            <div>
              <div style={p.rightTitle}>{success ? '🎉 Teacher Added!' : 'Add New Teacher'}</div>
              <div style={p.rightSub}>{success ? 'The teacher account has been created.' : 'Fill in the details to register a new teacher.'}</div>
            </div>
            <button style={p.closeBtn} onClick={onClose} title="Close">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {success ? (
            /* Success summary */
            <div style={p.rightBody}>
              <div style={p.successSummary}>
                <InfoRow icon="👤" label="Full Name"    value={success.full_name} />
                <InfoRow icon="🆔" label="Username"     value={`@${success.username}`} />
                <InfoRow icon="🏷" label="Employee ID"  value={success.employee_id} mono violet />
                <InfoRow icon="💼" label="Designation"  value={(DESIGNATION_META[success.designation]||DESIGNATION_META.junior_teacher).label} />
                {success.email && <InfoRow icon="✉"  label="Email"  value={success.email} />}
              </div>

              {success.temp_password && (
                <div style={p.passBox}>
                  <div style={p.passBoxLabel}>🔑 Temporary Password</div>
                  <div style={p.passCode}>{success.temp_password}</div>
                  <div style={p.passNote}>Share this with the teacher. They must change it on first login.</div>
                </div>
              )}

              <div style={p.successActions}>
                <button style={p.outlineBtn} onClick={() => { onReset(); setForm(emptyForm()); setErrors({}); }}>
                  + Add Another Teacher
                </button>
                <button style={p.primaryBtn} onClick={onClose}>Done</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={p.rightBody}>

              {/* Section: Login Account */}
              <PSection icon="🔐" title="Login Account" color="#6366f1">
                <div style={p.grid2}>
                  <PField label="First Name" required error={errors.first_name}>
                    <input style={p.input} value={form.first_name} placeholder="Ahmed"
                      onChange={e => {
                        const first = e.target.value;
                        setForm(f => ({ ...f, first_name: first, username: `${first}.${f.last_name}`.toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9.]/g,'') }));
                      }} />
                  </PField>
                  <PField label="Last Name" required error={errors.last_name}>
                    <input style={p.input} value={form.last_name} placeholder="Khan"
                      onChange={e => {
                        const last = e.target.value;
                        setForm(f => ({ ...f, last_name: last, username: `${f.first_name}.${last}`.toLowerCase().replace(/\s+/g,'').replace(/[^a-z0-9.]/g,'') }));
                      }} />
                  </PField>
                </div>
                <div style={p.grid2}>
                  <PField label="Username" required error={errors.username} hint="Auto-filled — editable">
                    <div style={p.inputWrap}>
                      <span style={p.inputPrefix}>@</span>
                      <input style={{ ...p.input, paddingLeft: 26, flex: 1 }} value={form.username} placeholder="ahmed.khan"
                        onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
                    </div>
                  </PField>
                  <PField label="Email Address" required error={errors.email}>
                    <input style={p.input} type="email" value={form.email} placeholder="ahmed@school.com"
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </PField>
                </div>
                <div style={p.infoNote}>
                  <span style={{ fontSize: 14 }}>🔑</span>
                  <span>A temporary password will be auto-generated. The teacher must change it on first login.</span>
                </div>
              </PSection>

              {/* Section: Employment */}
              <PSection icon="💼" title="Employment Details" color="#0891b2">
                <div style={p.grid2}>
                  <PField label="Designation" error={errors.designation}>
                    <select style={p.input} value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}>
                      {Object.entries(DESIGNATION_META).map(([v, m]) => (
                        <option key={v} value={v}>{m.icon} {m.label}</option>
                      ))}
                    </select>
                  </PField>
                  <PField label="Qualification" error={errors.qualification}>
                    <select style={p.input} value={form.qualification} onChange={e => setForm(f => ({ ...f, qualification: e.target.value }))}>
                      <option value="">— Select —</option>
                      {[['matric','Matric'],['intermediate','Intermediate'],['ba','BA'],['bsc','BSc'],['bed','B.Ed'],['ma','MA'],['msc','MSc'],['med','M.Ed'],['mphil','M.Phil'],['phd','PhD'],['other','Other']].map(([v,l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </PField>
                </div>
                <PField label="Date of Joining" error={errors.date_of_joining} style={{ maxWidth: 220 }}>
                  <input style={{ ...p.input, maxWidth: 220 }} type="date" value={form.date_of_joining} onChange={e => setForm(f => ({ ...f, date_of_joining: e.target.value }))} />
                </PField>
              </PSection>

              {/* Section: Personal */}
              <PSection icon="👤" title="Personal Information" color="#059669">
                <div style={p.grid2}>
                  <PField label="Gender" error={errors.gender}>
                    <select style={p.input} value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                      <option value="">— Select —</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </PField>
                  <PField label="Date of Birth" error={errors.date_of_birth}>
                    <input style={p.input} type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} />
                  </PField>
                </div>
                <div style={p.grid2}>
                  <PField label="CNIC" error={errors.cnic}>
                    <input style={p.input} value={form.cnic} placeholder="12345-1234567-1" onChange={e => setForm(f => ({ ...f, cnic: e.target.value }))} />
                  </PField>
                  <PField label="Phone Number" error={errors.phone_number}>
                    <input style={p.input} value={form.phone_number} placeholder="+92 300 0000000" onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} />
                  </PField>
                </div>
                <PField label="Address" error={errors.address}>
                  <input style={p.input} value={form.address} placeholder="Home address" onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </PField>
              </PSection>

              {/* Section: Subjects */}
              {subjects.length > 0 && (
                <PSection icon="📚" title="Assign Subjects" color="#d97706">
                  <div style={p.subGrid}>
                    {subjects.map(sub => {
                      const on = form.subjects.includes(sub.id);
                      return (
                        <button key={sub.id} type="button" onClick={() => toggleSubject(sub.id)}
                          style={{ ...p.subToggle, ...(on ? p.subToggleOn : {}) }}>
                          {on && <span style={{ marginRight: 4, fontSize: 11 }}>✓</span>}
                          {sub.name}
                          {sub.course_name && <span style={{ fontSize: 10, opacity: 0.65, marginLeft: 3 }}>({sub.course_name})</span>}
                        </button>
                      );
                    })}
                  </div>
                  {form.subjects.length > 0 && (
                    <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', padding: '6px 10px', borderRadius: 7, marginTop: 4 }}>
                      {form.subjects.length} subject{form.subjects.length > 1 ? 's' : ''} selected
                    </div>
                  )}
                </PSection>
              )}

              {/* Section: Salary */}
              <PSection icon="💰" title="Salary & Payment" color="#7c3aed">
                <div style={p.grid2}>
                  <PField label="Monthly Basic Salary (Rs)" error={errors.basic_salary}>
                    <input style={p.input} type="number" min="0" value={form.basic_salary}
                      onChange={e => setForm(f => ({ ...f, basic_salary: e.target.value }))} placeholder="e.g. 25000" />
                  </PField>
                  <PField label="Payment Mode" error={errors.payment_mode}>
                    <select style={p.input} value={form.payment_mode} onChange={e => setForm(f => ({ ...f, payment_mode: e.target.value }))}>
                      <option value="cash">💵 Cash</option>
                      <option value="bank_transfer">🏦 Bank Transfer</option>
                    </select>
                  </PField>
                </div>
                {form.payment_mode === 'bank_transfer' && (
                  <div style={p.grid2}>
                    <PField label="Bank Name" error={errors.bank_name}>
                      <input style={p.input} value={form.bank_name}
                        onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="e.g. HBL, UBL" />
                    </PField>
                    <PField label="Account Number" error={errors.bank_account_number}>
                      <input style={p.input} value={form.bank_account_number}
                        onChange={e => setForm(f => ({ ...f, bank_account_number: e.target.value }))} placeholder="Account number" />
                    </PField>
                  </div>
                )}
              </PSection>

              {/* Section: Class Incharge (optional) */}
              <PSection icon="🏫" title="Class Incharge" color="#0891b2">
                <PField label="Assign as Class Incharge" hint="Optional — leave blank if not assigned yet">
                  <select style={p.input} value={form.class_section}
                    onChange={e => setForm(f => ({ ...f, class_section: e.target.value }))}>
                    <option value="">— Not assigned —</option>
                    {sections.map(sec => {
                      const label = [sec.course_name, sec.name ? `Section ${sec.name}` : null, sec.session_name].filter(Boolean).join(' · ');
                      return (
                        <option key={sec.id} value={sec.id}>
                          {label}{sec.class_teacher_name ? ` (currently: ${sec.class_teacher_name})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </PField>
                {form.class_section && (() => {
                  const sec = sections.find(s => s.id === Number(form.class_section));
                  return sec?.class_teacher_name ? (
                    <div style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', padding: '7px 12px', borderRadius: 8 }}>
                      ⚠ This class currently has <strong>{sec.class_teacher_name}</strong> as incharge. Saving will replace them.
                    </div>
                  ) : null;
                })()}
              </PSection>

              {errors.general && (
                <div style={p.errorBox}>
                  <span style={{ fontSize: 15 }}>⚠</span>
                  {errors.general}
                </div>
              )}

              <div style={p.formFooter}>
                <button type="button" style={p.outlineBtn} onClick={onClose}>Cancel</button>
                <button type="submit" style={p.primaryBtn} disabled={saving}>
                  {saving ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={p.btnSpinner} /> Creating…
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                      </svg>
                      Create Teacher
                    </span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function PSection({ icon, title, color, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 3, height: 18, background: color, borderRadius: 2, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', letterSpacing: '0.1px' }}>
          {icon} {title}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

function PField({ label, required, error, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: error ? '#dc2626' : '#374151' }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {error && <span style={{ fontSize: 11, color: '#dc2626' }}>{Array.isArray(error) ? error[0] : error}</span>}
      {!error && hint && <span style={{ fontSize: 11, color: '#94a3b8' }}>{hint}</span>}
    </div>
  );
}

function InfoRow({ icon, label, value, mono, violet }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500, width: 90, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: violet ? '#6d28d9' : '#0f172a', fontFamily: mono ? 'monospace' : 'inherit', background: violet ? '#ede9fe' : 'transparent', padding: violet ? '1px 7px' : 0, borderRadius: 4 }}>{value}</span>
    </div>
  );
}

/* Panel styles */
const p = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', zIndex: 1000 },
  panel:   { display: 'flex', width: '100%', maxWidth: 960, background: '#fff', boxShadow: '-8px 0 40px rgba(0,0,0,0.18)', overflow: 'hidden' },

  /* Left preview pane */
  left:        { width: 280, flexShrink: 0, background: 'linear-gradient(160deg,#1e1b4b 0%,#312e81 50%,#4338ca 100%)', position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  leftBg:      { position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 80% 20%,rgba(167,139,250,0.25) 0%,transparent 60%),radial-gradient(circle at 20% 80%,rgba(99,102,241,0.3) 0%,transparent 50%)' },
  leftContent: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px', gap: 20, flex: 1 },
  brandRow:    { display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  brandDot:    { width: 8, height: 8, borderRadius: '50%', background: '#a5b4fc' },
  brandText:   { fontSize: 11, fontWeight: 700, color: '#a5b4fc', letterSpacing: '1.5px', textTransform: 'uppercase' },

  previewCard: { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 16, padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%', backdropFilter: 'blur(8px)' },
  bigAvatar:   { width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 26, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' },
  previewName: { fontSize: 16, fontWeight: 700, color: '#fff', textAlign: 'center' },
  previewUsername: { fontSize: 12, color: '#a5b4fc', fontFamily: 'monospace' },
  previewDesBadge: { padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 },
  previewMeta: { fontSize: 12, color: '#c7d2fe', textAlign: 'center' },
  previewSubjects: { display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginTop: 4 },
  previewSubBadge: { background: 'rgba(165,180,252,0.2)', color: '#c7d2fe', border: '1px solid rgba(165,180,252,0.3)', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 },
  leftHint:    { fontSize: 11, color: '#818cf8', textAlign: 'center', fontStyle: 'italic' },

  successCheckCircle: { width: 44, height: 44, borderRadius: '50%', background: 'rgba(34,197,94,0.2)', border: '2px solid rgba(34,197,94,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#86efac' },
  successLabel: { fontSize: 13, fontWeight: 700, color: '#86efac' },

  /* Right form pane */
  right:       { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 },
  rightHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 28px 18px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 },
  rightTitle:  { fontSize: 20, fontWeight: 800, color: '#0f172a' },
  rightSub:    { fontSize: 13, color: '#64748b', marginTop: 3 },
  closeBtn:    { width: 34, height: 34, border: '1.5px solid #e2e8f0', borderRadius: 9, background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexShrink: 0, fontFamily: 'inherit' },

  rightBody:   { flex: 1, overflow: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 },

  grid2:  { display: 'flex', gap: 14, flexWrap: 'wrap' },
  input:  { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none', color: '#1e293b', transition: 'border-color 0.15s' },
  inputWrap:   { position: 'relative', display: 'flex', alignItems: 'center', flex: 1 },
  inputPrefix: { position: 'absolute', left: 10, fontSize: 13, color: '#94a3b8', pointerEvents: 'none', fontWeight: 600 },

  infoNote: { display: 'flex', alignItems: 'flex-start', gap: 8, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#0369a1', lineHeight: 1.5 },

  subGrid:     { display: 'flex', flexWrap: 'wrap', gap: 7 },
  subToggle:   { padding: '6px 12px', borderRadius: 20, border: '1.5px solid #e2e8f0', background: '#f8fafc', fontSize: 12, fontWeight: 600, color: '#64748b', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s', display: 'flex', alignItems: 'center' },
  subToggleOn: { background: '#ede9fe', border: '1.5px solid #c4b5fd', color: '#6d28d9' },


  errorBox:  { display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '10px 14px', fontSize: 13, color: '#dc2626' },
  formFooter:{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 },

  primaryBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' },
  outlineBtn: { padding: '10px 18px', background: '#fff', color: '#334155', border: '1.5px solid #e2e8f0', borderRadius: 9, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  btnSpinner: { width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' },

  successSummary: { background: '#f8fafc', borderRadius: 12, padding: '4px 16px' },
  passBox:    { background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 },
  passBoxLabel:{ fontSize: 12, fontWeight: 700, color: '#92400e' },
  passCode:   { fontFamily: 'monospace', fontSize: 24, fontWeight: 800, color: '#92400e', letterSpacing: 3, textAlign: 'center', padding: '8px 0' },
  passNote:   { fontSize: 11, color: '#b45309', textAlign: 'center' },
  successActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
};


const s = {
  page:       { fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  pageTitle:  { margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' },
  pageSub:    { margin: '4px 0 0', fontSize: 14, color: '#64748b' },

  addBtn: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 2px 8px rgba(99,102,241,0.35)', fontFamily: 'inherit' },

  statsRow:   { display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' },
  statCard:   { display: 'flex', alignItems: 'center', gap: 14, background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flex: '1 1 160px' },
  statIcon:   { width: 42, height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  statValue:  { fontSize: 24, fontWeight: 800, lineHeight: 1 },
  statLabel:  { fontSize: 12, color: '#64748b', marginTop: 2 },

  filterRow:  { display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '9px 14px', flex: '1 1 250px' },
  searchInput:{ border: 'none', outline: 'none', fontSize: 14, color: '#1e293b', background: 'transparent', width: '100%', fontFamily: 'inherit' },
  select:     { padding: '9px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: '#334155' },
  toggleGroup:{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3, gap: 2 },
  toggleBtn:  { padding: '6px 14px', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: 'transparent', color: '#64748b', fontFamily: 'inherit' },
  toggleBtnActive: { background: '#fff', color: '#1e293b', fontWeight: 700, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },

  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '60px 24px', color: '#94a3b8' },
  spinner:    { width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },

  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 18 },

  card:       { background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 10, padding: '18px 18px 14px', transition: 'box-shadow 0.15s, transform 0.15s' },
  cardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  cardHead:   { display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 },
  avatar:     { width: 46, height: 46, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0 },
  cardName:   { fontSize: 15, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  cardEmpId:  { fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 },
  desBadge:   { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, alignSelf: 'flex-start' },
  cardInfo:   { display: 'flex', flexDirection: 'column', gap: 4 },
  cardInfoRow:{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748b' },
  cardInfoVal:{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  subjectRow: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  subBadge:   { background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 },
  subMore:    { background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: 20, fontSize: 11 },
  classTeacherBadge: { background: '#ecfeff', color: '#0891b2', border: '1px solid #a5f3fc', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 600 },
  inactiveRibbon: { position: 'absolute', top: 10, right: -18, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 24px', transform: 'rotate(35deg)', letterSpacing: '0.5px' },
  viewHint:   { fontSize: 11, color: '#cbd5e1', textAlign: 'right', marginTop: 4 },

};
