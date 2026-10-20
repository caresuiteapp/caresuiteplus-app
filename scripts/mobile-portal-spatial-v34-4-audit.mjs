import fs from 'node:fs';

const checks = [
  ['Spatial-Komponenten vorhanden', 'src/components/portal/SpatialPortalSurface.tsx', 'SpatialPortalSection'],
  ['Dashboard nutzt Spatial-Sektionen', 'src/components/healthos/employee/HealthOSEmployeePortalTodayView.tsx', '<SpatialPortalSection'],
  ['Dashboard nutzt räumliche KPIs', 'src/components/healthos/employee/HealthOSEmployeePortalTodayView.tsx', '<SpatialPortalMetric'],
  ['Drawer-Texte sind explizit weiß', 'src/components/layout/portal/PortalNavigationDrawer.tsx', "primary: '#FFFFFF'"],
  ['Bottom-Navigation schwebt', 'src/components/layout/PortalMobileNav.tsx', 'marginHorizontal: 12'],
  ['Profil bleibt auf dunkler Bühne lesbar', 'src/screens/portal/EmployeeProfileScreen.tsx', 'spatialCare.textOnNight'],
];

let failed = false;
console.log('CareSuite+ Mobile Portal Spatial Audit V34.4');
for (const [label, file, needle] of checks) {
  const source = fs.readFileSync(file, 'utf8');
  const ok = source.includes(needle);
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  failed ||= !ok;
}

const dashboard = fs.readFileSync('src/components/healthos/employee/HealthOSEmployeePortalTodayView.tsx', 'utf8');
if (dashboard.includes('<HealthOSSection') || dashboard.includes('<HealthOSMetricCard')) {
  console.error('✗ Dashboard enthält weiterhin generische helle HealthOS-Flächen');
  failed = true;
} else {
  console.log('✓ Keine generischen weißen Dashboard-Flächen mehr');
}

if (failed) process.exit(1);
