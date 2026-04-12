import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import CourseDetailPage from './pages/courses/CourseDetailPage';
import CoursesPage from './pages/courses/CoursesPage';
import SessionsPage from './pages/courses/SessionsPage';
import SchoolTimingsPage from './pages/courses/SchoolTimingsPage';
import CreateUserPage from './pages/CreateUserPage';
import ProfilePage from './pages/ProfilePage';
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import EnrollStudentPage from './pages/students/EnrollStudentPage';
import MyStudentProfilePage from './pages/students/MyStudentProfilePage';
import StudentDetailPage from './pages/students/StudentDetailPage';
import StudentsPage from './pages/students/StudentsPage';
import TeachersPage from './pages/teachers/TeachersPage';
import TeacherDetailPage from './pages/teachers/TeacherDetailPage';
import SalaryPage from './pages/teachers/SalaryPage';
import SalaryHistoryPage from './pages/teachers/SalaryHistoryPage';
import MySalaryPage from './pages/teachers/MySalaryPage';
import StudentAttendancePage from './pages/attendance/StudentAttendancePage';
import MarkAttendancePage from './pages/attendance/MarkAttendancePage';
import MyAttendancePage from './pages/attendance/MyAttendancePage';
import AttendanceHistoryPage from './pages/attendance/AttendanceHistoryPage';
import TeacherAttendancePage from './pages/attendance/TeacherAttendancePage';
import MyTeacherAttendancePage from './pages/attendance/MyTeacherAttendancePage';
import ExamsPage from './pages/exams/ExamsPage';
import ExamDetailPage from './pages/exams/ExamDetailPage';
import MyResultsPage from './pages/exams/MyResultsPage';
import FeesPage from './pages/fees/FeesPage';
import EnrollmentFeesPage from './pages/fees/EnrollmentFeesPage';
import MyFeesPage from './pages/fees/MyFeesPage';
import SendNotificationsPage from './pages/notifications/SendNotificationsPage';
import ReportsPage from './pages/reports/ReportsPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import TokenResetPage from './pages/TokenResetPage';
import SchoolSettingsPage from './pages/SchoolSettingsPage';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('access_token');
  return token ? <Layout>{children}</Layout> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const token = localStorage.getItem('access_token');
  return token ? <Navigate to="/dashboard" replace /> : children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public — no layout */}
      <Route path="/login"                   element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/forgot-password"         element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/reset-password-confirm"  element={<PublicRoute><TokenResetPage /></PublicRoute>} />

      {/* Private — all wrapped in Layout via PrivateRoute */}
      <Route path="/reset-password"          element={<PrivateRoute><ResetPasswordPage /></PrivateRoute>} />
      <Route path="/dashboard"               element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
      <Route path="/profile"                 element={<PrivateRoute><ProfilePage /></PrivateRoute>} />

      {/* User Management */}
      <Route path="/users/create"            element={<PrivateRoute><CreateUserPage /></PrivateRoute>} />

      {/* Courses & Sessions */}
      <Route path="/courses"                 element={<PrivateRoute><CoursesPage /></PrivateRoute>} />
      <Route path="/courses/:id"             element={<PrivateRoute><CourseDetailPage /></PrivateRoute>} />
      <Route path="/sessions"                element={<PrivateRoute><SessionsPage /></PrivateRoute>} />
      <Route path="/school-timings"          element={<PrivateRoute><SchoolTimingsPage /></PrivateRoute>} />

      {/* Students */}
      <Route path="/students"                element={<PrivateRoute><StudentsPage /></PrivateRoute>} />
      <Route path="/students/enroll"         element={<PrivateRoute><EnrollStudentPage /></PrivateRoute>} />
      <Route path="/students/me"             element={<PrivateRoute><MyStudentProfilePage /></PrivateRoute>} />
      <Route path="/students/:id"            element={<PrivateRoute><StudentDetailPage /></PrivateRoute>} />

      {/* Teachers */}
      <Route path="/teachers"                element={<PrivateRoute><TeachersPage /></PrivateRoute>} />
      <Route path="/teachers/:id"            element={<PrivateRoute><TeacherDetailPage /></PrivateRoute>} />

      {/* Salary */}
      <Route path="/salary"                  element={<PrivateRoute><SalaryPage /></PrivateRoute>} />
      <Route path="/salary/history"          element={<PrivateRoute><SalaryHistoryPage /></PrivateRoute>} />
      <Route path="/salary/my-salary"        element={<PrivateRoute><MySalaryPage /></PrivateRoute>} />

      {/* Attendance */}
      <Route path="/attendance"              element={<PrivateRoute><StudentAttendancePage /></PrivateRoute>} />
      <Route path="/attendance/mark"         element={<PrivateRoute><MarkAttendancePage /></PrivateRoute>} />
      <Route path="/attendance/history"      element={<PrivateRoute><AttendanceHistoryPage /></PrivateRoute>} />
      <Route path="/attendance/me"                  element={<PrivateRoute><MyAttendancePage /></PrivateRoute>} />
      <Route path="/attendance/teachers"           element={<PrivateRoute><TeacherAttendancePage /></PrivateRoute>} />
      <Route path="/attendance/teachers/me"        element={<PrivateRoute><MyTeacherAttendancePage /></PrivateRoute>} />

      {/* Exams */}
      <Route path="/exams"                   element={<PrivateRoute><ExamsPage /></PrivateRoute>} />
      <Route path="/exams/my-results"        element={<PrivateRoute><MyResultsPage /></PrivateRoute>} />
      <Route path="/exams/:id"               element={<PrivateRoute><ExamDetailPage /></PrivateRoute>} />

      {/* Fees */}
      <Route path="/fees"                    element={<PrivateRoute><FeesPage /></PrivateRoute>} />
      <Route path="/fees/my-fees"            element={<PrivateRoute><MyFeesPage /></PrivateRoute>} />

      {/* Notifications */}
      <Route path="/notifications/send"      element={<PrivateRoute><SendNotificationsPage /></PrivateRoute>} />

      {/* Reports */}
      <Route path="/reports"                 element={<PrivateRoute><ReportsPage /></PrivateRoute>} />

      {/* School Settings */}
      <Route path="/school-settings"         element={<PrivateRoute><SchoolSettingsPage /></PrivateRoute>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
