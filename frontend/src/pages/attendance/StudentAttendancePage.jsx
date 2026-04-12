import { useState } from 'react';
import MarkAttendancePage from './MarkAttendancePage';
import AttendanceHistoryPage from './AttendanceHistoryPage';

const TABS = [
  { key: 'mark',    label: 'Mark Attendance',    icon: '✅' },
  { key: 'history', label: 'Attendance History',  icon: '📊' },
];

export default function StudentAttendancePage() {
  const [activeTab, setActiveTab] = useState('mark');

  return (
    <div style={s.page}>
      {/* Tab bar */}
      <div style={s.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            style={{ ...s.tab, ...(activeTab === tab.key ? s.tabActive : {}) }}
            onClick={() => setActiveTab(tab.key)}
          >
            <span style={{ fontSize: 15 }}>{tab.icon}</span>
            {tab.label}
            {activeTab === tab.key && <div style={s.tabUnderline} />}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={s.content}>
        {activeTab === 'mark' && (
          <MarkAttendancePage
            inTab
            onSwitchToHistory={() => setActiveTab('history')}
          />
        )}
        {activeTab === 'history' && (
          <AttendanceHistoryPage
            inTab
            onSwitchToMark={() => setActiveTab('mark')}
          />
        )}
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#f8fafc' },

  tabBar: {
    display: 'flex',
    gap: 4,
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    padding: '6px',
    marginBottom: 24,
    width: 'fit-content',
  },

  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 20px',
    background: 'none',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    color: '#64748b',
    position: 'relative',
    transition: 'all 0.15s',
  },

  tabActive: {
    background: '#eff6ff',
    color: '#1d4ed8',
  },

  tabUnderline: {
    position: 'absolute',
    bottom: -2,
    left: '20%',
    right: '20%',
    height: 2,
    background: '#3b82f6',
    borderRadius: 2,
  },

  content: {
    minHeight: 400,
  },
};
