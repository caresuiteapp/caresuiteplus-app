import { readFileSync } from 'node:fs';
import process from 'node:process';
import { URL } from 'node:url';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const checks = [
  ['Interne, Mitarbeitenden-, Klienten- und Angehörigenzugänge sind berechtigungsgeschützt',
    read('src/lib/auth/accessManagementService.ts').includes("'office.access'") &&
      read('src/lib/clients/clientPortalAccessService.ts').includes('actorRoleKey') &&
      read('src/lib/access/relativePortalAccessService.ts').includes('actorRoleKey')],
  ['Mitarbeitenden-Zugänge zeigen Name und Personalnummer statt UUID',
    read('src/lib/access/accessManagementLiveRepository.ts').includes('employee_number') &&
      read('src/screens/office/access/EmployeePortalAccountsScreen.tsx').includes('employeeName')],
  ['Sperren, Entsperren und Passwort-Reset besitzen Fehler- und Ladezustände',
    read('src/screens/office/access/EmployeePortalAccountDetailScreen.tsx').includes('actionLoading') &&
      read('src/screens/office/access/EmployeePortalAccountDetailScreen.tsx').includes('actionError')],
  ['Portal-Auswahlen sind typstabil',
    read('src/screens/office/access/ClientPortalCodesScreen.tsx').includes('Array.isArray(key)') &&
      read('src/screens/office/access/RelativePortalCodesScreen.tsx').includes('Array.isArray(key)')],
  ['Funktionslose Modulrechte-Demo wurde durch die Datenansicht ersetzt',
    !read('src/screens/office/access/UserModulePermissionsScreen.tsx').includes('Demo-Vorschau')],
];

console.log('CareSuite+ office:access-portals:v32.9:audit');
let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exitCode = 1;
