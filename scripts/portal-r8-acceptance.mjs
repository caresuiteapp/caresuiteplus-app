import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

function source(relativePath) {
  const absolute = join(root, relativePath);
  if (!existsSync(absolute)) {
    failures.push(`Datei fehlt: ${relativePath}`);
    return '';
  }
  return readFileSync(absolute, 'utf8');
}

function requireText(name, value, expected) {
  if (!value.includes(expected)) failures.push(`${name}: "${expected}" fehlt`);
}

function rejectText(name, value, rejected) {
  if (value.includes(rejected)) failures.push(`${name}: alte Implementierung "${rejected}" ist noch aktiv`);
}

console.log('======================================================');
console.log('CARESUITE PORTALE R8 – VERBINDLICHE ABNAHME');
console.log('======================================================');

const home = source('src/liquid-command/screens/PortalHomeScreen.tsx');
const catalog = source('src/liquid-command/navigation/portalCatalog.ts');
const shell = source('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');
const realtime = source('src/lib/office/officemessagerealtime.ts');
const tasks = source('app/portal/employee/tasks/index.tsx');

console.log('[1/5] Einheitliche aktive Chatanzahl');
requireText('Portalübersicht', home, "usePortalOfficeMessages('open')");
requireText('Portalübersicht', home, 'const activeChats = threads.length');
requireText('Portalübersicht', home, 'label="Aktive Chats"');
rejectText('Portalübersicht', home, 'fetchPortalMessages');
rejectText('Portalübersicht', home, 'data.messages');

console.log('[2/5] Realtime für Chat- und Nachrichtenänderungen');
requireText('Office-Realtime', realtime, "table: 'message_threads'");
requireText('Office-Realtime', realtime, "table: 'messages'");
requireText('Office-Realtime', realtime, "type: 'message_changed'");
requireText('Office-Realtime', realtime, 'POLL_INTERVAL_MS');

console.log('[3/5] Vollständige Mitarbeitenden-Navigation');
for (const route of [
  '/portal/employee/assignments',
  '/portal/employee/clients',
  '/portal/employee/calendar',
  '/portal/employee/arbeitszeit',
  '/portal/employee/arbeitszeit/urlaub',
  '/portal/employee/arbeitszeit/abwesenheiten',
  '/portal/employee/documents',
  '/portal/employee/uploads',
  '/portal/employee/messages',
  '/portal/employee/payroll',
  '/portal/employee/profile',
]) {
  requireText('Mitarbeitenden-Navigation', catalog, `route: '${route}'`);
}

console.log('[4/5] Vollständige Klient:innen-Navigation');
for (const route of [
  '/portal/client/appointments',
  '/portal/client/live',
  '/portal/client/documents',
  '/portal/client/documents/signatures',
  '/portal/client/proofs',
  '/portal/client/messages',
  '/portal/client/announcements',
  '/portal/client/budget',
  '/portal/client/help',
  '/portal/client/profile',
]) {
  requireText('Klient:innen-Navigation', catalog, `route: '${route}'`);
}
requireText('Mobile Portalnavigation', shell, 'Weitere Portalbereiche öffnen');
requireText('Mobile Portalnavigation', shell, 'moreNavigation.map');

console.log('[5/5] Funktionale Aufgabenübersicht');
requireText('Aufgaben', tasks, 'useEmployeePortalDashboard');
requireText('Aufgaben', tasks, 'buildEmployeePortalTodayModel');
requireText('Aufgaben', tasks, 'router.push');

if (failures.length) {
  console.error('\nABNAHME FEHLGESCHLAGEN');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('\nERGEBNIS: PORTAL-R8-ABNAHME BESTANDEN');
