import { useState } from 'react';
import FeeStructuresPage from './FeeStructuresPage';
import EnrollmentFeesPage from './EnrollmentFeesPage';
import VouchersPage from './VouchersPage';
import StudentLedgerPage from './StudentLedgerPage';
import CollectionReportPage from './CollectionReportPage';
import DefaulterListPage from './DefaulterListPage';

const TABS = [
  { key: 'vouchers',    label: 'Fee Vouchers',       icon: '🧾' },
  { key: 'defaulters',  label: 'Defaulter List',      icon: '🔴' },
  { key: 'ledger',      label: 'Student Ledger',      icon: '📒' },
  { key: 'report',      label: 'Collection Report',   icon: '📊' },
  { key: 'enrollment',  label: 'Enrollment Fees',     icon: '🎒' },
  { key: 'structures',  label: 'Fee Structures',      icon: '📋' },
];

export default function FeesPage() {
  const [activeTab, setActiveTab] = useState('vouchers');

  return (
    <div>
      <div style={s.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{ ...s.tab, ...(activeTab === tab.key ? s.tabActive : {}) }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {activeTab === tab.key && <div style={s.tabUnderline} />}
          </button>
        ))}
      </div>
      <div style={s.content}>
        {activeTab === 'vouchers'   && <VouchersPage       embedded />}
        {activeTab === 'defaulters' && <DefaulterListPage            />}
        {activeTab === 'ledger'     && <StudentLedgerPage            />}
        {activeTab === 'report'     && <CollectionReportPage         />}
        {activeTab === 'enrollment' && <EnrollmentFeesPage embedded />}
        {activeTab === 'structures' && <FeeStructuresPage  embedded />}
      </div>
    </div>
  );
}

const s = {
  tabBar: { display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', marginBottom: 24, background: '#fff', borderRadius: '12px 12px 0 0', padding: '0 8px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', flexWrap: 'wrap' },
  tab: { position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#94a3b8', fontFamily: 'inherit', transition: 'color 0.15s' },
  tabActive: { color: '#1e3a5f' },
  tabUnderline: { position: 'absolute', bottom: -2, left: 0, right: 0, height: 2, background: '#3b82f6', borderRadius: '2px 2px 0 0' },
  content: { minHeight: 400 },
};
