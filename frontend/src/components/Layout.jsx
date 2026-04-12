import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const NAV_ITEMS = [
  { icon: '🏠', label: 'Dashboard',          route: '/dashboard',          roles: ['super_admin','school_admin','principal','teacher','student','parent'] },
  { icon: '👥', label: 'User Management',    route: '/users/create',       roles: ['super_admin','school_admin','principal'] },
  { icon: '📅', label: 'Sessions',           route: '/sessions',           roles: ['super_admin','school_admin','principal'] },
  { icon: '📚', label: 'Classes',            route: '/courses',            roles: ['super_admin','school_admin','principal','teacher'] },
  { icon: '🎓', label: 'Students',           route: '/students',           roles: ['super_admin','school_admin','principal','teacher'] },
  { icon: '🏫', label: 'Teachers',           route: '/teachers',           roles: ['super_admin','school_admin','principal'] },
  { icon: '💼', label: 'Salary',             route: '/salary',             roles: ['super_admin','school_admin'] },
  { icon: '💼', label: 'My Salary',          route: '/salary/my-salary',   roles: ['teacher'] },
  { icon: '👤', label: 'My Profile',         route: '/students/me',        roles: ['student'] },
  { icon: '⏰', label: 'School Timings',      route: '/school-timings',     roles: ['super_admin','school_admin','principal','teacher','student','parent'] },
  { icon: '✅', label: 'Student Attendance', route: '/attendance',             roles: ['super_admin','school_admin','principal','teacher'], exact: true },
  { icon: '🧑‍🏫', label: 'Teacher Attendance',route: '/attendance/teachers',    roles: ['super_admin','school_admin','principal'] },
  { icon: '📅', label: 'My Attendance',      route: '/attendance/me',          roles: ['student'] },
  { icon: '📅', label: 'My Attendance',      route: '/attendance/teachers/me', roles: ['teacher'] },
  { icon: '💰', label: 'Fees',               route: '/fees',               roles: ['super_admin','school_admin','principal'] },
  { icon: '💳', label: 'My Fees',            route: '/fees/my-fees',       roles: ['student'] },
  { icon: '🔔', label: 'Notifications',      route: '/notifications/send', roles: ['super_admin','school_admin','principal'] },
  { icon: '📄', label: 'My Report Card',     route: '/reports',            roles: ['student'] },
  { icon: '⚙️', label: 'School Settings',    route: '/school-settings',    roles: ['super_admin','school_admin'] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [notifData, setNotifData]     = useState({ unread: 0, notifications: [] });
  const [bellOpen, setBellOpen]       = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [schoolName, setSchoolName]   = useState('');
  const [schoolLogo, setSchoolLogo]   = useState(null);

  useEffect(() => {
    api.get('/notifications/').then(r => setNotifData(r.data)).catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    api.get('/auth/school-settings/')
      .then(r => { setSchoolName(r.data.name); setSchoolLogo(r.data.logo); })
      .catch(() => {});
  }, [location.pathname]);

  const handleMarkRead = () => {
    api.post('/notifications/mark-read/').then(() =>
      setNotifData(prev => ({ ...prev, unread: 0, notifications: prev.notifications.map(n => ({ ...n, is_read: true })) }))
    );
  };

  const handleLogout = () => { logout(); navigate('/login'); };
  const closeAll    = () => { setBellOpen(false); setProfileOpen(false); };

  const effectiveRole = user?.is_superuser && !user?.role ? 'super_admin' : user?.role;
  const visibleNav = NAV_ITEMS.filter(n => n.roles.includes(effectiveRole));

  const initials = user
    ? ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase() || user.username?.[0]?.toUpperCase()
    : '?';

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Page title from current route
  const activeNav  = [...visibleNav].reverse().find(n => location.pathname.startsWith(n.route) && n.route !== '/dashboard');
  const pageTitle  = location.pathname === '/dashboard'
    ? 'Dashboard'
    : activeNav?.label || location.pathname.split('/').filter(Boolean).map(s => s.replace(/-/g,' ')).join(' › ');

  return (
    <div style={s.shell} onClick={closeAll}>

      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <div style={s.logoIcon}>
            {schoolLogo
              ? <img src={schoolLogo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
              : <svg width="22" height="22" viewBox="0 0 40 40" fill="none">
                  <path d="M20 4L36 12V22C36 30.837 28.837 38 20 38C11.163 38 4 30.837 4 22V12L20 4Z" fill="white" fillOpacity="0.9"/>
                  <path d="M13 21L17.5 25.5L27 16" stroke="#1e3a5f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            }
          </div>
          <span style={s.logoText}>{schoolName || 'My School'}</span>
        </div>

        <nav style={s.nav}>
          <div style={s.navSection}>MENU</div>
          {visibleNav.map((item, i) => {
            const active = (item.route === '/dashboard' || item.exact)
              ? location.pathname === item.route
              : location.pathname.startsWith(item.route);
            return (
              <button
                key={i}
                style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }}
                onClick={() => navigate(item.route)}
              >
                <span style={{ fontSize: '16px' }}>{item.icon}</span>
                <span>{item.label}</span>
                {active && <div style={s.navActiveBar} />}
              </button>
            );
          })}
        </nav>

        <div style={s.sidebarFooter}>
          <div style={s.sidebarUser}>
            <div style={s.sidebarAvatar}>
              {user?.profile_photo
                ? <img src={user.profile_photo} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>{initials}</span>
              }
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={s.sidebarUserName}>{user?.first_name} {user?.last_name}</div>
              <div style={s.sidebarUserRole}>{effectiveRole?.replace(/_/g, ' ')}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={s.main}>

        {/* Topbar */}
        <header style={s.topbar} onClick={e => e.stopPropagation()}>
          <div>
            <div style={s.topbarTitle}>{pageTitle}</div>
            <div style={s.topbarDate}>{today}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

            {/* Bell */}
            <div style={{ position: 'relative' }}>
              <button style={s.iconBtn} onClick={() => { setBellOpen(!bellOpen); setProfileOpen(false); if (!bellOpen && notifData.unread > 0) handleMarkRead(); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {notifData.unread > 0 && <span style={s.badge}>{notifData.unread > 9 ? '9+' : notifData.unread}</span>}
              </button>
              {bellOpen && (
                <div style={s.dropdown}>
                  <div style={s.dropdownHeader}>
                    <span style={s.dropdownTitle}>Notifications</span>
                    {notifData.unread > 0 && <span style={s.unreadPill}>{notifData.unread} new</span>}
                  </div>
                  {notifData.notifications.length === 0
                    ? <p style={s.dropdownEmpty}>No notifications yet.</p>
                    : notifData.notifications.slice(0, 10).map(n => (
                        <div key={n.id} style={{ ...s.notifItem, background: n.is_read ? '#fff' : '#f0f9ff' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: n.is_read ? '#cbd5e1' : '#3b82f6', flexShrink: 0, marginTop: '4px' }} />
                          <div style={{ flex: 1 }}>
                            <div style={s.notifTitle}>{n.title}</div>
                            <div style={s.notifMsg}>{n.message.slice(0, 80)}{n.message.length > 80 ? '…' : ''}</div>
                            <div style={s.notifTime}>{new Date(n.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      ))
                  }
                </div>
              )}
            </div>

            {/* Profile */}
            <div style={{ position: 'relative' }}>
              <button style={s.profileBtn} onClick={() => { setProfileOpen(!profileOpen); setBellOpen(false); }}>
                <div style={s.profileAvatar}>
                  {user?.profile_photo
                    ? <img src={user.profile_photo} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '13px', fontWeight: '700', color: '#fff' }}>{initials}</span>
                  }
                </div>
                <div style={s.profileInfo}>
                  <span style={s.profileName}>{user?.first_name || user?.username}</span>
                  <span style={s.profileRole}>{user?.role?.replace(/_/g, ' ')}</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M6 9l6 6 6-6" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {profileOpen && (
                <div style={{ ...s.dropdown, width: '220px' }}>
                  <div style={s.pdTop}>
                    <div style={s.pdBigAvatar}>
                      {user?.profile_photo
                        ? <img src={user.profile_photo} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '20px', fontWeight: '700', color: '#fff' }}>{initials}</span>
                      }
                    </div>
                    <div style={s.pdFullName}>{user?.first_name} {user?.last_name}</div>
                    <div style={s.pdAt}>@{user?.username}</div>
                    <span style={s.pdRoleBadge}>{effectiveRole?.replace(/_/g, ' ').toUpperCase()}</span>
                  </div>
                  <div style={s.pdDivider} />
                  <button style={s.pdBtn} onClick={() => { setProfileOpen(false); navigate(user?.role === 'teacher' ? '/teachers/me' : '/profile'); }}>
                    <span>👤</span> View Profile
                  </button>
                  <button style={s.pdBtn} onClick={() => { setProfileOpen(false); navigate('/reset-password'); }}>
                    <span>🔒</span> Change Password
                  </button>
                  <div style={s.pdDivider} />
                  <button style={{ ...s.pdBtn, color: '#ef4444' }} onClick={handleLogout}>
                    <span>🚪</span> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div style={s.content}>
          {children}
        </div>
      </div>
    </div>
  );
}

const s = {
  shell:   { display: 'flex', minHeight: '100vh', background: '#f1f5f9', fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" },

  /* Sidebar */
  sidebar: { width: '240px', flexShrink: 0, background: 'linear-gradient(180deg,#0f172a 0%,#1e293b 100%)', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' },
  logo:    { display: 'flex', alignItems: 'center', gap: '10px', padding: '22px 16px 18px' },
  logoIcon:{ width: '36px', height: '36px', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logoText:{ color: '#fff', fontSize: '14px', fontWeight: '700', letterSpacing: '-0.2px', lineHeight: 1.3 },
  nav:     { flex: 1, padding: '4px 10px' },
  navSection: { fontSize: '10px', fontWeight: '700', color: '#475569', letterSpacing: '1px', padding: '12px 8px 6px' },
  navItem: { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '9px 10px', background: 'none', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#94a3b8', fontSize: '13px', fontWeight: '500', textAlign: 'left', position: 'relative', marginBottom: '1px' },
  navItemActive: { background: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  navActiveBar:  { position: 'absolute', right: 0, top: '6px', bottom: '6px', width: '3px', background: '#3b82f6', borderRadius: '2px' },
  sidebarFooter: { padding: '14px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' },
  sidebarUser:   { display: 'flex', alignItems: 'center', gap: '10px' },
  sidebarAvatar: { width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  sidebarUserName: { fontSize: '12px', fontWeight: '600', color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  sidebarUserRole: { fontSize: '11px', color: '#64748b', textTransform: 'capitalize' },

  /* Main */
  main:    { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },

  /* Topbar */
  topbar:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 28px', borderBottom: '1px solid #e2e8f0', background: '#f1f5f9', position: 'sticky', top: 0, zIndex: 10 },
  topbarTitle: { fontSize: '20px', fontWeight: '700', color: '#0f172a', margin: 0, textTransform: 'capitalize' },
  topbarDate:  { fontSize: '12px', color: '#94a3b8', marginTop: '2px' },

  /* Content */
  content: { padding: '28px', flex: 1 },

  /* Icon btn */
  iconBtn: { position: 'relative', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  badge:   { position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: '#fff', borderRadius: '20px', fontSize: '9px', fontWeight: '800', padding: '1px 4px', minWidth: '14px', textAlign: 'center' },

  /* Dropdown */
  dropdown:      { position: 'absolute', right: 0, top: '48px', width: '320px', background: '#fff', borderRadius: '14px', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', border: '1px solid #f1f5f9', zIndex: 999, overflow: 'hidden' },
  dropdownHeader:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #f1f5f9' },
  dropdownTitle: { fontSize: '14px', fontWeight: '700', color: '#0f172a' },
  unreadPill:    { background: '#eff6ff', color: '#2563eb', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' },
  dropdownEmpty: { padding: '20px 16px', color: '#94a3b8', fontSize: '13px', margin: 0, textAlign: 'center' },
  notifItem:     { display: 'flex', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #f8fafc' },
  notifTitle:    { fontSize: '13px', fontWeight: '600', color: '#0f172a', marginBottom: '2px' },
  notifMsg:      { fontSize: '12px', color: '#64748b', marginBottom: '3px' },
  notifTime:     { fontSize: '11px', color: '#94a3b8' },

  /* Profile btn */
  profileBtn:   { display: 'flex', alignItems: 'center', gap: '10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '6px 12px 6px 6px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  profileAvatar:{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  profileInfo:  { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1px' },
  profileName:  { fontSize: '13px', fontWeight: '600', color: '#0f172a', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  profileRole:  { fontSize: '10px', color: '#94a3b8', textTransform: 'capitalize' },

  /* Profile dropdown */
  pdTop:       { padding: '20px 16px', textAlign: 'center', background: 'linear-gradient(135deg,#f8fafc,#f1f5f9)' },
  pdBigAvatar: { width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', overflow: 'hidden' },
  pdFullName:  { fontSize: '14px', fontWeight: '700', color: '#0f172a' },
  pdAt:        { fontSize: '12px', color: '#94a3b8', marginBottom: '6px' },
  pdRoleBadge: { display: 'inline-block', background: '#eff6ff', color: '#2563eb', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' },
  pdDivider:   { height: '1px', background: '#f1f5f9' },
  pdBtn:       { display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#334155', fontWeight: '500', textAlign: 'left' },
};
