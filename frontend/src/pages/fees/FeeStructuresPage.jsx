import { useEffect, useState } from 'react';
import api from '../../services/api';

if (typeof document !== 'undefined' && !document.getElementById('fsp-spin')) {
  const st = document.createElement('style');
  st.id = 'fsp-spin';
  st.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(st);
}

const FEE_FIELDS = [
  { value: 'tuition_fee',   label: 'Tuition Fee',     color: '#6366f1', bg: '#eef2ff' },
  { value: 'transport_fee', label: 'Transport Fee',    color: '#0891b2', bg: '#ecfeff' },
  { value: 'all_monthly',   label: 'All Monthly',      color: '#d97706', bg: '#fffbeb' },
  { value: 'all',           label: 'All Fee Heads',    color: '#dc2626', bg: '#fef2f2' },
];

const emptyForm = {
  tuition_fee: '', transport_fee: '', registration_fee: '',
  books_fee: '', exam_fee: '', note: '',
};

const emptyRevision = {
  revision_type: 'fixed', fee_field: 'tuition_fee',
  amount: '', applied_to_all: true, course_ids: [], note: '',
};

function fmt(n) {
  const num = Number(n);
  if (!num) return <span style={{ color: '#cbd5e1' }}>—</span>;
  return <span>PKR {num.toLocaleString()}</span>;
}

// Class color palette (cycles)
const CLASS_COLORS = [
  ['#6366f1', '#eef2ff'], ['#0891b2', '#ecfeff'], ['#059669', '#f0fdf4'],
  ['#d97706', '#fffbeb'], ['#dc2626', '#fef2f2'], ['#7c3aed', '#f5f3ff'],
  ['#0d9488', '#f0fdfa'], ['#db2777', '#fdf2f8'],
];

export default function FeeStructuresPage({ embedded = false }) {
  const [sessions,   setSessions]   = useState([]);
  const [courses,    setCourses]    = useState([]);
  const [structures, setStructures] = useState([]);
  const [revisions,  setRevisions]  = useState([]);
  const [session,    setSession]    = useState('');
  const [loading,    setLoading]    = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [showForm,   setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form,       setForm]       = useState(emptyForm);
  const [formCourse, setFormCourse] = useState('');
  const [saving,     setSaving]     = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const [showRevision, setShowRevision] = useState(false);
  const [revision,     setRevision]     = useState(emptyRevision);
  const [revising,     setRevising]     = useState(false);
  const [revisionMsg,  setRevisionMsg]  = useState('');
  const [previewMode,  setPreviewMode]  = useState(false);

  useEffect(() => {
    Promise.all([api.get('/courses/sessions/'), api.get('/courses/')]).then(([s, c]) => {
      setSessions(s.data);
      setCourses(c.data);
      const active = s.data.find(x => x.is_active);
      if (active) setSession(String(active.id));
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    Promise.all([
      api.get(`/fees/class-structures/?session=${session}`),
      api.get('/fees/revisions/'),
    ]).then(([st, rv]) => {
      setStructures(st.data);
      setRevisions(rv.data);
    }).finally(() => setLoading(false));
  }, [session]);

  const coursesWithoutStructure = courses.filter(
    c => !structures.find(s => String(s.course) === String(c.id))
  );

  const openCreate = (course = null) => {
    setEditTarget(null);
    setFormCourse(course ? String(course.id) : '');
    setForm(emptyForm);
    setFormErrors({});
    setShowForm(true);
  };

  const openEdit = (st) => {
    setEditTarget(st);
    setFormCourse(String(st.course));
    setForm({
      tuition_fee: st.tuition_fee, transport_fee: st.transport_fee,
      registration_fee: st.registration_fee, books_fee: st.books_fee,
      exam_fee: st.exam_fee, note: st.note,
    });
    setFormErrors({});
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!formCourse) errs.course = 'Select a class.';
    if (!form.tuition_fee && form.tuition_fee !== 0) errs.tuition_fee = 'Required.';
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setSaving(true);
    try {
      const feeFields = ['tuition_fee', 'transport_fee', 'registration_fee', 'books_fee', 'exam_fee'];
      const payload = {
        ...form,
        ...Object.fromEntries(feeFields.map(f => [f, form[f] === '' ? 0 : form[f]])),
        course: formCourse, session,
      };
      if (editTarget) {
        const res = await api.put(`/fees/class-structures/${editTarget.id}/`, payload);
        setStructures(prev => prev.map(s => s.id === editTarget.id ? res.data : s));
      } else {
        const res = await api.post('/fees/class-structures/create/', payload);
        setStructures(prev => [...prev, res.data]);
      }
      setShowForm(false);
    } catch (err) {
      const d = err.response?.data;
      if (d && typeof d === 'object') setFormErrors(d);
      else setFormErrors({ general: 'Failed to save.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (st) => {
    if (!window.confirm(`Remove fee structure for ${st.course_name}?`)) return;
    await api.delete(`/fees/class-structures/${st.id}/`);
    setStructures(prev => prev.filter(s => s.id !== st.id));
  };

  const previewRevision = () => {
    if (!revision.amount || isNaN(Number(revision.amount)) || Number(revision.amount) <= 0) return;
    setPreviewMode(true);
  };

  const calcPreview = (current) => {
    const amt = Number(revision.amount);
    if (revision.revision_type === 'percentage') return Math.round(Number(current) * (1 + amt / 100));
    return Math.round(Number(current) + amt);
  };

  const getRevisionTargets = () => revision.applied_to_all
    ? structures
    : structures.filter(s => revision.course_ids.includes(String(s.course)));

  const toggleCourse = (courseId) => {
    const id = String(courseId);
    setRevision(r => ({
      ...r,
      course_ids: r.course_ids.includes(id) ? r.course_ids.filter(x => x !== id) : [...r.course_ids, id],
    }));
  };

  const handleRevise = async () => {
    setRevising(true); setRevisionMsg('');
    try {
      const payload = { ...revision, session, amount: Number(revision.amount) };
      const res = await api.post('/fees/class-structures/revise/', payload);
      setRevisionMsg(`✅ ${res.data.message}`);
      const [updated, logs] = await Promise.all([
        api.get(`/fees/class-structures/?session=${session}`),
        api.get('/fees/revisions/'),
      ]);
      setStructures(updated.data);
      setRevisions(logs.data);
      setPreviewMode(false);
      setTimeout(() => { setShowRevision(false); setRevisionMsg(''); setRevision(emptyRevision); }, 1500);
    } catch (err) {
      setRevisionMsg(`❌ ${err.response?.data?.error || 'Revision failed.'}`);
    } finally {
      setRevising(false);
    }
  };

  const targets = getRevisionTargets();
  const currentSession = sessions.find(s => String(s.id) === session);
  const totalMonthly = structures.reduce((s, st) => s + Number(st.total_monthly || 0), 0);
  const totalOnetime = structures.reduce((s, st) => s + Number(st.total_onetime || 0), 0);

  return (
    <div style={p.page}>

      {/* ── Page header ─────────────────────────────────────── */}
      <div style={p.header}>
        <div>
          <h1 style={p.title}>Fee Structures</h1>
          <p style={p.sub}>Configure class-level fees · Apply bulk revisions · Auto-fill on enrollment</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={p.histBtn} onClick={() => setShowHistory(h => !h)}>
            {showHistory ? '▲ Hide History' : '📜 Revision History'}
            {revisions.length > 0 && <span style={p.badge}>{revisions.length}</span>}
          </button>
          <button style={p.reviseBtn} onClick={() => { setShowRevision(true); setPreviewMode(false); setRevisionMsg(''); setRevision(emptyRevision); }}>
            📈 Bulk Revision
          </button>
          <button
            style={{ ...p.addBtn, opacity: coursesWithoutStructure.length === 0 ? 0.5 : 1, cursor: coursesWithoutStructure.length === 0 ? 'not-allowed' : 'pointer' }}
            onClick={() => coursesWithoutStructure.length > 0 && openCreate()}
          >
            {coursesWithoutStructure.length === 0
              ? '✅ All Classes Set'
              : `+ Set Class Fees  ${coursesWithoutStructure.length} remaining`}
          </button>
        </div>
      </div>

      {/* ── Session tabs ─────────────────────────────────────── */}
      <div style={p.sessionRow}>
        <span style={p.sessionLabel}>Academic Session</span>
        <div style={p.sessionTabs}>
          {sessions.map(sess => {
            const active = String(sess.id) === session;
            return (
              <button key={sess.id} onClick={() => setSession(String(sess.id))}
                style={{ ...p.sessionTab, ...(active ? p.sessionTabActive : {}) }}>
                {sess.name}
                {sess.is_active && <span style={p.activePip} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Summary strip ────────────────────────────────────── */}
      {!loading && structures.length > 0 && (
        <div style={p.statsRow}>
          <StatPill icon="🏫" label="Classes Configured" value={structures.length} color="#6366f1" />
          <StatPill icon="⚠️" label="Not Set" value={coursesWithoutStructure.length} color={coursesWithoutStructure.length > 0 ? '#f97316' : '#22c55e'} />
          <StatPill icon="📅" label="Avg Monthly / Student" value={`PKR ${structures.length ? Math.round(totalMonthly / structures.length).toLocaleString() : 0}`} color="#0891b2" />
          <StatPill icon="💰" label="Highest Monthly" value={`PKR ${Math.max(...structures.map(s => Number(s.total_monthly))).toLocaleString()}`} color="#7c3aed" />
        </div>
      )}

      {/* ── Fee Structure Cards ──────────────────────────────── */}
      {loading ? (
        <div style={p.loadBox}>
          <div style={p.spinner} />
          <span style={p.loadText}>Loading structures…</span>
        </div>
      ) : structures.length === 0 ? (
        <div style={p.emptyBox}>
          <div style={p.emptyIcon}>📋</div>
          <p style={p.emptyTitle}>No fee structures yet</p>
          <p style={p.emptySub}>Set fees for each class in <strong>{currentSession?.name}</strong> to get started.</p>
          {coursesWithoutStructure.length > 0 && (
            <button style={p.addBtn} onClick={() => openCreate()}>+ Set Class Fees</button>
          )}
        </div>
      ) : (
        <div style={p.cardGrid}>
          {structures.map((st, idx) => {
            const [accent, accentBg] = CLASS_COLORS[idx % CLASS_COLORS.length];
            return (
              <div key={st.id} style={p.card}>
                {/* Card top bar */}
                <div style={{ ...p.cardBar, background: accentBg, borderBottom: `2px solid ${accent}20` }}>
                  <div style={{ ...p.cardCircle, background: accent }}>
                    {st.course_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={p.cardTitle}>{st.course_name}</div>
                    <div style={p.cardSession}>{currentSession?.name}</div>
                  </div>
                  <div style={p.cardActions}>
                    <button style={p.editBtn} onClick={() => openEdit(st)} title="Edit">✏️</button>
                    <button style={p.delBtn}  onClick={() => handleDelete(st)} title="Delete">🗑️</button>
                  </div>
                </div>

                {/* Fee rows */}
                <div style={p.cardBody}>
                  <div style={p.feeSection}>
                    <div style={p.feeSectionLabel}>Monthly Recurring</div>
                    <FeeRow label="Tuition" value={st.tuition_fee} accent={accent} primary />
                    <FeeRow label="Transport" value={st.transport_fee} accent="#0891b2" />
                  </div>
                  <div style={p.feeDivider} />
                  <div style={p.feeSection}>
                    <div style={p.feeSectionLabel}>One-time Fees</div>
                    <FeeRow label="Registration" value={st.registration_fee} accent="#059669" />
                    <FeeRow label="Books"        value={st.books_fee}        accent="#7c3aed" />
                    <FeeRow label="Exam"         value={st.exam_fee}         accent="#d97706" />
                  </div>
                  {st.note && (
                    <div style={p.noteBox}>💬 {st.note}</div>
                  )}
                </div>

                {/* Card footer totals */}
                <div style={p.cardFoot}>
                  <div style={p.totalCol}>
                    <span style={p.totalLabel}>Monthly Total</span>
                    <span style={{ ...p.totalValue, color: accent }}>PKR {Number(st.total_monthly).toLocaleString()}</span>
                  </div>
                  <div style={p.totalDivider} />
                  <div style={p.totalCol}>
                    <span style={p.totalLabel}>One-time Total</span>
                    <span style={{ ...p.totalValue, color: '#64748b' }}>PKR {Number(st.total_onetime).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* "Not set" placeholder cards */}
          {coursesWithoutStructure.map(c => (
            <div key={c.id} style={p.emptyCard} onClick={() => openCreate(c)}>
              <div style={p.emptyCardIcon}>+</div>
              <div style={p.emptyCardName}>{c.name}</div>
              <div style={p.emptyCardSub}>Click to set fees</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Revision History ─────────────────────────────────── */}
      {showHistory && revisions.length > 0 && (
        <div style={p.historyCard}>
          <div style={p.historyHead}>
            <h3 style={p.historyTitle}>📜 Revision History</h3>
            <span style={p.historyCount}>{revisions.length} entries</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={p.table}>
              <thead>
                <tr>
                  {['Date', 'Session', 'Type', 'Applied To', 'Amount', 'Target', 'Classes', 'By', 'Note'].map(h => (
                    <th key={h} style={p.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {revisions.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                    <td style={p.td}><span style={p.mono}>{r.applied_at?.slice(0, 10)}</span></td>
                    <td style={p.td}>{r.session_name || '—'}</td>
                    <td style={p.td}>
                      <span style={{ ...p.chip, background: r.revision_type === 'percentage' ? '#eff6ff' : '#f0fdf4', color: r.revision_type === 'percentage' ? '#1d4ed8' : '#15803d' }}>
                        {r.revision_type === 'percentage' ? '% Percentage' : '+ Fixed'}
                      </span>
                    </td>
                    <td style={p.td}>{FEE_FIELDS.find(f => f.value === r.fee_field)?.label || r.fee_field}</td>
                    <td style={{ ...p.td, fontWeight: 700 }}>
                      {r.revision_type === 'percentage' ? `${r.amount}%` : `PKR ${r.amount}`}
                    </td>
                    <td style={p.td}>{r.applied_to_all ? 'All classes' : 'Selected'}</td>
                    <td style={p.td}>{r.affected_count}</td>
                    <td style={p.td}>{r.applied_by_name || '—'}</td>
                    <td style={{ ...p.td, color: '#94a3b8', fontSize: 12 }}>{r.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ──────────────────────────────── */}
      {showForm && (
        <div style={p.overlay} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={p.modal}>
            <div style={p.modalHead}>
              <div>
                <h3 style={p.modalTitle}>
                  {editTarget ? `Edit Fees — ${editTarget.course_name}` : 'Set Class Fee Structure'}
                </h3>
                <p style={p.modalSub}>{currentSession?.name}</p>
              </div>
              <button style={p.closeBtn} onClick={() => setShowForm(false)}>✕</button>
            </div>

            <form onSubmit={handleSave} style={p.modalBody}>
              {!editTarget && (
                <div style={p.fg}>
                  <Label>Class <Req /></Label>
                  {coursesWithoutStructure.length === 0 ? (
                    <div style={p.allSetBox}>✅ All classes already have a fee structure for this session.</div>
                  ) : (
                    <select style={p.inp} value={formCourse} onChange={e => setFormCourse(e.target.value)}>
                      <option value="">— Select class —</option>
                      {coursesWithoutStructure.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                  {formErrors.course && <Err>{formErrors.course}</Err>}
                </div>
              )}

              <SectionDivider label="Monthly Recurring" />
              <div style={p.row2}>
                <FeeField label="Tuition Fee / month" value={form.tuition_fee} onChange={v => setForm(f => ({ ...f, tuition_fee: v }))} error={formErrors.tuition_fee} required accent="#6366f1" />
                <FeeField label="Transport Fee / month" value={form.transport_fee} onChange={v => setForm(f => ({ ...f, transport_fee: v }))} accent="#0891b2" />
              </div>

              <SectionDivider label="One-time Fees" />
              <div style={p.row3}>
                <FeeField label="Registration" value={form.registration_fee} onChange={v => setForm(f => ({ ...f, registration_fee: v }))} accent="#059669" />
                <FeeField label="Books"        value={form.books_fee}        onChange={v => setForm(f => ({ ...f, books_fee: v }))}        accent="#7c3aed" />
                <FeeField label="Exam"         value={form.exam_fee}         onChange={v => setForm(f => ({ ...f, exam_fee: v }))}         accent="#d97706" />
              </div>

              <div style={p.fg}>
                <Label>Note (optional)</Label>
                <input style={p.inp} value={form.note} placeholder="e.g. Includes lab fee"
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>

              {formErrors.general && <div style={p.errBox}>{formErrors.general}</div>}

              <div style={p.modalFoot}>
                <button type="button" style={p.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
                {(!editTarget && coursesWithoutStructure.length === 0) ? null : (
                  <button type="submit" style={p.saveBtn} disabled={saving}>
                    {saving ? '⏳ Saving…' : editTarget ? '✓ Update Fees' : '✓ Save Fee Structure'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bulk Revision Modal ──────────────────────────────── */}
      {showRevision && (
        <div style={p.overlay} onClick={e => e.target === e.currentTarget && setShowRevision(false)}>
          <div style={{ ...p.modal, maxWidth: 620 }}>
            <div style={p.modalHead}>
              <div>
                <h3 style={p.modalTitle}>📈 Bulk Fee Revision</h3>
                <p style={p.modalSub}>Increase fees for one or all classes in {currentSession?.name}</p>
              </div>
              <button style={p.closeBtn} onClick={() => setShowRevision(false)}>✕</button>
            </div>
            <div style={p.modalBody}>

              <div style={p.row2}>
                {/* Type */}
                <div style={p.fg}>
                  <Label>Revision Type</Label>
                  <div style={p.optRow}>
                    {[{ v: 'fixed', l: '+ Fixed Amount', icon: '₨' }, { v: 'percentage', l: '% Percentage', icon: '%' }].map(opt => (
                      <OptButton key={opt.v} active={revision.revision_type === opt.v} color="#6366f1"
                        onClick={() => setRevision(r => ({ ...r, revision_type: opt.v }))}>
                        <span style={p.optIcon}>{opt.icon}</span>{opt.l}
                      </OptButton>
                    ))}
                  </div>
                </div>
                {/* Amount */}
                <div style={p.fg}>
                  <Label>{revision.revision_type === 'percentage' ? 'Increase %' : 'Increase Amount (PKR)'} <Req /></Label>
                  <input type="number" min="0" step="any" style={p.inp}
                    placeholder={revision.revision_type === 'percentage' ? 'e.g. 10' : 'e.g. 500'}
                    value={revision.amount}
                    onChange={e => setRevision(r => ({ ...r, amount: e.target.value }))} />
                </div>
              </div>

              {/* Apply to field */}
              <div style={p.fg}>
                <Label>Apply To</Label>
                <div style={p.optRow}>
                  {FEE_FIELDS.map(f => (
                    <OptButton key={f.value} active={revision.fee_field === f.value} color={f.color}
                      onClick={() => setRevision(r => ({ ...r, fee_field: f.value }))}>
                      {f.label}
                    </OptButton>
                  ))}
                </div>
              </div>

              {/* Target */}
              <div style={p.fg}>
                <Label>Target Classes</Label>
                <div style={p.optRow}>
                  {[{ v: true, l: '🏫 All Classes' }, { v: false, l: '✅ Specific Classes' }].map(opt => (
                    <OptButton key={String(opt.v)} active={revision.applied_to_all === opt.v} color="#059669"
                      onClick={() => setRevision(r => ({ ...r, applied_to_all: opt.v, course_ids: [] }))}>
                      {opt.l}
                    </OptButton>
                  ))}
                </div>
                {!revision.applied_to_all && (
                  <div style={p.classChips}>
                    {structures.map(st => {
                      const sel = revision.course_ids.includes(String(st.course));
                      return (
                        <button key={st.course} type="button" onClick={() => toggleCourse(st.course)}
                          style={{ ...p.classChip, background: sel ? '#6366f1' : '#f8fafc', color: sel ? '#fff' : '#475569', border: `1.5px solid ${sel ? '#6366f1' : '#e2e8f0'}` }}>
                          {sel ? '✓ ' : ''}{st.course_name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={p.fg}>
                <Label>Note (optional)</Label>
                <input style={p.inp} placeholder="e.g. Annual 2026 increase"
                  value={revision.note} onChange={e => setRevision(r => ({ ...r, note: e.target.value }))} />
              </div>

              {/* Preview table */}
              {previewMode && targets.length > 0 && (
                <div style={p.previewBox}>
                  <div style={p.previewTitle}>
                    Preview — {targets.length} class{targets.length > 1 ? 'es' : ''} will be updated
                  </div>
                  <div style={{ overflowX: 'auto', marginTop: 10 }}>
                    <table style={p.table}>
                      <thead>
                        <tr>
                          <th style={p.th}>Class</th>
                          {['tuition_fee', 'transport_fee'].map(f => {
                            const show = revision.fee_field === f || revision.fee_field === 'all_monthly' || revision.fee_field === 'all';
                            if (!show) return null;
                            return <th key={f} style={p.th}>{f === 'tuition_fee' ? 'Tuition' : 'Transport'}</th>;
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {targets.map(st => (
                          <tr key={st.id}>
                            <td style={p.td}><strong>{st.course_name}</strong></td>
                            {['tuition_fee', 'transport_fee'].map(f => {
                              const show = revision.fee_field === f || revision.fee_field === 'all_monthly' || revision.fee_field === 'all';
                              if (!show) return null;
                              return (
                                <td key={f} style={p.td}>
                                  <span style={{ color: '#94a3b8', textDecoration: 'line-through' }}>
                                    {Number(st[f]).toLocaleString()}
                                  </span>
                                  {' → '}
                                  <span style={{ fontWeight: 700, color: '#059669' }}>
                                    {calcPreview(st[f]).toLocaleString()}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {revisionMsg && (
                <div style={{ ...p.errBox, background: revisionMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', color: revisionMsg.startsWith('✅') ? '#15803d' : '#dc2626', border: `1px solid ${revisionMsg.startsWith('✅') ? '#86efac' : '#fecaca'}` }}>
                  {revisionMsg}
                </div>
              )}

              <div style={p.modalFoot}>
                <button type="button" style={p.cancelBtn} onClick={() => setShowRevision(false)}>Cancel</button>
                {!previewMode ? (
                  <button type="button" style={p.saveBtn} onClick={previewRevision} disabled={!revision.amount}>
                    Preview Changes →
                  </button>
                ) : (
                  <>
                    <button type="button" style={p.cancelBtn} onClick={() => setPreviewMode(false)}>← Back</button>
                    <button type="button" style={{ ...p.saveBtn, background: 'linear-gradient(135deg,#dc2626,#ef4444)' }}
                      onClick={handleRevise} disabled={revising}>
                      {revising ? '⏳ Applying…' : `⚡ Apply to ${targets.length} class${targets.length > 1 ? 'es' : ''}`}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Small helper components ──────────────────────────────────────────── */

function StatPill({ icon, label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderRadius: 10, padding: '10px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flex: 1, minWidth: 140 }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color }}>{value}</div>
        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginTop: 1 }}>{label}</div>
      </div>
    </div>
  );
}

function FeeRow({ label, value, accent, primary }) {
  const num = Number(value);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
      <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: num > 0 ? accent : '#e2e8f0', flexShrink: 0 }} />
        {label}
      </span>
      <span style={{ fontSize: 12, fontWeight: primary ? 700 : 600, color: num > 0 ? (primary ? accent : '#475569') : '#cbd5e1' }}>
        {num > 0 ? `PKR ${num.toLocaleString()}` : '—'}
      </span>
    </div>
  );
}

function SectionDivider({ label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
    </div>
  );
}

function FeeField({ label, value, onChange, error, required, accent = '#6366f1' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: accent, fontWeight: 800 }}>PKR</span>
        <input type="number" min="0" step="any" value={value}
          onChange={e => onChange(e.target.value)} placeholder="0"
          style={{ width: '100%', padding: '8px 10px 8px 40px', border: `1.5px solid ${error ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', color: '#1e293b' }} />
      </div>
      {error && <span style={{ fontSize: 11, color: '#ef4444' }}>{error}</span>}
    </div>
  );
}

function OptButton({ active, color, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      style={{ padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, background: active ? color : '#f8fafc', color: active ? '#fff' : '#475569', border: `2px solid ${active ? color : '#e2e8f0'}`, transition: 'all 0.15s' }}>
      {children}
    </button>
  );
}

function Label({ children }) {
  return <label style={{ fontSize: 12, fontWeight: 700, color: '#475569', letterSpacing: '0.02em' }}>{children}</label>;
}
function Req() { return <span style={{ color: '#ef4444' }}>*</span>; }
function Err({ children }) { return <span style={{ fontSize: 11, color: '#ef4444' }}>{children}</span>; }

/* ── Styles ───────────────────────────────────────────────────────────── */
const p = {
  page:       { padding: '28px 24px', maxWidth: 1140, margin: '0 auto', minHeight: '100vh', background: '#f8fafc' },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, gap: 16, flexWrap: 'wrap' },
  title:      { fontSize: 26, fontWeight: 800, color: '#0f172a', margin: 0 },
  sub:        { fontSize: 13, color: '#94a3b8', marginTop: 4, margin: '4px 0 0' },
  addBtn:     { padding: '10px 18px', background: 'linear-gradient(135deg,#6366f1,#818cf8)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' },
  reviseBtn:  { padding: '10px 16px', background: '#fff', color: '#dc2626', border: '2px solid #fecaca', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  histBtn:    { padding: '10px 16px', background: '#fff', color: '#475569', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 },
  badge:      { background: '#6366f1', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 800 },

  sessionRow:  { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' },
  sessionLabel:{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' },
  sessionTabs: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  sessionTab:  { padding: '7px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600, background: '#fff', color: '#64748b', border: '1.5px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 6 },
  sessionTabActive: { background: '#6366f1', color: '#fff', border: '1.5px solid #6366f1' },
  activePip:   { width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 },

  statsRow:   { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' },

  loadBox:    { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 60, gap: 12 },
  loadText:   { color: '#94a3b8', fontSize: 14 },
  spinner:    { width: 32, height: 32, border: '3px solid #e2e8f0', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },

  emptyBox:   { background: '#fff', borderRadius: 16, padding: '60px 24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '0 0 6px' },
  emptySub:   { fontSize: 14, color: '#94a3b8', margin: '0 0 20px' },

  // card grid
  cardGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  card:       { background: '#fff', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  cardBar:    { padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 },
  cardCircle: { width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0 },
  cardTitle:  { fontWeight: 700, fontSize: 14, color: '#0f172a' },
  cardSession:{ fontSize: 11, color: '#94a3b8', marginTop: 2 },
  cardActions:{ display: 'flex', gap: 4, marginLeft: 'auto' },
  editBtn:    { background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: '4px', borderRadius: 6, lineHeight: 1 },
  delBtn:     { background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: '4px', borderRadius: 6, lineHeight: 1 },
  cardBody:   { padding: '12px 16px', flex: 1 },
  feeSection: { marginBottom: 8 },
  feeSectionLabel: { fontSize: 10, fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 },
  feeDivider: { height: 1, background: '#f1f5f9', margin: '8px 0' },
  noteBox:    { marginTop: 8, background: '#f8fafc', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#64748b', fontStyle: 'italic' },
  cardFoot:   { display: 'flex', borderTop: '1px solid #f1f5f9', padding: '10px 16px' },
  totalCol:   { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  totalDivider: { width: 1, background: '#f1f5f9', margin: '0 12px' },
  totalLabel: { fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' },
  totalValue: { fontSize: 14, fontWeight: 800 },

  // empty card
  emptyCard:  { background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '2px dashed #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', cursor: 'pointer', gap: 8, transition: 'border-color 0.15s' },
  emptyCardIcon: { width: 40, height: 40, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: '#94a3b8', fontWeight: 700 },
  emptyCardName: { fontWeight: 700, fontSize: 14, color: '#475569' },
  emptyCardSub:  { fontSize: 12, color: '#94a3b8' },

  // history
  historyCard:  { background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', marginTop: 24 },
  historyHead:  { padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  historyTitle: { margin: 0, fontSize: 15, fontWeight: 700, color: '#1e293b' },
  historyCount: { fontSize: 12, color: '#94a3b8', fontWeight: 600 },
  table:  { width: '100%', borderCollapse: 'collapse' },
  th:     { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' },
  td:     { padding: '11px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle' },
  mono:   { fontFamily: 'monospace', fontSize: 12, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 },
  chip:   { padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'inline-block' },

  // modal
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, backdropFilter: 'blur(2px)' },
  modal:      { background: '#fff', borderRadius: 18, width: '100%', maxWidth: 520, boxShadow: '0 24px 64px rgba(0,0,0,0.18)', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  modalHead:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 },
  modalTitle: { margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' },
  modalSub:   { margin: '3px 0 0', fontSize: 13, color: '#94a3b8' },
  closeBtn:   { background: '#f1f5f9', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  modalBody:  { padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 },
  modalFoot:  { display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid #f1f5f9', flexShrink: 0 },
  fg:         { display: 'flex', flexDirection: 'column', gap: 6 },
  inp:        { padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box', color: '#1e293b' },
  row2:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  row3:       { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 },
  errBox:     { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626' },
  allSetBox:  { background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#15803d' },
  saveBtn:    { padding: '10px 22px', background: 'linear-gradient(135deg,#6366f1,#818cf8)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  cancelBtn:  { padding: '10px 18px', background: '#f8fafc', color: '#475569', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  optRow:     { display: 'flex', flexWrap: 'wrap', gap: 8 },
  optIcon:    { fontSize: 12, opacity: 0.8 },
  classChips: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  classChip:  { padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  previewBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 },
  previewTitle: { fontSize: 13, fontWeight: 700, color: '#374151' },
};
