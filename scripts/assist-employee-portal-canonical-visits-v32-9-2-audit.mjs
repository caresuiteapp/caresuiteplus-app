import { readFileSync } from 'node:fs';

const portal = readFileSync('src/lib/portal/employeePortalLiveOverviewService.ts', 'utf8');
const visits = readFileSync('src/lib/assist/repositories/visitRepository.supabase.ts', 'utf8');
const migration = readFileSync(
  'supabase/migrations/0263_assist_employee_portal_visibility_repair.sql',
  'utf8',
);

const checks = [
  ['Portal dedupliziert kanonische Einsatzinstanzen', portal.includes('dedupeEmployeePortalAppointments')],
  ['Deduplizierung berücksichtigt Mitarbeiter, Klient, Beginn, Ende und Titel', portal.includes("item.employeeId ?? ''") && portal.includes('item.startsAt') && portal.includes('item.endsAt')],
  ['Neue zugewiesene Einsätze werden im Mitarbeitendenportal sichtbar', visits.includes('employee_portal_visible: Boolean(input.employeeId) && !input.saveAsDraft')],
  ['Veraltetes Sichtbarkeitsfeld blockiert keine zugewiesenen Einsätze', !visits.includes("query = query.eq('employee_portal_visible', true)")],
  ['Unberührte Serieninstanzen mit geerbtem Status bleiben löschbar', visits.includes('isSafelyDeletableSeriesOccurrence')],
  ['Bestandsdaten erhalten eine nicht-destruktive Sichtbarkeitsreparatur', migration.includes('UPDATE public.assist_visits') && !migration.includes('DELETE FROM')],
];

console.log('CareSuite+ Assist Mitarbeitendenportal V32.9.2 Audit');
let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
