import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
const check = (label, value) => checks.push({ label, value: Boolean(value) });

const frame = read('src/components/portal/EmployeePortalPageFrame.tsx');
const tabScreen = read('src/screens/portal/PortalTabScreen.tsx');
const tabHero = read('src/components/portal/PortalTabHero.tsx');
const messages = read('src/screens/communication/PortalMessagesScreens.tsx');
const uploads = read('src/components/portal/EmployeePortalUploadScreen.tsx');
const documents = read('src/components/portal/PortalDocumentListCard.tsx');
const subpageShell = read('src/components/layout/C14vSubpageShell.tsx');
const visitExecution = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
const employeeScreens = [
  'src/components/wfm/EmployeePortalTimesScreen.tsx',
  'src/components/timeTracking/TimeTrackingEmployeeScreen.tsx',
  'src/components/wfm/WfmAbsencePortalScreen.tsx',
  'src/screens/portal/EmployeePortalAnnouncementsScreen.tsx',
].map(read);

check('ein verbindlicher Mitarbeitendenportal-Seitenrahmen ist vorhanden', frame.includes('employee-portal-page-frame'));
check('alle PortalTabScreen-Routen nutzen im Mitarbeitendenportal diesen Rahmen', tabScreen.includes('<EmployeePortalPageFrame'));
check('der Mitarbeitendenportal-Hero umgeht helle Legacy-Heros', tabHero.includes("props.scope === 'portal_employee'") && tabHero.includes('PortalTabHeroSpatial'));
check('Nachrichten laufen über dieselbe Portal-Seitenschale', messages.includes('<PortalTabScreen title="Nachrichten"'));
check('Arbeitszeit, Fahrten, Abwesenheit und Ankündigungen verwenden PortalTabScreen', employeeScreens.every((source) => source.includes('PortalTabScreen') && !source.includes("from '@/components/layout'")));
check('Upload-Formulare verwenden feste lesbare Portaltexte', uploads.includes('const portalText') && !uploads.includes('useAuroraAdaptiveText'));
check('Dokumentenlisten binden keine helle Legacy-Textpalette ein', !documents.includes('lightSurfaceText') && !documents.includes('careLightColors'));
check('Detailseiten wechseln im Mitarbeitendenportal in denselben Seitenrahmen', subpageShell.includes("pathname.startsWith('/portal/employee')") && subpageShell.includes('<PortalTabScreen'));
check('die laufende Einsatzdurchführung nutzt keine separate ScreenShell', visitExecution.includes('<PortalTabScreen') && !visitExecution.includes('<ScreenShell'));

console.log('CareSuite+ Mobile Portal Consistency Audit V34.5');
let failed = 0;
for (const result of checks) {
  console.log(`${result.value ? '✓' : '✗'} ${result.label}`);
  if (!result.value) failed += 1;
}
if (failed) process.exit(1);
