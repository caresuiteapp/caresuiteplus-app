import React from 'react';
import { View } from 'react-native';
import { EmployeePortalOverviewScreen } from '../../src/screens/portal/EmployeePortalOverviewScreen';
import { EmployeePortalClientRecordsScreen } from '../../src/components/portal/EmployeePortalClientRecordsScreen';
import { PortalTabScreen } from '../../src/screens/portal/PortalTabScreen';
import { PortalPremiumProvider } from '../../src/design/tokens/portalPremium';
import { dashboard } from './native-portals-data';

// The real page/frame/scroll chain is mounted. Only scoped server reads are
// replaced with synthetic data; no productive account or data is accessed.
export function EmployeePortalPreview({ screen }) {
  return <PortalPremiumProvider kind="employee"><View style={{ flex: 1, minHeight: 0, backgroundColor: '#071C38' }}>
    {screen === 'employee-clients'
      ? <PortalTabScreen title="Klientenakten" hideHeaderOnPhone scroll={false}><EmployeePortalClientRecordsScreen /></PortalTabScreen>
      : <EmployeePortalOverviewScreen />}
  </View></PortalPremiumProvider>;
}

const refresh = async () => { window.__employeePreviewRefreshes = (window.__employeePreviewRefreshes ?? 0) + 1; return true; };
export const useEmployeePortalDashboard = () => ({ dashboard, loading: false, error: null, refreshing: false, refreshError: null, fromCache: false, cachedAt: null, refreshWithResult: refresh });
export const employeeClientRecords = Array.from({ length: 14 }, (_, index) => ({
  clientId: `employee-client-${index + 1}`,
  displayName: index === 0 ? 'Helene Musterfrau' : index === 1 ? 'Friedrich-Wilhelm Mustermann-Beispiel' : `Musterperson ${index + 1}`,
  city: 'Hannover', street: index === 1 ? 'Langer Straßenname für die Prüfung vollständiger Adressen 24' : 'Gartenstraße 24', zip: '30159',
  careGrade: 'pg2', careGradeLabel: 'PG 2', phone: '0511 000000', mobile: null,
  hints: index === 1 ? 'Bitte den seitlichen Eingang nutzen und am vereinbarten Treffpunkt klingeln.' : null,
  documentCount: 0, activeAssignmentCount: 1, lastAssignmentAt: null, nextAssignmentAt: dashboard.todayAssignments[0].plannedStartAt,
}));
export const useEmployeePortalClientRecords = () => ({ records: employeeClientRecords, loading: false, error: null, refreshError: null, refresh });
