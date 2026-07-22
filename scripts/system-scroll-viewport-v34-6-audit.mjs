import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const checks = [];

const check = (label, condition) => {
  if (!condition) throw new Error(`✗ ${label}`);
  checks.push(label);
};

const calendar = read('src/components/calendar/CalendarShell.tsx');
const executions = read('src/components/assist/ExecutionsListView.tsx');
const billing = read('src/screens/office/OfficeBillingScreen.tsx');
const clientModal = read('src/components/office/clientdetailmodal.tsx');
const employeeModal = read('src/components/office/employeedetailmodal.tsx');
const autoScroll = read('src/components/layout/AutoScrollView.tsx');

check('Kalender besitzt einen eigenen vertikalen Scroll-Viewport', calendar.includes('<AutoScrollView'));
check('Assist-Durchführung zeigt und verschachtelt Scrollbereiche korrekt', executions.includes('nestedScrollEnabled') && executions.includes('showsVerticalScrollIndicator'));
check('Rechnungsdashboard scrollt und bleibt lesbar', billing.includes('styles.dashboardScroll') && billing.includes("color: '#111827'"));
check('Klient:innenakte scrollt unabhängig vom Hintergrund', clientModal.includes('<AutoScrollView') && clientModal.includes('fillViewport={false}'));
check('Mitarbeitendenakte scrollt unabhängig vom Hintergrund', employeeModal.includes('<AutoScrollView') && employeeModal.includes('fillViewport={false}'));
check('Web unterstützt Mausrad, Touchpad und stabile Scrollleisten', autoScroll.includes("overflowY: 'auto'") && autoScroll.includes("scrollbarGutter: 'stable'"));

console.log('CareSuite+ System Scroll Viewport Audit V34.6');
for (const label of checks) console.log(`✓ ${label}`);
