import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const CAN_EDIT = ['super_admin', 'school_admin', 'principal'];

const fmt = (t) => (t ? t.slice(0, 5) : '');

const TIMING_FIELDS = [
  { key: 'school_start_time', label: 'Start Time',  icon: '🌅', color: '#16a34a', bg: '#dcfce7', border: '#86efac' },
  { key: 'school_end_time',   label: 'End Time',    icon: '🌇', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
  { key: 'break_start_time',  label: 'Break Start', icon: '☕', color: '#d97706', bg: '#fef3c7', border: '#fcd34d' },
  { key: 'break_end_time',    label: 'Break End',   icon: '🔔', color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd' },
];

function durationHints(form) {
  const hints = [];
  if (form.break_start_time && form.break_end_time) {
    const [bsh, bsm] = form.break_start_time.split(':').map(Number);
    const [beh, bem] = form.break_end_time.split(':').map(Number);
    const dur = (beh * 60 + bem) - (bsh * 60 + bsm);
    if (dur > 0) hints.push(`☕ Break: ${dur} min`);
  }
  if (form.school_start_time && form.school_end_time) {
    const [sh, sm] = form.school_start_time.split(':').map(Number);
    const [eh, em] = form.school_end_time.split(':').map(Number);
    const total = (eh * 60 + em) - (sh * 60 + sm);
    if (total > 0) {
      const bDur = (form.break_start_time && form.break_end_time) ? (() => {
        const [bsh, bsm] = form.break_start_time.split(':').map(Number);
        const [beh, bem] = form.break_end_time.split(':').map(Number);
        return Math.max(0, (beh * 60 + bem) - (bsh * 60 + bsm));
      })() : 0;
      const teaching = total - bDur;
      hints.push(`🏫 ${Math.floor(total/60)}h ${total%60}m school day · ${Math.floor(teaching/60)}h ${teaching%60}m teaching`);
    }
  }
  return hints;
}

/* ─── School-wide Settings Card ──────────────────────────────────────────── */
function SchoolWideCard({ onApplied, canEdit }) {
  const [settings, setSettings]   = useState(null);
  const [editMode, setEditMode]   = useState(false);
  const [form, setForm]           = useState({});
  const [saving, setSaving]       = useState(false);
  const [applying, setApplying]   = useState(false);
  const [savedMsg, setSavedMsg]   = useState('');
  const [error, setError]         = useState('');

  useEffect(() => {
    api.get('/courses/school-settings/').then(r => {
      setSettings(r.data);
    }).catch(() => setError('Could not load school settings.'));
  }, []);

  const startEdit = () => {
    setForm({
      school_start_time: fmt(settings?.school_start_time) || '',
      school_end_time:   fmt(settings?.school_end_time)   || '',
      break_start_time:  fmt(settings?.break_start_time)  || '',
      break_end_time:    fmt(settings?.break_end_time)    || '',
    });
    setEditMode(true);
    setError('');
  };

  const handleSave = async () => {
    if (!form.school_start_time) { setError('Start time is required.'); return; }
    setSaving(true); setError('');
    try {
      const res = await api.put('/courses/school-settings/', {
        school_start_time: form.school_start_time,
        school_end_time:   form.school_end_time  || null,
        break_start_time:  form.break_start_time || null,
        break_end_time:    form.break_end_time   || null,
      });
      setSettings(res.data);
      setEditMode(false);
      setSavedMsg('Saved');
      setTimeout(() => setSavedMsg(''), 2500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyAll = async () => {
    if (!window.confirm('Apply school-wide timings to ALL class sections? This will overwrite any per-section custom timings.')) return;
    setApplying(true); setError('');
    try {
      const res = await api.post('/courses/school-settings/apply-all/');
      setSavedMsg(res.data.detail || 'Applied to all sections');
      setTimeout(() => setSavedMsg(''), 3000);
      if (onApplied) onApplied();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to apply.');
    } finally {
      setApplying(false);
    }
  };

  const hints = editMode ? durationHints(form) : [];

  return (
    <div style={pg.globalCard}>
      {/* Header row */}
      <div style={pg.cardTop}>
        <div style={pg.sectionInfo}>
          <div style={{ ...pg.sectionIcon, background: '#1e3a8a', fontSize: 22 }}>🏫</div>
          <div>
            <div style={{ ...pg.sectionName, fontSize: 17 }}>School-wide Default Timings</div>
            <div style={{ fontSize: 12, color: '#93c5fd', marginTop: 2 }}>
              {canEdit ? 'Default timings for the whole school. Override per section below.' : 'Default timings for the whole school.'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {savedMsg && <span style={pg.savedBadge}>✓ {savedMsg}</span>}
          {canEdit && !editMode && (
            <button onClick={startEdit} style={pg.editBtn}>✏️ Edit</button>
          )}
        </div>
      </div>

      {error && <div style={{ ...pg.errorBox, marginBottom: 12 }}>{error}</div>}

      {/* Read-only pills */}
      {!editMode && settings && (
        <div style={pg.pillRow}>
          {TIMING_FIELDS.map(f => (
            <div key={f.key} style={{ ...pg.pill, background: f.bg, border: `1.5px solid ${f.border}` }}>
              <span style={{ fontSize: 18 }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: 10, color: f.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: f.color }}>
                  {fmt(settings[f.key]) || <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 400 }}>Not set</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit form — admins only */}
      {canEdit && editMode && (
        <div style={pg.editForm}>
          <div style={pg.fieldsGrid}>
            {TIMING_FIELDS.map(f => (
              <div key={f.key} style={pg.fieldGroup}>
                <label style={{ ...pg.fieldLabel, color: f.color }}>
                  {f.icon} {f.label}
                  {f.key === 'school_start_time' && <span style={{ color: '#dc2626' }}> *</span>}
                </label>
                <input
                  type="time"
                  value={form[f.key] || ''}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ ...pg.timeInput, borderColor: f.border, background: f.bg }}
                />
              </div>
            ))}
          </div>

          {hints.map((h, i) => (
            <div key={i} style={pg.hintBox}>{h}</div>
          ))}

          <div style={pg.btnRow}>
            <button onClick={() => setEditMode(false)} style={pg.cancelBtn}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={pg.saveBtn}>
              {saving ? 'Saving...' : '✓ Save School Timings'}
            </button>
          </div>
        </div>
      )}

      {/* Apply-all button — admins only */}
      {canEdit && !editMode && settings && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1.5px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#93c5fd' }}>
            Want to copy these timings to every section at once?
          </p>
          <button onClick={handleApplyAll} disabled={applying} style={pg.applyAllBtn}>
            {applying ? 'Applying...' : '⚡ Apply to All Sections'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function SchoolTimingsPage() {
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const canEdit   = CAN_EDIT.includes(user?.role);
  const [sections, setSections]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [editing, setEditing]     = useState(null);
  const [form, setForm]           = useState({});
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(null);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const loadSections = () => {
    setLoading(true);
    api.get('/courses/sections/')
      .then(r => setSections(r.data))
      .catch(() => setError('Failed to load sections.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadSections(); }, [reloadKey]);

  const startEdit = (sec) => {
    setEditing(sec.id);
    setForm({
      school_start_time: fmt(sec.school_start_time) || '',
      school_end_time:   fmt(sec.school_end_time)   || '',
      break_start_time:  fmt(sec.break_start_time)  || '',
      break_end_time:    fmt(sec.break_end_time)    || '',
    });
    setError('');
  };

  const cancelEdit = () => { setEditing(null); setForm({}); setError(''); };

  const handleSave = async (secId) => {
    setSaving(true); setError('');
    try {
      const res = await api.put(`/courses/sections/${secId}/`, {
        school_start_time: form.school_start_time || null,
        school_end_time:   form.school_end_time   || null,
        break_start_time:  form.break_start_time  || null,
        break_end_time:    form.break_end_time    || null,
      });
      setSections(prev => prev.map(s => s.id === secId ? { ...s, ...res.data } : s));
      setEditing(null);
      setSaved(secId);
      setTimeout(() => setSaved(null), 2500);
    } catch (err) {
      setError(err.response?.data?.error || JSON.stringify(err.response?.data) || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = sections.filter(s =>
    (s.display_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.course_name  || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={pg.page}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Page header */}
      <div style={pg.header}>
        <div style={pg.headerLeft}>
          <button onClick={() => navigate('/courses')} style={pg.backBtn}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
              <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Classes
          </button>
          <div>
            <h2 style={pg.title}>School Timings</h2>
            <p style={pg.subtitle}>{canEdit ? 'Set school-wide timings or override per class section' : 'View school start, end and break times'}</p>
          </div>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search section..."
          style={pg.searchInput}
        />
      </div>

      {error && <div style={pg.errorBox}>{error}</div>}

      {/* ── School-wide card ── */}
      <SchoolWideCard onApplied={() => setReloadKey(k => k + 1)} canEdit={canEdit} />

      {/* ── Divider ── */}
      <div style={pg.divider}>
        <div style={pg.dividerLine} />
        <span style={pg.dividerLabel}>{canEdit ? 'Per-Section Overrides' : 'Class Section Timings'}</span>
        <div style={pg.dividerLine} />
      </div>
      <p style={pg.dividerSub}>
        {canEdit
          ? 'Leave all fields blank to inherit from school-wide timings. Set any field to override for a specific section.'
          : 'Timings for each class section. Sections without a custom timing use the school-wide defaults above.'}
      </p>

      {/* ── Section cards ── */}
      {loading ? (
        <div style={pg.loadingRow}><div style={pg.spinner} /> Loading sections...</div>
      ) : filtered.length === 0 ? (
        <div style={pg.empty}>No sections found.</div>
      ) : (
        <div style={pg.grid}>
          {filtered.map(sec => {
            const isEdit    = editing === sec.id;
            const justSaved = saved === sec.id;
            const hasOverride = sec.school_start_time || sec.school_end_time || sec.break_start_time || sec.break_end_time;
            const hints = isEdit ? durationHints(form) : [];
            return (
              <div key={sec.id} style={{ ...pg.card, ...(isEdit ? pg.cardActive : {}), animation: 'fadeIn 0.2s ease' }}>

                <div style={pg.cardTop}>
                  <div style={pg.sectionInfo}>
                    <div style={pg.sectionIcon}>🏫</div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={pg.sectionName}>{sec.display_name || sec.course_name}</span>
                        {hasOverride
                          ? <span style={pg.overrideBadge}>Custom</span>
                          : <span style={pg.inheritBadge}>Inherits school-wide</span>}
                      </div>
                      {sec.session_name && <div style={pg.sessionTag}>{sec.session_name}</div>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {justSaved && <span style={pg.savedBadge}>✓ Saved</span>}
                    {canEdit && !isEdit && (
                      <button onClick={() => startEdit(sec)} style={{ padding: '6px 14px', background: '#eff6ff', border: '1.5px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>✏️ Edit</button>
                    )}
                  </div>
                </div>

                {/* Read-only pills */}
                {!isEdit && (
                  <div style={pg.pillRow}>
                    {TIMING_FIELDS.map(f => (
                      <div key={f.key} style={{ ...pg.pill, background: f.bg, border: `1.5px solid ${f.border}`, opacity: sec[f.key] ? 1 : 0.45 }}>
                        <span style={{ fontSize: 16 }}>{f.icon}</span>
                        <div>
                          <div style={{ fontSize: 10, color: f.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.label}</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: f.color }}>
                            {fmt(sec[f.key]) || <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>inherited</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Edit form */}
                {isEdit && (
                  <div style={{ borderTop: '1.5px solid #f1f5f9', paddingTop: 16, marginTop: 4 }}>
                    <div style={pg.fieldsGrid}>
                      {TIMING_FIELDS.map(f => (
                        <div key={f.key} style={pg.fieldGroup}>
                          <label style={{ fontSize: 12, fontWeight: 700, color: f.color }}>
                            {f.icon} {f.label}
                            <span style={{ color: '#94a3b8', fontWeight: 400 }}> (optional)</span>
                          </label>
                          <input
                            type="time"
                            value={form[f.key] || ''}
                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                            style={{ ...pg.timeInput, borderColor: f.border, background: f.bg }}
                          />
                        </div>
                      ))}
                    </div>

                    {hints.map((h, i) => (
                      <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#475569', marginBottom: 10 }}>{h}</div>
                    ))}

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                      <button onClick={cancelEdit} style={{ padding: '8px 18px', background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancel</button>
                      <button onClick={() => handleSave(sec.id)} disabled={saving} style={{ padding: '8px 22px', background: '#1e40af', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                        {saving ? 'Saving...' : '✓ Save Override'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const pg = {
  page:        { minHeight: '100vh', background: '#f8fafc' },

  header:      { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 },
  headerLeft:  { display: 'flex', alignItems: 'flex-start', gap: 16 },
  backBtn:     { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: '#475569', fontWeight: 500 },
  title:       { margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' },
  subtitle:    { margin: '4px 0 0', fontSize: 13, color: '#94a3b8' },
  searchInput: { padding: '9px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, minWidth: 220, background: '#fff', color: '#0f172a' },

  errorBox:    { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: 10, marginBottom: 16, fontSize: 14 },
  loadingRow:  { display: 'flex', alignItems: 'center', gap: 10, padding: 24, color: '#64748b', fontSize: 14 },
  spinner:     { width: 20, height: 20, border: '2.5px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },
  empty:       { textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 15 },

  /* School-wide card */
  globalCard:  { background: 'linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 100%)', border: '2px solid #1e40af', borderRadius: 18, padding: '22px 26px', marginBottom: 28, color: '#fff', boxShadow: '0 8px 32px rgba(30,64,175,0.2)' },

  divider:     { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 },
  dividerLine: { flex: 1, height: 1, background: '#e2e8f0' },
  dividerLabel:{ fontSize: 13, fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' },
  dividerSub:  { fontSize: 12, color: '#94a3b8', marginBottom: 20 },

  grid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: 16 },

  card:        { background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 16, padding: '20px 22px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', transition: 'border-color 0.2s' },
  cardActive:  { border: '1.5px solid #3b82f6', boxShadow: '0 4px 20px rgba(59,130,246,0.1)' },

  cardTop:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionInfo: { display: 'flex', alignItems: 'center', gap: 12 },
  sectionIcon: { width: 40, height: 40, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 },
  sectionName: { fontSize: 14, fontWeight: 800, color: '#0f172a' },
  sessionTag:  { fontSize: 11, color: '#64748b', marginTop: 3, background: '#f1f5f9', padding: '2px 8px', borderRadius: 20, display: 'inline-block' },

  overrideBadge: { fontSize: 10, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 20, border: '1px solid #bfdbfe' },
  inheritBadge:  { fontSize: 10, fontWeight: 600, background: '#f1f5f9', color: '#94a3b8', padding: '2px 8px', borderRadius: 20, border: '1px solid #e2e8f0' },

  editBtn:     { padding: '6px 14px', background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  savedBadge:  { padding: '5px 12px', background: '#dcfce7', border: '1px solid #86efac', color: '#16a34a', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  applyAllBtn: { padding: '9px 20px', background: '#fff', color: '#1e40af', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' },

  pillRow:     { display: 'flex', gap: 10, flexWrap: 'wrap' },
  pill:        { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, minWidth: 100 },

  editForm:    { borderTop: '1.5px solid rgba(255,255,255,0.15)', paddingTop: 16, marginTop: 4 },
  fieldsGrid:  { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 14 },
  fieldGroup:  { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel:  { fontSize: 12, fontWeight: 700, color: '#fff' },
  timeInput:   { padding: '9px 12px', border: '1.5px solid', borderRadius: 9, fontSize: 14, background: '#fff', color: '#0f172a', width: '100%', boxSizing: 'border-box' },

  hintBox:     { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#e0f2fe', marginBottom: 10 },

  btnRow:      { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 },
  cancelBtn:   { padding: '8px 18px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  saveBtn:     { padding: '8px 22px', background: '#fff', color: '#1e40af', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 },
};
