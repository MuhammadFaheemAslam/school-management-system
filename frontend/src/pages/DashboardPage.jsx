import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';


function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/auth/dashboard-stats/').then(r => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div>
      {/* Welcome banner */}
      <div style={s.banner}>
        <div>
          <h2 style={s.bannerTitle}>Good {getGreeting()}, {user?.first_name || user?.username}! 👋</h2>
          <p style={s.bannerSub}>Here's what's happening at your school today.</p>
        </div>
        <div style={s.bannerBadge}>{((user?.is_superuser && !user?.role) ? 'super_admin' : user?.role)?.replace(/_/g, ' ').toUpperCase()}</div>
      </div>

      {/* Stats */}
      {stats && <StatsSection stats={stats} navigate={navigate} />}

    </div>
  );
}

// ── Stats sections ────────────────────────────────────────────────────────────

function StatsSection({ stats, navigate }) {
  const { role } = stats;
  if (role === 'super_admin')  return <ManagementStats stats={stats} navigate={navigate} />;
  if (role === 'principal')    return <PrincipalStats  stats={stats} navigate={navigate} />;
  if (role === 'school_admin') return <SchoolAdminStats stats={stats} />;
  if (role === 'teacher')      return <TeacherStats    stats={stats} navigate={navigate} />;
  if (role === 'student')      return <StudentStats    stats={stats} navigate={navigate} />;
  if (role === 'parent')       return <ParentStats     stats={stats} />;
  return null;
}

function ManagementStats({ stats, navigate }) {
  const { stats: st, upcoming_exams, fee_by_class = [], recent_payments = [], today_new_students = [], students_by_class = [], gender_dist, unmarked_sections = [] } = stats;
  const collectionRate = st.fee_collection_rate ?? 0;
  const attGood   = (st.att_rate_today ?? 0) >= 75;
  const monthDiff = st.this_month_paid - st.last_month_paid;
  const monthUp   = monthDiff >= 0;

  return (
    <section>

      {/* ── System Overview ── */}
      <h3 style={s.sectionHeading}>System Overview</h3>
      <div style={s.statGrid}>
        <StatCard icon="🎓" label="Students"       value={st.total_students}       gradient="linear-gradient(135deg,#3730a3,#818cf8)" />
        <StatCard icon="🧑‍🏫" label="Teachers"      value={st.total_teachers}       gradient="linear-gradient(135deg,#1e40af,#60a5fa)" />
        <StatCard icon="🏫" label="Principals"     value={st.total_principals}     gradient="linear-gradient(135deg,#6d28d9,#a78bfa)" />
        <StatCard icon="🛡️" label="School Admins"  value={st.total_school_admins}  gradient="linear-gradient(135deg,#0e7490,#22d3ee)" />
        <StatCard icon="📚" label="Classes"        value={st.total_courses}        gradient="linear-gradient(135deg,#92400e,#fbbf24)" />
        <StatCard icon="🏷️" label="Sections"       value={st.total_sections}       gradient="linear-gradient(135deg,#065f46,#34d399)" />
        <StatCard icon="📝" label="Total Exams"    value={st.total_exams}          gradient="linear-gradient(135deg,#4c1d95,#8b5cf6)" />
        <StatCard icon="🆕" label="Today's Admissions" value={st.today_admissions} gradient="linear-gradient(135deg,#0e7490,#22d3ee)" />
      </div>

      {/* ── Student Attendance ── */}
      <h3 style={{ ...s.sectionHeading, marginTop: 8 }}>Student Attendance Today</h3>
      <div style={s.statGrid}>
        <StatCard icon="📅" label="Attendance Rate"
          value={st.att_rate_today !== null ? `${st.att_rate_today}%` : '—'}
          gradient={attGood ? 'linear-gradient(135deg,#065f46,#34d399)' : 'linear-gradient(135deg,#991b1b,#f87171)'} />
        <StatCard icon="❌" label="Absent Today"     value={st.students_absent_today ?? '—'} gradient="linear-gradient(135deg,#991b1b,#f87171)" />
        <StatCard icon="✅" label="Sections Marked"  value={st.sections_marked ?? 0}         gradient="linear-gradient(135deg,#0e7490,#22d3ee)" />
        <StatCard icon="⏳" label="Not Marked Yet"   value={st.sections_unmarked ?? 0}       gradient="linear-gradient(135deg,#92400e,#fbbf24)" />
        <StatCard icon="👤" label="No Class Teacher" value={st.no_teacher_sections ?? 0}     gradient="linear-gradient(135deg,#be185d,#f472b6)" />
      </div>

      <div style={s.progressCard}>
        <div style={s.progressHeader}>
          <span style={s.progressLabel}>Today's Attendance Rate</span>
          <span style={s.progressValue}>{st.sections_marked ?? 0} of {(st.sections_marked ?? 0) + (st.sections_unmarked ?? 0)} sections marked</span>
        </div>
        <div style={s.progressTrack}>
          <div style={{ ...s.progressFill, width: `${st.att_rate_today ?? 0}%`, background: attGood ? 'linear-gradient(90deg,#059669,#10b981)' : 'linear-gradient(90deg,#dc2626,#ef4444)' }} />
        </div>
        <div style={s.progressPct}>{st.att_rate_today ?? 0}% students present today</div>
      </div>

      {unmarked_sections.length > 0 && (
        <div style={{ ...s.alertCard, marginBottom: 16, alignItems: 'flex-start', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <strong style={s.alertText}>{st.sections_unmarked} section{st.sections_unmarked !== 1 ? 's' : ''} haven't marked attendance today</strong>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {unmarked_sections.map(sec => (
              <span key={sec.id} style={{ background: '#fff', border: '1px solid #fed7aa', borderRadius: 20, padding: '3px 10px', fontSize: 12, color: '#92400e', fontWeight: 600 }}>
                {sec.name}{sec.teacher ? ` · ${sec.teacher}` : ' · No teacher'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Teacher Attendance ── */}
      <h3 style={{ ...s.sectionHeading, marginTop: 8 }}>Teacher Attendance Today</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard icon="🧑‍🏫" label="Present"    value={st.teachers_present ?? 0}  gradient="linear-gradient(135deg,#065f46,#34d399)" />
        <StatCard icon="❌"   label="Absent"     value={st.teachers_absent ?? 0}   gradient="linear-gradient(135deg,#991b1b,#f87171)" />
        <StatCard icon="⏰"   label="Late"       value={st.teachers_late ?? 0}     gradient="linear-gradient(135deg,#92400e,#fbbf24)" />
        <StatCard icon="🌿"   label="On Leave"   value={st.teachers_leave ?? 0}    gradient="linear-gradient(135deg,#4c1d95,#8b5cf6)" />
        <StatCard icon="⏳"   label="Not Marked" value={st.teachers_unmarked ?? 0} gradient="linear-gradient(135deg,#0e7490,#22d3ee)" />
      </div>

      {/* ── Financial Overview ── */}
      <h3 style={{ ...s.sectionHeading, marginTop: 8 }}>Financial Overview</h3>
      <div style={s.statGrid}>
        <StatCard icon="💰" label="Fee Collected"   value={`${collectionRate}%`}  gradient="linear-gradient(135deg,#065f46,#34d399)" />
        <StatCard icon="⏳" label="Pending Fees"    value={st.pending_fees}        gradient="linear-gradient(135deg,#c2410c,#fb923c)" />
        <StatCard icon="⚠️" label="Overdue Fees"    value={st.overdue_fees}        gradient="linear-gradient(135deg,#991b1b,#f87171)" />
        <StatCard icon="🚨" label="Fee Defaulters"  value={st.fee_defaulters}      gradient="linear-gradient(135deg,#7f1d1d,#fca5a5)" />
        <StatCard icon="📋" label="No Fee Assigned" value={st.no_fee_package}      gradient="linear-gradient(135deg,#be185d,#f472b6)" />
      </div>

      <div style={s.progressCard}>
        <div style={s.progressHeader}>
          <span style={s.progressLabel}>Overall Fee Collection</span>
          <span style={s.progressValue}>PKR {Number(st.fee_total_paid).toLocaleString()} / PKR {Number(st.fee_total_due).toLocaleString()}</span>
        </div>
        <div style={s.progressTrack}><div style={{ ...s.progressFill, width: `${collectionRate}%` }} /></div>
        <div style={s.progressPct}>{collectionRate}% collected</div>
      </div>

      <div style={s.twoCol}>
        <div style={s.monthCard}>
          <div style={s.monthLabel}>This Month</div>
          <div style={s.monthValue}>PKR {Number(st.this_month_paid).toLocaleString()}</div>
          <div style={{ ...s.monthBadge, background: monthUp ? '#dcfce7' : '#fee2e2', color: monthUp ? '#15803d' : '#dc2626' }}>
            {monthUp ? '▲' : '▼'} PKR {Math.abs(monthDiff).toLocaleString()} vs last month
          </div>
        </div>
        <div style={s.monthCard}>
          <div style={s.monthLabel}>Last Month</div>
          <div style={{ ...s.monthValue, color: '#64748b' }}>PKR {Number(st.last_month_paid).toLocaleString()}</div>
        </div>
      </div>

      <div style={s.twoCol}>
        {fee_by_class.length > 0 && (
          <div style={{ ...s.listCard, flex: 2, minWidth: '260px' }}>
            <div style={s.listCardTitle}>📚 Fee Collection by Class</div>
            {fee_by_class.map((c, i) => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{c.course}</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{c.rate}% · {c.student_count} students</span>
                </div>
                <div style={s.progressTrack}>
                  <div style={{ ...s.progressFill, width: `${c.rate}%`, background: c.rate >= 75 ? 'linear-gradient(90deg,#059669,#10b981)' : c.rate >= 40 ? 'linear-gradient(90deg,#d97706,#f59e0b)' : 'linear-gradient(90deg,#dc2626,#ef4444)' }} />
                </div>
              </div>
            ))}
          </div>
        )}
        {recent_payments.length > 0 && (
          <div style={{ ...s.listCard, flex: 1, minWidth: '220px' }}>
            <div style={s.listCardTitle}>💳 Recent Payments</div>
            {recent_payments.map((p, i) => (
              <div key={i} style={s.listRow}>
                <div style={{ ...s.listRowDot, background: '#10b981' }} />
                <div style={{ flex: 1 }}>
                  <span style={s.listRowMain}>{p.student}</span>
                  <span style={s.listRowSub}>{p.method} · {p.date}</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#059669' }}>PKR {Number(p.amount).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Academic Analytics ── */}
      <h3 style={{ ...s.sectionHeading, marginTop: 8 }}>Academic Analytics</h3>
      <div style={s.twoCol}>
        {students_by_class.length > 0 && (
          <div style={{ ...s.listCard, flex: 2, minWidth: '260px' }}>
            <div style={s.listCardTitle}>🎓 Students per Class</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={students_by_class} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                <XAxis dataKey="course" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} students`]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {students_by_class.map((_, i) => (
                    <Cell key={i} fill={['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444'][i % 6]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {gender_dist && (
          <div style={{ ...s.listCard, flex: 1, minWidth: '200px' }}>
            <div style={s.listCardTitle}>👥 Gender Distribution</div>
            <GenderPieChart dist={gender_dist} />
          </div>
        )}
      </div>

      {today_new_students.length > 0 && (
        <div style={s.listCard}>
          <div style={s.listCardTitle}>🆕 Today's New Admissions</div>
          {today_new_students.map((s2, i) => (
            <div key={i} style={s.listRow}>
              <div style={{ ...s.listRowDot, background: '#3b82f6' }} />
              <div style={{ flex: 1 }}>
                <span style={s.listRowMain}>{s2.name}</span>
                <span style={s.listRowSub}>{s2.admission_number}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {upcoming_exams?.length > 0 && (
        <div style={s.listCard}>
          <div style={s.listCardTitle}>📅 Upcoming Exams — Next 7 Days</div>
          {upcoming_exams.map(e => (
            <div key={e.id} style={s.listRow} onClick={() => navigate(`/exams/${e.id}`)}>
              <div style={s.listRowDot} />
              <div style={{ flex: 1 }}>
                <span style={s.listRowMain}>{e.name}</span>
                <span style={s.listRowSub}>{e.subject} · Section {e.section}</span>
              </div>
              <span style={s.listRowDate}>{e.date}</span>
            </div>
          ))}
        </div>
      )}

      {st.no_fee_package > 0 && (
        <div style={s.alertCard}>
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <span style={s.alertText}>
            <strong>{st.no_fee_package} active student{st.no_fee_package > 1 ? 's' : ''}</strong> {st.no_fee_package > 1 ? 'have' : 'has'} no fee package assigned.
          </span>
        </div>
      )}
    </section>
  );
}

const GENDER_COLORS = { Male: '#3b82f6', Female: '#ec4899', Other: '#94a3b8' };

function GenderPieChart({ dist }) {
  const total = dist.male + dist.female + dist.other;
  const data = [
    { name: 'Male',   value: dist.male   },
    { name: 'Female', value: dist.female },
    { name: 'Other',  value: dist.other  },
  ].filter(d => d.value > 0);
  if (!data.length) return null;
  return (
    <div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value">
            {data.map(entry => (
              <Cell key={entry.name} fill={GENDER_COLORS[entry.name]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => [`${v} students`]} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '4px' }}>
        {data.map(entry => (
          <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: GENDER_COLORS[entry.name], flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: '#334155', fontWeight: '600' }}>
              {entry.name} {total ? Math.round(entry.value / total * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrincipalStats({ stats, navigate }) {
  const { stats: st, upcoming_exams, students_by_class = [], gender_dist, gender_by_class = [], unmarked_sections = [] } = stats;
  const attGood = (st.today_attendance ?? 0) >= 75;

  return (
    <section>

      {/* ── School Summary ── */}
      <h3 style={s.sectionHeading}>School Overview</h3>
      <div style={s.statGrid}>
        <StatCard icon="🎓" label="Students"    value={st.total_students}  gradient="linear-gradient(135deg,#3730a3,#818cf8)" />
        <StatCard icon="🧑‍🏫" label="Teachers"   value={st.total_teachers}  gradient="linear-gradient(135deg,#1e40af,#60a5fa)" />
        <StatCard icon="📚" label="Classes"     value={st.total_courses}   gradient="linear-gradient(135deg,#6d28d9,#a78bfa)" />
        <StatCard icon="🏷️" label="Sections"    value={st.total_sections}  gradient="linear-gradient(135deg,#92400e,#fbbf24)" />
        <StatCard icon="📝" label="Total Exams" value={st.total_exams}     gradient="linear-gradient(135deg,#0e7490,#22d3ee)" />
      </div>

      {/* ── Student Attendance ── */}
      <h3 style={{ ...s.sectionHeading, marginTop: 8 }}>Student Attendance Today</h3>
      <div style={s.statGrid}>
        <StatCard icon="📅" label="Attendance Rate"
          value={st.today_attendance !== null ? `${st.today_attendance}%` : '—'}
          gradient={attGood ? 'linear-gradient(135deg,#065f46,#34d399)' : 'linear-gradient(135deg,#991b1b,#f87171)'} />
        <StatCard icon="❌" label="Absent Today"    value={st.students_absent_today ?? '—'} gradient="linear-gradient(135deg,#991b1b,#f87171)" />
        <StatCard icon="✅" label="Sections Marked" value={st.sections_marked ?? 0}         gradient="linear-gradient(135deg,#0e7490,#22d3ee)" />
        <StatCard icon="⏳" label="Not Marked Yet"  value={st.sections_unmarked ?? 0}       gradient="linear-gradient(135deg,#92400e,#fbbf24)" />
        <StatCard icon="👤" label="No Class Teacher" value={st.no_teacher_sections ?? 0}    gradient="linear-gradient(135deg,#be185d,#f472b6)" />
      </div>

      {/* Attendance progress bar */}
      <div style={s.progressCard}>
        <div style={s.progressHeader}>
          <span style={s.progressLabel}>Today's Attendance Rate</span>
          <span style={s.progressValue}>{st.sections_marked ?? 0} of {(st.sections_marked ?? 0) + (st.sections_unmarked ?? 0)} sections marked</span>
        </div>
        <div style={s.progressTrack}>
          <div style={{ ...s.progressFill, width: `${st.today_attendance ?? 0}%`, background: attGood ? 'linear-gradient(90deg,#059669,#10b981)' : 'linear-gradient(90deg,#dc2626,#ef4444)' }} />
        </div>
        <div style={s.progressPct}>{st.today_attendance ?? 0}% students present today</div>
      </div>

      {/* Unmarked sections alert */}
      {unmarked_sections.length > 0 && (
        <div style={{ ...s.alertCard, marginBottom: 16, alignItems: 'flex-start', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <strong style={s.alertText}>{st.sections_unmarked} section{st.sections_unmarked !== 1 ? 's' : ''} haven't marked attendance today</strong>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {unmarked_sections.map(sec => (
              <span key={sec.id} style={{ background: '#fff', border: '1px solid #fed7aa', borderRadius: 20, padding: '3px 10px', fontSize: 12, color: '#92400e', fontWeight: 600 }}>
                {sec.name}{sec.teacher ? ` · ${sec.teacher}` : ' · No teacher'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Teacher Attendance ── */}
      <h3 style={{ ...s.sectionHeading, marginTop: 8 }}>Teacher Attendance Today</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard icon="🧑‍🏫" label="Present"    value={st.teachers_present ?? 0}  gradient="linear-gradient(135deg,#065f46,#34d399)" />
        <StatCard icon="❌"   label="Absent"     value={st.teachers_absent ?? 0}   gradient="linear-gradient(135deg,#991b1b,#f87171)" />
        <StatCard icon="⏰"   label="Late"       value={st.teachers_late ?? 0}     gradient="linear-gradient(135deg,#92400e,#fbbf24)" />
        <StatCard icon="🌿"   label="On Leave"   value={st.teachers_leave ?? 0}    gradient="linear-gradient(135deg,#4c1d95,#8b5cf6)" />
        <StatCard icon="⏳"   label="Not Marked" value={st.teachers_unmarked ?? 0} gradient="linear-gradient(135deg,#0e7490,#22d3ee)" />
      </div>

      {/* ── Charts row ── */}
      <h3 style={{ ...s.sectionHeading, marginTop: 8 }}>Academic Analytics</h3>
      <div style={s.twoCol}>
        {students_by_class.length > 0 && (
          <div style={{ ...s.listCard, flex: 2, minWidth: '260px' }}>
            <div style={s.listCardTitle}>🎓 Students per Class</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={students_by_class} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                <XAxis dataKey="course" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} students`]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {students_by_class.map((_, i) => (
                    <Cell key={i} fill={['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444'][i % 6]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {gender_dist && (
          <div style={{ ...s.listCard, flex: 1, minWidth: '200px' }}>
            <div style={s.listCardTitle}>👥 Gender Distribution</div>
            <GenderPieChart dist={gender_dist} />
          </div>
        )}
      </div>

      {gender_by_class.length > 0 && (
        <div style={s.listCard}>
          <div style={s.listCardTitle}>👥 Gender per Class</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={gender_by_class} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
              <XAxis dataKey="course" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="male"   stackId="a" fill="#3b82f6" name="Male" />
              <Bar dataKey="female" stackId="a" fill="#ec4899" name="Female" radius={[4, 4, 0, 0]} />
              {gender_by_class.some(r => r.other > 0) && (
                <Bar dataKey="other" stackId="a" fill="#94a3b8" name="Other" radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Upcoming exams ── */}
      {upcoming_exams?.length > 0 && (
        <div style={s.listCard}>
          <div style={s.listCardTitle}>📅 Upcoming Exams — Next 7 Days</div>
          {upcoming_exams.map(e => (
            <div key={e.id} style={s.listRow} onClick={() => navigate(`/exams/${e.id}`)}>
              <div style={s.listRowDot} />
              <div style={{ flex: 1 }}>
                <span style={s.listRowMain}>{e.name}</span>
                <span style={s.listRowSub}>{e.subject} · Section {e.section}</span>
              </div>
              <span style={s.listRowDate}>{e.date}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SchoolAdminStats({ stats }) {
  const { stats: st, fee_by_class = [], recent_payments = [], today_new_students = [], students_by_class = [], gender_dist, unmarked_sections = [] } = stats;
  const collectionRate = st.fee_collection_rate ?? 0;
  const monthDiff = st.this_month_paid - st.last_month_paid;
  const monthUp   = monthDiff >= 0;
  const attGood   = (st.att_rate_today ?? 0) >= 75;

  return (
    <section>

      {/* ── Academic Overview ─────────────────────────────────────────── */}
      <h3 style={s.sectionHeading}>Academic Overview</h3>
      <div style={s.statGrid}>
        <StatCard icon="📅" label="Today's Attendance"
          value={`${st.att_rate_today ?? 0}%`}
          gradient={attGood ? 'linear-gradient(135deg,#065f46,#34d399)' : 'linear-gradient(135deg,#991b1b,#f87171)'} />
        <StatCard icon="✅" label="Sections Marked"
          value={st.sections_marked ?? 0}
          gradient="linear-gradient(135deg,#0e7490,#22d3ee)" />
        <StatCard icon="⏳" label="Not Marked Yet"
          value={st.sections_unmarked ?? 0}
          gradient="linear-gradient(135deg,#92400e,#fbbf24)" />
        <StatCard icon="👤" label="No Class Teacher"
          value={st.no_teacher_sections ?? 0}
          gradient="linear-gradient(135deg,#be185d,#f472b6)" />
      </div>

      {/* Attendance progress bar */}
      <div style={s.progressCard}>
        <div style={s.progressHeader}>
          <span style={s.progressLabel}>Today's Attendance Rate</span>
          <span style={s.progressValue}>{st.sections_marked ?? 0} of {(st.sections_marked ?? 0) + (st.sections_unmarked ?? 0)} sections marked</span>
        </div>
        <div style={s.progressTrack}>
          <div style={{ ...s.progressFill, width: `${st.att_rate_today ?? 0}%`, background: attGood ? 'linear-gradient(90deg,#059669,#10b981)' : 'linear-gradient(90deg,#dc2626,#ef4444)' }} />
        </div>
        <div style={s.progressPct}>{st.att_rate_today ?? 0}% students present today</div>
      </div>

      {/* Teacher attendance today */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard icon="🧑‍🏫" label="Teachers Present"  value={st.teachers_present ?? 0}  gradient="linear-gradient(135deg,#065f46,#34d399)" />
        <StatCard icon="❌"   label="Teachers Absent"   value={st.teachers_absent ?? 0}   gradient="linear-gradient(135deg,#991b1b,#f87171)" />
        <StatCard icon="⏰"   label="Teachers Late"     value={st.teachers_late ?? 0}     gradient="linear-gradient(135deg,#92400e,#fbbf24)" />
        <StatCard icon="🌿"   label="Leave"              value={st.teachers_leave ?? 0}    gradient="linear-gradient(135deg,#4c1d95,#8b5cf6)" />
        <StatCard icon="⏳"   label="Not Marked"        value={st.teachers_unmarked ?? 0} gradient="linear-gradient(135deg,#0e7490,#22d3ee)" />
      </div>

      {/* Sections that haven't marked attendance */}
      {unmarked_sections.length > 0 && (
        <div style={{ ...s.alertCard, marginBottom: 16, alignItems: 'flex-start', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <strong style={s.alertText}>{st.sections_unmarked} section{st.sections_unmarked !== 1 ? 's' : ''} haven't marked attendance today</strong>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {unmarked_sections.map(sec => (
              <span key={sec.id} style={{ background: '#fff', border: '1px solid #fed7aa', borderRadius: 20, padding: '3px 10px', fontSize: 12, color: '#92400e', fontWeight: 600 }}>
                {sec.name}{sec.teacher ? ` · ${sec.teacher}` : ' · No teacher'}
              </span>
            ))}
          </div>
        </div>
      )}

      <h3 style={{ ...s.sectionHeading, marginTop: 8 }}>Financial Overview</h3>

      {/* ── Stat cards ── */}
      <div style={s.statGrid}>
        <StatCard icon="🎓" label="Students"           value={st.total_students}      gradient="linear-gradient(135deg,#3730a3,#818cf8)" />
        <StatCard icon="🏫" label="Teachers"           value={st.total_teachers}      gradient="linear-gradient(135deg,#1e40af,#60a5fa)" />
        <StatCard icon="🏷️" label="Sections"           value={st.total_sections}      gradient="linear-gradient(135deg,#92400e,#fbbf24)" />
        <StatCard icon="💰" label="Fee Collected"      value={`${collectionRate}%`}   gradient="linear-gradient(135deg,#065f46,#34d399)" />
        <StatCard icon="⏳" label="Pending Fees"       value={st.pending_fees}        gradient="linear-gradient(135deg,#c2410c,#fb923c)" />
        <StatCard icon="⚠️" label="Overdue Fees"       value={st.overdue_fees}        gradient="linear-gradient(135deg,#991b1b,#f87171)" />
        <StatCard icon="🚨" label="Fee Defaulters"     value={st.fee_defaulters}      gradient="linear-gradient(135deg,#7f1d1d,#fca5a5)" />
        <StatCard icon="📋" label="No Fee Assigned"    value={st.no_fee_package}      gradient="linear-gradient(135deg,#be185d,#f472b6)" />
        <StatCard icon="🆕" label="Today's Admissions" value={st.today_admissions}    gradient="linear-gradient(135deg,#0e7490,#22d3ee)" />
      </div>

      {/* ── Overall fee progress bar ── */}
      <div style={s.progressCard}>
        <div style={s.progressHeader}>
          <span style={s.progressLabel}>Overall Fee Collection</span>
          <span style={s.progressValue}>PKR {Number(st.fee_total_paid).toLocaleString()} / PKR {Number(st.fee_total_due).toLocaleString()}</span>
        </div>
        <div style={s.progressTrack}><div style={{ ...s.progressFill, width: `${collectionRate}%` }} /></div>
        <div style={s.progressPct}>{collectionRate}% collected</div>
      </div>

      {/* ── This month vs last month ── */}
      <div style={s.twoCol}>
        <div style={s.monthCard}>
          <div style={s.monthLabel}>This Month</div>
          <div style={s.monthValue}>PKR {Number(st.this_month_paid).toLocaleString()}</div>
          <div style={{ ...s.monthBadge, background: monthUp ? '#dcfce7' : '#fee2e2', color: monthUp ? '#15803d' : '#dc2626' }}>
            {monthUp ? '▲' : '▼'} PKR {Math.abs(monthDiff).toLocaleString()} vs last month
          </div>
        </div>
        <div style={s.monthCard}>
          <div style={s.monthLabel}>Last Month</div>
          <div style={{ ...s.monthValue, color: '#64748b' }}>PKR {Number(st.last_month_paid).toLocaleString()}</div>
        </div>
      </div>

      {/* ── Fee collection by class + Recent payments ── */}
      <div style={s.twoCol}>
        {fee_by_class.length > 0 && (
          <div style={{ ...s.listCard, flex: 2, minWidth: '260px' }}>
            <div style={s.listCardTitle}>📚 Fee Collection by Class</div>
            {fee_by_class.map((c, i) => (
              <div key={i} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{c.course}</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {c.rate}% · {c.student_count} students
                  </span>
                </div>
                <div style={s.progressTrack}>
                  <div style={{
                    ...s.progressFill,
                    width: `${c.rate}%`,
                    background: c.rate >= 75
                      ? 'linear-gradient(90deg,#059669,#10b981)'
                      : c.rate >= 40
                        ? 'linear-gradient(90deg,#d97706,#f59e0b)'
                        : 'linear-gradient(90deg,#dc2626,#ef4444)',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {recent_payments.length > 0 && (
          <div style={{ ...s.listCard, flex: 1, minWidth: '220px' }}>
            <div style={s.listCardTitle}>💳 Recent Payments</div>
            {recent_payments.map((p, i) => (
              <div key={i} style={s.listRow}>
                <div style={{ ...s.listRowDot, background: '#10b981' }} />
                <div style={{ flex: 1 }}>
                  <span style={s.listRowMain}>{p.student}</span>
                  <span style={s.listRowSub}>{p.method} · {p.date}</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#059669' }}>
                  PKR {Number(p.amount).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Today's admissions (full width if alone) ── */}
      {today_new_students.length > 0 && (
        <div style={s.listCard}>
          <div style={s.listCardTitle}>🆕 Today's New Admissions</div>
          {today_new_students.map((s2, i) => (
            <div key={i} style={s.listRow}>
              <div style={{ ...s.listRowDot, background: '#3b82f6' }} />
              <div style={{ flex: 1 }}>
                <span style={s.listRowMain}>{s2.name}</span>
                <span style={s.listRowSub}>{s2.admission_number}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Charts row: students per class + gender donut ── */}
      <div style={s.twoCol}>
        {students_by_class.length > 0 && (
          <div style={{ ...s.listCard, flex: 2, minWidth: '260px' }}>
            <div style={s.listCardTitle}>🎓 Students per Class</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={students_by_class} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                <XAxis dataKey="course" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} students`]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {students_by_class.map((_, i) => (
                    <Cell key={i} fill={['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444'][i % 6]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {gender_dist && (
          <div style={{ ...s.listCard, flex: 1, minWidth: '200px' }}>
            <div style={s.listCardTitle}>👥 Gender Distribution</div>
            <GenderPieChart dist={gender_dist} />
          </div>
        )}
      </div>

      {/* ── Alert: students with no fee package ── */}
      {st.no_fee_package > 0 && (
        <div style={s.alertCard}>
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <span style={s.alertText}>
            <strong>{st.no_fee_package} active student{st.no_fee_package > 1 ? 's' : ''}</strong> {st.no_fee_package > 1 ? 'have' : 'has'} no fee package assigned. Go to Student Fees to fix this.
          </span>
        </div>
      )}
    </section>
  );
}

function TeacherTimingWidget({ sections, compact }) {
  const [schoolTiming, setSchoolTiming] = useState(null);

  useEffect(() => {
    api.get('/courses/school-settings/').then(r => setSchoolTiming(r.data)).catch(() => {});
  }, []);

  const inchargeSections = (sections || []).filter(sec =>
    sec.school_start_time || sec.school_end_time || sec.break_start_time || sec.break_end_time
  );

  const timing = inchargeSections.length === 1
    ? {
        school_start_time: inchargeSections[0].school_start_time || schoolTiming?.school_start_time,
        school_end_time:   inchargeSections[0].school_end_time   || schoolTiming?.school_end_time,
        break_start_time:  inchargeSections[0].break_start_time  || schoolTiming?.break_start_time,
        break_end_time:    inchargeSections[0].break_end_time    || schoolTiming?.break_end_time,
        sectionLabel: `${inchargeSections[0].course} — Section ${inchargeSections[0].name}`,
      }
    : schoolTiming
      ? { ...schoolTiming, sectionLabel: null }
      : null;

  if (!timing) return compact ? <div style={{ flex: 1 }} /> : null;

  const fmt = (t) => t ? String(t).slice(0, 5) : null;

  if (compact) {
    return (
      <div style={ts.timingCompact}>
        <div style={ts.panelHeader}>
          <span style={ts.panelTitle}>⏰ {timing.sectionLabel ? 'My Class Timing' : 'School Timings'}</span>
          {timing.sectionLabel && <span style={{ fontSize: 10, background: '#eff6ff', color: '#2563eb', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>Incharge</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          {fmt(timing.school_start_time) && (
            <div style={ts.timingRow}>
              <span style={{ ...ts.timingDot, background: '#22c55e' }} />
              <span style={{ fontSize: 12, color: '#64748b', flex: 1 }}>School Start</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#15803d' }}>{fmt(timing.school_start_time)}</span>
            </div>
          )}
          {fmt(timing.break_start_time) && (
            <div style={ts.timingRow}>
              <span style={{ ...ts.timingDot, background: '#f59e0b' }} />
              <span style={{ fontSize: 12, color: '#64748b', flex: 1 }}>Break</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#d97706' }}>
                {fmt(timing.break_start_time)}{fmt(timing.break_end_time) ? ` – ${fmt(timing.break_end_time)}` : ''}
              </span>
            </div>
          )}
          {fmt(timing.school_end_time) && (
            <div style={ts.timingRow}>
              <span style={{ ...ts.timingDot, background: '#ef4444' }} />
              <span style={{ fontSize: 12, color: '#64748b', flex: 1 }}>School End</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#dc2626' }}>{fmt(timing.school_end_time)}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={s.timingCard}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={s.timingCardTitle}>⏰ {timing.sectionLabel ? 'My Class Timing' : 'School Timings'}</div>
        {timing.sectionLabel && <span style={s.timingInchargeBadge}>🏫 {timing.sectionLabel} · Incharge</span>}
      </div>
      <div style={s.timingPills}>
        {fmt(timing.school_start_time) && (
          <div style={{ ...s.timingPill, background: '#dcfce7', border: '1.5px solid #86efac' }}>
            <span style={s.timingPillIcon}>🌅</span>
            <div>
              <div style={{ ...s.timingPillLabel, color: '#15803d' }}>Start</div>
              <div style={{ ...s.timingPillValue, color: '#15803d' }}>{fmt(timing.school_start_time)}</div>
            </div>
          </div>
        )}
        {fmt(timing.school_end_time) && (
          <div style={{ ...s.timingPill, background: '#fee2e2', border: '1.5px solid #fca5a5' }}>
            <span style={s.timingPillIcon}>🌇</span>
            <div>
              <div style={{ ...s.timingPillLabel, color: '#dc2626' }}>End</div>
              <div style={{ ...s.timingPillValue, color: '#dc2626' }}>{fmt(timing.school_end_time)}</div>
            </div>
          </div>
        )}
        {fmt(timing.break_start_time) && (
          <div style={{ ...s.timingPill, background: '#fef3c7', border: '1.5px solid #fcd34d' }}>
            <span style={s.timingPillIcon}>☕</span>
            <div>
              <div style={{ ...s.timingPillLabel, color: '#d97706' }}>Break</div>
              <div style={{ ...s.timingPillValue, color: '#d97706' }}>
                {fmt(timing.break_start_time)}{fmt(timing.break_end_time) ? ` – ${fmt(timing.break_end_time)}` : ''}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TeacherStats({ stats, navigate }) {
  const { stats: st, sections, subjects, upcoming_exams, salary } = stats;

  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const salaryStatus = salary?.status ?? null;
  const salaryCfg = {
    paid:    { color: '#4ade80', bg: 'rgba(74,222,128,0.15)', label: '✓ Fully Paid' },
    partial: { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', label: '◑ Partial' },
    pending: { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', label: '⏳ Pending' },
  }[salaryStatus] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: 'No Sheet' };

  const attendanceSections = (sections || []).filter(s => s.is_class_teacher);
  const markedCount  = attendanceSections.filter(s => s.marked_today).length;
  const pendingCount = attendanceSections.length - markedCount;

  return (
    <section>

      {/* ── Hero strip ─────────────────────────────────────────────────── */}
      <div style={ts.hero}>
        {/* Left: quick stats */}
        <div style={ts.heroStats}>
          <div style={ts.heroStat}>
            <div style={ts.heroStatVal}>{st.total_students ?? 0}</div>
            <div style={ts.heroStatLbl}>Students</div>
          </div>
          <div style={ts.heroDiv} />
          <div style={ts.heroStat}>
            <div style={ts.heroStatVal}>{st.total_sections ?? 0}</div>
            <div style={ts.heroStatLbl}>Classes</div>
          </div>
          <div style={ts.heroDiv} />
          <div style={ts.heroStat}>
            <div style={ts.heroStatVal}>{st.total_subjects ?? 0}</div>
            <div style={ts.heroStatLbl}>Subjects</div>
          </div>
          <div style={ts.heroDiv} />
          <div style={ts.heroStat}>
            <div style={{ ...ts.heroStatVal, color: pendingCount > 0 ? '#f87171' : '#4ade80' }}>
              {pendingCount > 0 ? pendingCount : '✓'}
            </div>
            <div style={ts.heroStatLbl}>{pendingCount > 0 ? 'Att. Pending' : 'Att. Done'}</div>
          </div>
        </div>

        {/* Right: today */}
        <div style={ts.heroDate}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Today</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginTop: 2 }}>{todayName}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>{todayDate}</div>
        </div>
      </div>

      {/* ── Two-column: Salary card + Timing widget ────────────────────── */}
      <div style={ts.twoCol}>

        {/* Salary card */}
        <div style={ts.salaryCard}>
          <div style={ts.salaryCardTop}>
            <div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>This Month's Net Salary</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginTop: 4, letterSpacing: '-0.5px' }}>
                {salary ? `PKR ${Number(salary.net_salary).toLocaleString()}` : '—'}
              </div>
            </div>
            <span style={{ background: salaryCfg.bg, color: salaryCfg.color, border: `1px solid ${salaryCfg.color}`, borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>
              {salaryCfg.label}
            </span>
          </div>

          {salary ? (
            <div style={ts.salaryRow}>
              <div style={ts.salaryItem}>
                <div style={ts.salaryItemLbl}>Received</div>
                <div style={{ ...ts.salaryItemVal, color: '#4ade80' }}>PKR {Number(salary.amount_paid).toLocaleString()}</div>
              </div>
              <div style={ts.salaryDiv} />
              <div style={ts.salaryItem}>
                <div style={ts.salaryItemLbl}>Balance Due</div>
                <div style={{ ...ts.salaryItemVal, color: salary.balance > 0 ? '#f87171' : '#4ade80' }}>
                  {salary.balance > 0 ? `PKR ${Number(salary.balance).toLocaleString()}` : 'Nil'}
                </div>
              </div>
              <div style={ts.salaryDiv} />
              <div style={ts.salaryItem}>
                <div style={ts.salaryItemLbl}>Payment Mode</div>
                <div style={ts.salaryItemVal}>—</div>
              </div>
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>No salary sheet generated this month yet.</div>
          )}

          <button onClick={() => navigate('/salary/my-salary')}
            style={ts.salaryBtn}>
            View All Salary Slips →
          </button>
        </div>

        {/* Timing widget — now inline */}
        <TeacherTimingWidget sections={sections} compact />
      </div>

      {/* ── My Classes ─────────────────────────────────────────────────── */}
      <div style={ts.panelCard}>
        <div style={ts.panelHeader}>
          <span style={ts.panelTitle}>🏫 My Classes</span>
          {attendanceSections.length > 0 && (
            <span style={{ fontSize: 12, color: pendingCount > 0 ? '#dc2626' : '#059669', fontWeight: 700, background: pendingCount > 0 ? '#fee2e2' : '#dcfce7', padding: '3px 10px', borderRadius: 20 }}>
              {pendingCount > 0 ? `${pendingCount} attendance pending` : 'All marked ✓'}
            </span>
          )}
        </div>

        {sections?.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 12 }}>
            {sections.map(sec => (
              <div key={sec.id} style={{
                ...ts.classCard,
                borderLeft: `4px solid ${sec.is_class_teacher ? (sec.marked_today ? '#10b981' : '#ef4444') : '#6366f1'}`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                      {sec.course}{sec.name ? ` · ${sec.name}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{sec.academic_year}</div>
                  </div>
                  {sec.is_class_teacher ? (
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                      background: sec.marked_today ? '#dcfce7' : '#fee2e2',
                      color:      sec.marked_today ? '#15803d' : '#dc2626',
                    }}>
                      {sec.marked_today ? '✓ Marked' : '⚠ Pending'}
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, fontWeight: 700, background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 20 }}>Subject</span>
                  )}
                </div>
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 18 }}>👩‍🎓</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{sec.students} students</span>
                  {sec.is_class_teacher && (
                    <span style={{ marginLeft: 'auto', fontSize: 10, background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>Class Teacher</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={ts.emptyState}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📚</div>
            <div style={{ fontWeight: 700, color: '#475569', fontSize: 14 }}>No classes assigned yet</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Contact admin to get assigned to a class or subject.</div>
          </div>
        )}
      </div>

      {/* ── Subjects + Upcoming Exams row ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Subjects I Teach */}
        <div style={ts.panelCard}>
          <div style={ts.panelHeader}>
            <span style={ts.panelTitle}>📖 Subjects I Teach</span>
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{subjects?.length ?? 0} subject{subjects?.length !== 1 ? 's' : ''}</span>
          </div>
          {subjects?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {subjects.map(sub => (
                <div key={sub.id} style={ts.subjectRow}>
                  <div style={ts.subjectDot} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{sub.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{sub['course__name']}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: 13, padding: '8px 0' }}>No subjects assigned.</div>
          )}
        </div>

        {/* Upcoming Exams */}
        <div style={ts.panelCard}>
          <div style={ts.panelHeader}>
            <span style={ts.panelTitle}>📅 Upcoming Exams</span>
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>Next 7 days</span>
          </div>
          {upcoming_exams?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {upcoming_exams.map(e => (
                <div key={e.id} style={ts.examRow}>
                  <div style={ts.examDateBox}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#1d4ed8', lineHeight: 1 }}>
                      {new Date(e.date).getDate()}
                    </div>
                    <div style={{ fontSize: 9, color: '#6366f1', fontWeight: 700, textTransform: 'uppercase' }}>
                      {new Date(e.date).toLocaleString('en-US', { month: 'short' })}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{e.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{e.subject} · Section {e.section}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={ts.emptyState}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🎉</div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>No exams this week</div>
            </div>
          )}
        </div>

      </div>
    </section>
  );
}

function StudentStats({ stats, navigate }) {
  const { stats: st, upcoming_exams, recent_results } = stats;
  const good = st.attendance_percentage >= 75;
  return (
    <section>
      <h3 style={s.sectionHeading}>My Overview</h3>
      <div style={s.statGrid}>
        <StatCard icon="📅" label="Attendance"  value={`${st.attendance_percentage}%`} gradient={good ? 'linear-gradient(135deg,#065f46,#34d399)' : 'linear-gradient(135deg,#991b1b,#f87171)'} />
        <StatCard icon="✅" label="Present"     value={st.present} gradient="linear-gradient(135deg,#065f46,#34d399)" />
        <StatCard icon="❌" label="Absent"      value={st.absent}  gradient="linear-gradient(135deg,#991b1b,#f87171)" />
        <StatCard icon="⏰" label="Late"        value={st.late}    gradient="linear-gradient(135deg,#92400e,#fbbf24)" />
        <StatCard icon="📍" label="Today"
          value={st.today_status ? st.today_status.toUpperCase() : '—'}
          gradient={st.today_status === 'present' ? 'linear-gradient(135deg,#065f46,#34d399)' : st.today_status === 'absent' ? 'linear-gradient(135deg,#991b1b,#f87171)' : 'linear-gradient(135deg,#92400e,#fbbf24)'}
        />
        <StatCard icon="💳" label="Fee Balance"
          value={`PKR ${Number(st.fee_balance).toLocaleString()}`}
          gradient={st.fee_balance > 0 ? 'linear-gradient(135deg,#991b1b,#f87171)' : 'linear-gradient(135deg,#065f46,#34d399)'}
        />
      </div>
      <div style={s.progressCard}>
        <div style={s.progressHeader}>
          <span style={s.progressLabel}>Attendance Rate</span>
          <span style={s.progressValue}>{st.present} / {st.total_classes} classes</span>
        </div>
        <div style={s.progressTrack}>
          <div style={{ ...s.progressFill, width: `${st.attendance_percentage}%`, background: good ? 'linear-gradient(90deg,#059669,#10b981)' : 'linear-gradient(90deg,#dc2626,#ef4444)' }} />
        </div>
        <div style={s.progressPct}>{st.attendance_percentage}% attendance</div>
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {upcoming_exams?.length > 0 && (
          <div style={{ ...s.listCard, flex: 1, minWidth: '260px' }}>
            <div style={s.listCardTitle}>📝 Upcoming Exams</div>
            {upcoming_exams.map(e => (
              <div key={e.id} style={s.listRow}>
                <div style={s.listRowDot} />
                <div style={{ flex: 1 }}>
                  <span style={s.listRowMain}>{e.name}</span>
                  <span style={s.listRowSub}>{e.subject}</span>
                </div>
                <span style={s.listRowDate}>{e.date}</span>
              </div>
            ))}
          </div>
        )}
        {recent_results?.length > 0 && (
          <div style={{ ...s.listCard, flex: 1, minWidth: '260px' }}>
            <div style={s.listCardTitle}>🏆 Recent Results</div>
            {recent_results.map((r, i) => (
              <div key={i} style={s.listRow}>
                <div style={{ ...s.listRowDot, background: r.passed ? '#10b981' : '#ef4444' }} />
                <div style={{ flex: 1 }}>
                  <span style={s.listRowMain}>{r.exam}</span>
                  <span style={s.listRowSub}>{r.subject} · {r.marks}</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '800', color: r.passed ? '#059669' : '#dc2626' }}>{r.grade}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ParentStats({ stats }) {
  const { children } = stats;
  if (!children?.length) return null;
  return (
    <section>
      <h3 style={s.sectionHeading}>My Children</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        {children.map((child, i) => (
          <div key={i} style={s.childCard}>
            <div style={s.childAvatar}>{child.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</div>
            <div style={s.childName}>{child.name}</div>
            <div style={s.childSec}>{child.section}</div>
            <div style={s.childStats}>
              <div style={s.childStat}>
                <span style={s.childStatLabel}>Attendance</span>
                <span style={{ fontWeight: '800', fontSize: '18px', color: child.attendance_pct >= 75 ? '#059669' : '#dc2626' }}>{child.attendance_pct}%</span>
              </div>
              <div style={s.childStat}>
                <span style={s.childStatLabel}>Fee Balance</span>
                <span style={{ fontWeight: '800', fontSize: '16px', color: child.fee_balance > 0 ? '#dc2626' : '#059669' }}>PKR {Number(child.fee_balance).toLocaleString()}</span>
              </div>
            </div>
            {child.last_result && (
              <div style={s.childResult}>
                <span style={{ color: '#64748b' }}>Last: </span>
                <strong>{child.last_result.exam}</strong>
                <span style={{ marginLeft: '6px', fontWeight: '800', color: child.last_result.passed ? '#059669' : '#dc2626' }}>{child.last_result.grade}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function StatCard({ icon, label, value, gradient }) {
  return (
    <div style={{ ...s.statCard, background: gradient }}>
      <div style={s.statIcon}>{icon}</div>
      <div style={s.statValue}>{value}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

const s = {
  banner:        { background: 'linear-gradient(135deg,#1e3a5f 0%,#1e40af 60%,#2563eb 100%)', borderRadius: '16px', padding: '28px 32px', marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  bannerTitle:   { color: '#fff', fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0', letterSpacing: '-0.3px' },
  bannerSub:     { color: 'rgba(255,255,255,0.7)', fontSize: '14px', margin: 0 },
  bannerBadge:   { background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '12px', fontWeight: '700', padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.25)', whiteSpace: 'nowrap' },
  sectionHeading:{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a' },
  statGrid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '14px', marginBottom: '16px' },
  statCard:      { borderRadius: '14px', padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: '4px' },
  statIcon:      { fontSize: '22px', marginBottom: '4px' },
  statValue:     { fontSize: '24px', fontWeight: '800', color: '#fff', lineHeight: 1 },
  statLabel:     { fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  progressCard:  { background: '#fff', borderRadius: '14px', padding: '18px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  progressHeader:{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' },
  progressLabel: { fontSize: '13px', fontWeight: '600', color: '#334155' },
  progressValue: { fontSize: '13px', color: '#64748b' },
  progressTrack: { background: '#f1f5f9', borderRadius: '8px', height: '8px', overflow: 'hidden' },
  progressFill:  { height: '100%', background: 'linear-gradient(90deg,#059669,#10b981)', borderRadius: '8px', transition: 'width 0.6s ease' },
  progressPct:   { fontSize: '12px', color: '#94a3b8', marginTop: '6px', textAlign: 'right' },
  listCard:      { background: '#fff', borderRadius: '14px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  listCardTitle: { fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '12px' },
  listRow:       { display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 0', borderBottom: '1px solid #f8fafc', cursor: 'pointer' },
  listRowDot:    { width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0 },
  listRowMain:   { display: 'block', fontSize: '13px', fontWeight: '600', color: '#1e293b' },
  listRowSub:    { display: 'block', fontSize: '11px', color: '#94a3b8', marginTop: '1px' },
  listRowDate:   { fontSize: '11px', color: '#64748b', fontWeight: '600', whiteSpace: 'nowrap' },
  childCard:     { background: '#fff', borderRadius: '14px', padding: '20px', minWidth: '220px', flex: '1', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' },
  childAvatar:   { width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700', color: '#fff', marginBottom: '10px' },
  childName:     { fontSize: '15px', fontWeight: '700', color: '#0f172a' },
  childSec:      { fontSize: '12px', color: '#94a3b8', marginBottom: '14px' },
  childStats:    { display: 'flex', gap: '20px', marginBottom: '12px' },
  childStat:     { display: 'flex', flexDirection: 'column', gap: '2px' },
  childStatLabel:{ fontSize: '11px', color: '#94a3b8', fontWeight: '600' },
  childResult:   { fontSize: '12px', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '10px' },
  twoCol:        { display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '0' },
  monthCard:     { flex: 1, minWidth: '160px', background: '#fff', borderRadius: '14px', padding: '18px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  monthLabel:    { fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '6px' },
  monthValue:    { fontSize: '22px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' },
  monthBadge:    { fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', display: 'inline-block' },
  alertCard:     { display: 'flex', alignItems: 'center', gap: '12px', background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: '12px', padding: '14px 18px', marginTop: '4px' },
  alertText:     { fontSize: '13px', color: '#92400e' },

  timingCard:          { background: '#fff', borderRadius: '14px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' },
  timingCardTitle:     { fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '14px' },
  timingSection:       { marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid #f8fafc' },
  timingSectionName:   { fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' },
  timingInchargeBadge: { fontSize: '10px', fontWeight: '700', background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '20px', border: '1px solid #bfdbfe' },
  timingPills:         { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  timingPill:          { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px' },
  timingPillIcon:      { fontSize: '16px' },
  timingPillLabel:     { fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' },
  timingPillValue:     { fontSize: '14px', fontWeight: '800' },

};

/* ── Teacher dashboard styles ─────────────────────────────────────────────── */
const ts = {
  /* Hero strip */
  hero: {
    background: 'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)',
    borderRadius: 16, padding: '20px 24px', marginBottom: 16,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 16, flexWrap: 'wrap', boxShadow: '0 6px 24px rgba(15,23,42,0.18)',
  },
  heroStats:   { display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap' },
  heroStat:    { textAlign: 'center', padding: '0 22px' },
  heroStatVal: { fontSize: 26, fontWeight: 900, color: '#fff', lineHeight: 1 },
  heroStatLbl: { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 },
  heroDiv:     { width: 1, height: 36, background: 'rgba(255,255,255,0.1)' },
  heroDate:    { textAlign: 'right', padding: '0 4px' },

  /* Two-col layout */
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },

  /* Salary card */
  salaryCard: {
    background: 'linear-gradient(140deg,#1e3a5f 0%,#1e40af 100%)',
    borderRadius: 14, padding: '20px 22px',
    display: 'flex', flexDirection: 'column', gap: 14,
    boxShadow: '0 4px 20px rgba(30,64,175,0.25)',
  },
  salaryCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  salaryRow:     { display: 'flex', alignItems: 'center', gap: 0, background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 0' },
  salaryItem:    { flex: 1, textAlign: 'center', padding: '0 14px' },
  salaryItemLbl: { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 },
  salaryItemVal: { fontSize: 14, fontWeight: 800, color: '#fff' },
  salaryDiv:     { width: 1, height: 32, background: 'rgba(255,255,255,0.12)' },
  salaryBtn: {
    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff', borderRadius: 9, padding: '8px 16px', cursor: 'pointer',
    fontSize: 12, fontWeight: 700, alignSelf: 'flex-start',
  },

  /* Timing compact */
  timingCompact: {
    background: '#fff', borderRadius: 14, padding: '18px 20px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0',
    display: 'flex', flexDirection: 'column', gap: 0,
  },
  timingRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc' },
  timingDot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },

  /* Panel card (generic white card) */
  panelCard: {
    background: '#fff', borderRadius: 14, padding: '18px 20px', marginBottom: 16,
    boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9',
  },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  panelTitle:  { fontSize: 14, fontWeight: 800, color: '#0f172a' },

  /* Class cards grid */
  classCard: {
    background: '#f8fafc', borderRadius: 12, padding: '14px 16px',
    border: '1px solid #e2e8f0', cursor: 'default',
  },

  /* Empty state */
  emptyState: { textAlign: 'center', padding: '28px 0', color: '#94a3b8' },

  /* Subject rows */
  subjectRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fafc' },
  subjectDot: { width: 8, height: 8, borderRadius: '50%', background: '#6366f1', flexShrink: 0 },

  /* Exam rows */
  examRow:     { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f8fafc' },
  examDateBox: { width: 38, height: 42, background: '#eff6ff', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid #bfdbfe' },
};
