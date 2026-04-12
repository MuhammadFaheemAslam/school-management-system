import { useEffect, useState } from 'react';
import { createUser } from '../services/authService';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const ALL_ROLES = [
  { value: 'super_admin',  label: 'Super Admin',  icon: '🛡️', color: '#7c3aed', bg: '#f5f3ff' },
  { value: 'school_admin', label: 'School Admin', icon: '🏫', color: '#6366f1', bg: '#eef2ff' },
  { value: 'principal',    label: 'Principal',    icon: '👔', color: '#0891b2', bg: '#ecfeff' },
  { value: 'teacher',      label: 'Teacher',      icon: '📚', color: '#059669', bg: '#ecfdf5' },
  { value: 'student',      label: 'Student',      icon: '🎓', color: '#d97706', bg: '#fffbeb' },
  { value: 'parent',       label: 'Parent',       icon: '👨‍👩‍👧', color: '#db2777', bg: '#fdf2f8' },
];

const CREATABLE_ROLES = {
  super_admin:  ['school_admin', 'principal', 'teacher', 'student', 'parent'],
  school_admin: ['teacher', 'student', 'parent'],
  principal:    ['teacher', 'student', 'parent'],
};

const ROLE_META = Object.fromEntries(ALL_ROLES.map(r => [r.value, r]));

const emptyForm    = { first_name: '', last_name: '', username: '', email: '', role: '' };
const emptyEditForm = { first_name: '', last_name: '', email: '', role: '', is_active: true };

function getInitials(f, l) { return `${f?.[0] || ''}${l?.[0] || ''}`.toUpperCase() || '?'; }
function getUserRole(u) { return (u.is_superuser && !u.role) ? 'super_admin' : (u.role || 'super_admin'); }
function avatarColor(role) { return ROLE_META[role]?.color || '#94a3b8'; }

export default function CreateUserPage() {
  const { user: currentUser } = useAuth();
  const effectiveRole = (currentUser?.is_superuser && !currentUser?.role) ? 'super_admin' : currentUser?.role;
  const ROLES = ALL_ROLES.filter(r =>
    (CREATABLE_ROLES[effectiveRole] || []).includes(r.value)
  );

  const [users, setUsers]             = useState([]);
  const [showModal, setShowModal]     = useState(false);
  const [form, setForm]               = useState(emptyForm);
  const [loading, setLoading]         = useState(false);
  const [errors, setErrors]           = useState({});
  const [success, setSuccess]         = useState(null);
  const [resetting, setResetting]     = useState(null);
  const [resetResult, setResetResult] = useState({});
  const [search, setSearch]           = useState('');
  const [filterRole, setFilterRole]   = useState('');

  // Edit modal
  const [editUser,     setEditUser]     = useState(null);
  const [editForm,     setEditForm]     = useState(emptyEditForm);
  const [editErrors,   setEditErrors]   = useState({});
  const [editSaving,   setEditSaving]   = useState(false);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting,      setDeleting]      = useState(false);

  const fetchUsers = () => api.get('/auth/users/').then(r => setUsers(r.data)).catch(() => {});

  useEffect(() => { fetchUsers(); }, []);

  const openModal  = () => { setForm(emptyForm); setErrors({}); setSuccess(null); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setSuccess(null); };

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setErrors(er => ({ ...er, [e.target.name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const data = await createUser(form);
      setSuccess(data);
      fetchUsers();
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') setErrors(data);
      else setErrors({ general: 'Failed to create user. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminReset = async (userId) => {
    setResetting(userId);
    setResetResult(prev => ({ ...prev, [userId]: null }));
    try {
      const res = await api.post(`/auth/admin-reset/${userId}/`);
      setResetResult(prev => ({
        ...prev,
        [userId]: { ok: true, tempPwd: res.data.temporary_password, emailSent: res.data.email_sent },
      }));
    } catch (err) {
      setResetResult(prev => ({
        ...prev,
        [userId]: { ok: false, msg: err.response?.data?.error || 'Reset failed.' },
      }));
    } finally {
      setResetting(null);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({ first_name: u.first_name, last_name: u.last_name, email: u.email, role: u.role, is_active: u.is_active });
    setEditErrors({});
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditErrors({});
    setEditSaving(true);
    try {
      // Only send personal fields when editing self or a super_admin account
      const isSuperTarget = editUser.is_superuser || editUser.role === 'super_admin';
      const payload = isSelf(editUser) || isSuperTarget
        ? { first_name: editForm.first_name, last_name: editForm.last_name, email: editForm.email }
        : editForm;
      await api.patch(`/auth/users/${editUser.id}/`, payload);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        // handle both { error: '...' } and { field: '...' } shapes
        if (data.error) setEditErrors({ general: data.error });
        else setEditErrors(data);
      } else {
        setEditErrors({ general: 'Failed to save changes.' });
      }
    } finally {
      setEditSaving(false);
    }
  };

  // ── Toggle active ─────────────────────────────────────────────────────────
  const handleToggleActive = async (u) => {
    try {
      await api.patch(`/auth/users/${u.id}/`, { is_active: !u.is_active });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Could not update status.');
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/auth/users/${confirmDelete.id}/`);
      setUsers(u => u.filter(x => x.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Could not delete user.');
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const isSelf = (u) => u.id === currentUser?.id;

  const roleCounts = ALL_ROLES
    .filter(r => effectiveRole === 'super_admin' ? true : CREATABLE_ROLES[effectiveRole]?.includes(r.value))
    .map(r => ({ ...r, count: users.filter(u => getUserRole(u) === r.value).length }));

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (!q || `${u.first_name} ${u.last_name} ${u.username} ${u.email}`.toLowerCase().includes(q))
        && (!filterRole || getUserRole(u) === filterRole);
  });

  return (
    <div style={s.page}>

      {/* ── Page Header ── */}
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>User Management</h1>
          <p style={s.pageSubtitle}>Manage all system user accounts</p>
        </div>
        <button style={s.addBtn} onClick={openModal}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>

      {/* ── Stats Row ── */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statBigNum}>{users.length}</div>
          <div style={s.statBigLabel}>Total Users</div>
        </div>
        {roleCounts.map(r => (
          <div key={r.value} style={{ ...s.statCard, borderTop: `3px solid ${r.color}` }}>
            <span style={s.statEmoji}>{r.icon}</span>
            <div style={{ ...s.statNum, color: r.color }}>{r.count}</div>
            <div style={s.statLabel}>{r.label}s</div>
          </div>
        ))}
      </div>

      {/* ── Users Table ── */}
      <div style={s.tableCard}>
        <div style={s.tableHeader}>
          <div>
            <h2 style={s.tableTitle}>All Users</h2>
            <p style={s.tableSub}>{filtered.length} of {users.length} users</p>
          </div>
          <div style={s.controls}>
            <div style={s.searchWrap}>
              <svg style={s.searchIcon} width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
              </svg>
              <input style={s.searchInput} placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select style={s.filterSelect} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
              <option value="">All Roles</option>
              {ALL_ROLES.filter(r => effectiveRole === 'super_admin' || (CREATABLE_ROLES[effectiveRole] || []).includes(r.value))
                .map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>

        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {['User', 'Username', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const result  = resetResult[u.id];
                const uRole   = getUserRole(u);
                const meta    = ROLE_META[uRole] || { color: '#64748b', bg: '#f1f5f9', label: uRole, icon: '👤' };
                const isSuper = u.is_superuser || u.role === 'super_admin';
                const canAct  = !isSuper || effectiveRole === 'super_admin';
                return (
                  <tr key={u.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                    <td style={s.td}>
                      <div style={s.userCell}>
                        <div style={{ ...s.avatar, background: avatarColor(uRole) }}>
                          {getInitials(u.first_name, u.last_name)}
                        </div>
                        <span style={s.userName}>{u.first_name || u.username} {u.last_name}</span>
                      </div>
                    </td>
                    <td style={s.td}><code style={s.mono}>{u.username}</code></td>
                    <td style={s.td}><span style={s.emailText}>{u.email || '—'}</span></td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}33` }}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td style={s.td}>
                      <button
                        onClick={() => (!isSelf(u) && canAct) && handleToggleActive(u)}
                        title={isSelf(u) ? 'Cannot change your own status' : !canAct ? 'Cannot change Super Admin status' : (u.is_active ? 'Click to deactivate' : 'Click to activate')}
                        style={{
                          ...s.statusPill,
                          background: u.is_active ? '#dcfce7' : '#fee2e2',
                          color: u.is_active ? '#15803d' : '#dc2626',
                          cursor: (isSelf(u) || !canAct) ? 'default' : 'pointer',
                          border: 'none',
                          opacity: (isSelf(u) || !canAct) ? 0.7 : 1,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block', marginRight: 5 }} />
                        {u.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Edit — blocked for super_admin accounts unless viewer is super_admin */}
                        {canAct && (
                          <button style={s.editBtn} onClick={() => openEdit(u)} title="Edit user">
                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                            Edit
                          </button>
                        )}

                        {/* Reset password — blocked for super_admin unless viewer is super_admin */}
                        {canAct && (
                          <button
                            style={{ ...s.resetBtn, opacity: resetting === u.id ? 0.6 : 1 }}
                            disabled={resetting === u.id}
                            onClick={() => handleAdminReset(u.id)}
                          >
                            {resetting === u.id ? '…' : '🔑 Reset'}
                          </button>
                        )}

                        {/* Delete — super_admin only, not for self */}
                        {!isSelf(u) && effectiveRole === 'super_admin' && (
                          <button style={s.deleteBtn} onClick={() => setConfirmDelete(u)} title="Delete user">
                            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          </button>
                        )}
                      </div>

                      {result && (
                        <div style={{ marginTop: 5, fontSize: 11, color: result.ok ? '#15803d' : '#dc2626' }}>
                          {result.ok
                            ? <><b>Temp:</b> <code style={s.tempCode}>{result.tempPwd}</code>{!result.emailSent && ' ⚠ email failed'}</>
                            : result.msg}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div style={s.empty}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
              <p style={{ color: '#94a3b8', margin: '0 0 12px' }}>No users match your search.</p>
              <button style={s.clearBtn} onClick={() => { setSearch(''); setFilterRole(''); }}>Clear filters</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Create User Modal ── */}
      {showModal && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && closeModal()}>
          <div style={s.modal}>

            <div style={s.modalHeader}>
              <div style={s.modalIconWrap}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={s.modalTitle}>Add New User</h2>
                <p style={s.modalSub}>A temporary password will be auto-generated and emailed</p>
              </div>
              <button style={s.closeBtn} onClick={closeModal}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {success ? (
              <div style={s.successBody}>
                <div style={s.successRing}>
                  <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="#15803d" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 style={s.successTitle}>User Created Successfully!</h3>
                <p style={s.successSub}>Credentials sent to <strong>{success.user.email}</strong></p>
                <div style={s.credBox}>
                  <CredRow label="Full Name"    value={`${success.user.first_name} ${success.user.last_name}`} />
                  <CredRow label="Username"      value={success.user.username} mono />
                  <CredRow label="Role"          value={success.user.role} roleKey={success.user.role} />
                  <CredRow label="Temp Password" value={success.temporary_password} highlight />
                </div>
                {!success.email_sent && (
                  <div style={s.emailWarn}>⚠ Email not sent — share the credentials above manually.</div>
                )}
                <div style={s.successActions}>
                  <button style={s.anotherBtn} onClick={() => { setForm(emptyForm); setSuccess(null); }}>
                    + Add Another User
                  </button>
                  <button style={s.doneBtn} onClick={closeModal}>Done</button>
                </div>
              </div>
            ) : (
              <form style={s.modalForm} onSubmit={handleSubmit}>
                <div style={s.formRow}>
                  <Field label="First Name" name="first_name" value={form.first_name} onChange={handleChange} error={errors.first_name} placeholder="John" required />
                  <Field label="Last Name"  name="last_name"  value={form.last_name}  onChange={handleChange} error={errors.last_name}  placeholder="Doe"  required />
                </div>
                <Field label="Username"      name="username" value={form.username} onChange={handleChange} error={errors.username} placeholder="john_doe"        required />
                <Field label="Email Address" name="email"    type="email" value={form.email} onChange={handleChange} error={errors.email} placeholder="john@school.com" required />
                <div style={s.field}>
                  <label style={s.label}>Role <span style={{ color: '#ef4444' }}>*</span></label>
                  <div style={s.selectWrap}>
                    <select
                      name="role" value={form.role} onChange={handleChange} required
                      style={{ ...s.select, color: form.role ? '#1e293b' : '#94a3b8', borderColor: errors.role ? '#f87171' : '#e2e8f0' }}
                    >
                      <option value="" disabled>Select a role…</option>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.icon} {r.label}</option>)}
                    </select>
                    <svg style={s.selectArrow} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {form.role && (() => {
                    const m = ROLE_META[form.role];
                    return (
                      <div style={{ ...s.rolePreview, background: m.bg, color: m.color, border: `1px solid ${m.color}44` }}>
                        <span>{m.icon}</span>
                        <span><strong>{m.label}</strong> selected</span>
                      </div>
                    );
                  })()}
                  {errors.role && <span style={s.errorText}>{errors.role}</span>}
                </div>
                {errors.general && <div style={s.errorBox}>{errors.general}</div>}
                <div style={s.formActions}>
                  <button type="button" style={s.cancelBtn} onClick={closeModal}>Cancel</button>
                  <button type="submit" disabled={loading || !form.role}
                    style={{ ...s.submitBtn, opacity: loading || !form.role ? 0.6 : 1 }}>
                    {loading
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Spinner /> Creating…</span>
                      : 'Create User'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Edit User Modal ── */}
      {editUser && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setEditUser(null)}>
          <div style={s.modal}>
            <div style={{ ...s.modalHeader, background: 'linear-gradient(135deg,#0f766e,#14b8a6)' }}>
              <div style={s.modalIconWrap}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={s.modalTitle}>Edit User</h2>
                <p style={s.modalSub}>{editUser.username}</p>
              </div>
              <button style={s.closeBtn} onClick={() => setEditUser(null)}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form style={s.modalForm} onSubmit={handleEditSubmit}>
              <div style={s.formRow}>
                <Field label="First Name" name="first_name" value={editForm.first_name}
                  onChange={e => { setEditForm(f => ({...f, first_name: e.target.value})); setEditErrors(er => ({...er, first_name: ''})); }}
                  error={editErrors.first_name} placeholder="First name" required />
                <Field label="Last Name" name="last_name" value={editForm.last_name}
                  onChange={e => { setEditForm(f => ({...f, last_name: e.target.value})); setEditErrors(er => ({...er, last_name: ''})); }}
                  error={editErrors.last_name} placeholder="Last name" required />
              </div>

              <Field label="Email Address" name="email" type="email" value={editForm.email}
                onChange={e => { setEditForm(f => ({...f, email: e.target.value})); setEditErrors(er => ({...er, email: ''})); }}
                error={editErrors.email} placeholder="email@school.com" required />

              {/* Role — only if not editing self and not a super_admin account */}
              {!isSelf(editUser) && !(editUser.is_superuser || editUser.role === 'super_admin') && (
                <div style={s.field}>
                  <label style={s.label}>Role</label>
                  <div style={s.selectWrap}>
                    <select value={editForm.role}
                      onChange={e => setEditForm(f => ({...f, role: e.target.value}))}
                      style={{ ...s.select, color: '#1e293b' }}>
                      {ALL_ROLES.filter(r => r.value !== 'super_admin')
                        .map(r => <option key={r.value} value={r.value}>{r.icon} {r.label}</option>)}
                    </select>
                    <svg style={s.selectArrow} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {editErrors.role && <span style={s.errorText}>{editErrors.role}</span>}
                </div>
              )}
              {/* Super admin role — read only badge */}
              {!isSelf(editUser) && (editUser.is_superuser || editUser.role === 'super_admin') && (
                <div style={s.field}>
                  <label style={s.label}>Role</label>
                  <div style={{ ...s.badge, background: '#f5f3ff', color: '#7c3aed', border: '1px solid #7c3aed33', display: 'inline-flex', padding: '6px 12px' }}>
                    🛡️ Super Admin <span style={{ marginLeft: 8, fontSize: 11, color: '#94a3b8' }}>(cannot be changed)</span>
                  </div>
                </div>
              )}

              {/* Active toggle — only if not editing self */}
              {!isSelf(editUser) && (
                <div style={s.toggleRow}>
                  <div>
                    <div style={s.toggleLabel}>Account Status</div>
                    <div style={s.toggleSub}>{editForm.is_active ? 'User can log in' : 'Login blocked'}</div>
                  </div>
                  <button type="button"
                    onClick={() => setEditForm(f => ({...f, is_active: !f.is_active}))}
                    style={{ ...s.toggle, background: editForm.is_active ? '#059669' : '#e2e8f0', flexShrink: 0 }}>
                    <div style={{ ...s.thumb, transform: editForm.is_active ? 'translateX(22px)' : 'translateX(2px)' }} />
                  </button>
                </div>
              )}

              {editErrors.general && <div style={s.errorBox}>{editErrors.general}</div>}

              <div style={s.formActions}>
                <button type="button" style={s.cancelBtn} onClick={() => setEditUser(null)}>Cancel</button>
                <button type="submit" disabled={editSaving}
                  style={{ ...s.submitBtn, background: 'linear-gradient(135deg,#0f766e,#14b8a6)', opacity: editSaving ? 0.6 : 1 }}>
                  {editSaving ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Spinner /> Saving…</span> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {confirmDelete && (
        <div style={d.overlay} onClick={e => e.target === e.currentTarget && !deleting && setConfirmDelete(null)}>
          <div style={d.dialog}>
            {/* Red top accent */}
            <div style={d.accent} />

            {/* Icon */}
            <div style={d.iconWrap}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>

            {/* Title */}
            <div style={d.title}>Delete User Account</div>

            {/* User info card */}
            <div style={d.userCard}>
              <div style={{ ...d.userAvatar, background: avatarColor(confirmDelete.role) }}>
                {getInitials(confirmDelete.first_name, confirmDelete.last_name)}
              </div>
              <div style={d.userInfo}>
                <div style={d.userName}>{confirmDelete.first_name} {confirmDelete.last_name}</div>
                <div style={d.userMeta}>@{confirmDelete.username} · {ROLE_META[confirmDelete.role]?.icon} {ROLE_META[confirmDelete.role]?.label || confirmDelete.role}</div>
              </div>
            </div>

            {/* Warning */}
            <div style={d.warning}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#92400e" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span>This will <strong>permanently delete</strong> this account and all associated data. This action <strong>cannot be undone</strong>.</span>
            </div>

            {/* Actions */}
            <div style={d.actions}>
              <button style={d.cancelBtn} onClick={() => setConfirmDelete(null)} disabled={deleting}>
                Cancel
              </button>
              <button style={{ ...d.deleteBtn, opacity: deleting ? 0.7 : 1 }} onClick={handleDelete} disabled={deleting}>
                {deleting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={d.spinner} /> Deleting…
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M4 7h16" />
                    </svg>
                    Delete Permanently
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function Field({ label, name, value, onChange, error, placeholder, type = 'text', required }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label} {required && <span style={{ color: '#ef4444' }}>*</span>}</label>
      <input
        type={type} name={name} value={value} onChange={onChange}
        placeholder={placeholder} required={required}
        style={{ ...s.input, borderColor: error ? '#f87171' : '#e2e8f0', boxShadow: error ? '0 0 0 3px #fee2e2' : 'none' }}
      />
      {error && <span style={s.errorText}>{error}</span>}
    </div>
  );
}

function CredRow({ label, value, mono, highlight, roleKey }) {
  const meta = roleKey ? ROLE_META[roleKey] : null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      {meta ? (
        <span style={{ ...s.badge, background: meta.bg, color: meta.color, border: `1px solid ${meta.color}33` }}>
          {meta.icon} {meta.label}
        </span>
      ) : (
        <span style={{
          fontSize: 14, fontWeight: 600, color: '#1e293b',
          ...(mono      ? { fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 8px', borderRadius: 5 } : {}),
          ...(highlight ? { background: '#eff6ff', color: '#1d4ed8', padding: '3px 10px', borderRadius: 6, fontFamily: 'monospace', fontWeight: 700, border: '1px dashed #93c5fd' } : {}),
        }}>
          {value}
        </span>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="10" stroke="white" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/* ── Delete dialog styles ── */
const d = {
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 },
  dialog:     { background: '#fff', borderRadius: 20, width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.25)', overflow: 'hidden', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" },
  accent:     { height: 5, background: 'linear-gradient(90deg,#dc2626,#ef4444,#f87171)' },
  iconWrap:   { width: 60, height: 60, borderRadius: '50%', background: '#fef2f2', border: '2px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '28px auto 16px' },
  title:      { fontSize: 20, fontWeight: 800, color: '#0f172a', textAlign: 'center', marginBottom: 18 },
  userCard:   { display: 'flex', alignItems: 'center', gap: 14, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', margin: '0 24px 18px' },
  userAvatar: { width: 44, height: 44, borderRadius: '50%', color: '#fff', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  userInfo:   { minWidth: 0 },
  userName:   { fontSize: 15, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userMeta:   { fontSize: 12, color: '#64748b', marginTop: 2 },
  warning:    { display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 14px', margin: '0 24px 24px', fontSize: 13, color: '#78350f', lineHeight: 1.55 },
  actions:    { display: 'flex', gap: 10, padding: '0 24px 24px', justifyContent: 'flex-end' },
  cancelBtn:  { padding: '10px 20px', background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#334155', cursor: 'pointer', fontFamily: 'inherit' },
  deleteBtn:  { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'linear-gradient(135deg,#b91c1c,#dc2626)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(220,38,38,0.35)' },
  spinner:    { width: 14, height: 14, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' },
};

/* ── Styles ── */
const s = {
  page:        { padding: '28px', background: '#f1f5f9', minHeight: '100%' },
  pageHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  pageTitle:   { margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' },
  pageSubtitle:{ margin: '4px 0 0', fontSize: '14px', color: '#64748b' },
  addBtn: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 20px', background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
    color: '#fff', border: 'none', borderRadius: '10px',
    fontSize: '14px', fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(59,130,246,0.4)',
  },

  statsRow:     { display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' },
  statCard:     { flex: 1, minWidth: '120px', background: '#fff', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '4px' },
  statBigNum:   { fontSize: '32px', fontWeight: 800, color: '#1e40af', lineHeight: 1 },
  statBigLabel: { fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
  statEmoji:    { fontSize: '22px' },
  statNum:      { fontSize: '22px', fontWeight: 800, lineHeight: 1 },
  statLabel:    { fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' },

  tableCard:    { background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', overflow: 'hidden' },
  tableHeader:  { padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  tableTitle:   { margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' },
  tableSub:     { margin: '2px 0 0', fontSize: '13px', color: '#94a3b8' },
  controls:     { display: 'flex', gap: '10px', alignItems: 'center' },
  searchWrap:   { position: 'relative' },
  searchIcon:   { position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' },
  searchInput:  { paddingLeft: '32px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '200px', fontFamily: 'inherit' },
  filterSelect: { padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', background: '#fff', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' },

  tableWrap: { overflowX: 'auto' },
  table:     { width: '100%', borderCollapse: 'collapse' },
  th:        { padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', whiteSpace: 'nowrap' },
  td:        { padding: '13px 20px', fontSize: '14px', color: '#1e293b', borderBottom: '1px solid #f8fafc', verticalAlign: 'middle' },
  userCell:  { display: 'flex', alignItems: 'center', gap: '10px' },
  avatar:    { width: 36, height: 36, borderRadius: '50%', color: '#fff', fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  userName:  { fontWeight: 600, color: '#1e293b' },
  emailText: { color: '#64748b', fontSize: '13px' },
  mono:      { fontFamily: 'monospace', background: '#f1f5f9', padding: '3px 8px', borderRadius: 5, fontSize: '12px', color: '#475569' },
  badge:     { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' },
  statusPill:{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 },

  editBtn:   { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  resetBtn:  { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: 'linear-gradient(135deg, #92400e, #d97706)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  deleteBtn: { display: 'inline-flex', alignItems: 'center', padding: '5px 7px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '7px', cursor: 'pointer' },
  tempCode:  { background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace', fontSize: '12px' },
  empty:     { padding: '48px 24px', textAlign: 'center' },
  clearBtn:  { padding: '8px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: '13px', cursor: 'pointer', color: '#475569' },

  /* ── Modal ── */
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '20px',
  },
  modal: {
    background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '500px',
    boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden',
  },
  modalHeader: {
    background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
    padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '14px',
  },
  modalIconWrap: { width: 40, height: 40, background: 'rgba(255,255,255,0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  modalTitle: { margin: 0, fontSize: '17px', fontWeight: 700, color: '#fff' },
  modalSub:   { margin: '3px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.75)' },
  closeBtn:   { background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '8px', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },

  modalForm: { padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' },
  formRow:   { display: 'flex', gap: '14px' },
  field:     { display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 },
  label:     { fontSize: '13px', fontWeight: 600, color: '#374151' },
  input:     { padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', transition: 'border-color 0.15s' },
  errorText: { color: '#ef4444', fontSize: '12px' },
  errorBox:  { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' },

  selectWrap:  { position: 'relative' },
  select:      { width: '100%', padding: '10px 36px 10px 14px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', outline: 'none', appearance: 'none', background: '#fff', fontFamily: 'inherit', cursor: 'pointer' },
  selectArrow: { position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' },
  rolePreview: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, marginTop: '4px' },

  toggleRow:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: 10, padding: '12px 16px', border: '1.5px solid #e2e8f0', gap: 12 },
  toggleLabel: { fontSize: 14, fontWeight: 700, color: '#1e293b' },
  toggleSub:   { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  toggle:      { width: 46, height: 26, borderRadius: 99, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', padding: 0 },
  thumb:       { position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px #0002', transition: 'transform 0.2s' },

  formActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' },
  cancelBtn:   { padding: '10px 20px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  submitBtn:   { padding: '10px 24px', background: 'linear-gradient(135deg, #1e40af, #3b82f6)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },

  /* ── Success in modal ── */
  successBody:    { padding: '32px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
  successRing:    { width: 72, height: 72, borderRadius: '50%', background: '#dcfce7', border: '4px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' },
  successTitle:   { margin: '0 0 6px', fontSize: '20px', fontWeight: 700, color: '#15803d' },
  successSub:     { margin: '0 0 20px', fontSize: '13px', color: '#64748b' },
  credBox:        { width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '4px 16px', marginBottom: '14px' },
  emailWarn:      { background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '12px', width: '100%', boxSizing: 'border-box' },
  successActions: { display: 'flex', gap: '10px', width: '100%', justifyContent: 'center' },
  anotherBtn:     { padding: '10px 18px', background: '#f0fdf4', color: '#15803d', border: '1.5px solid #86efac', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  doneBtn:        { padding: '10px 24px', background: 'linear-gradient(135deg, #1e40af, #3b82f6)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' },
};
