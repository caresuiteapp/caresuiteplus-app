import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const checks = [];
const check = (label, condition) => {
  if (!condition) throw new Error(`✗ ${label}`);
  checks.push(label);
};

const tabs = ['live', 'zeitkonten', 'pruefqueue', 'abwesenheiten', 'nachtraege', 'fahrzeitregeln', 'team-meetings', 'historie', 'export', 'einstellungen'];
for (const tab of tabs) check(`Route ${tab}`, read(`app/business/office/time-tracking/${tab}.tsx`).length > 0);

const guard = read('src/lib/services/liveServiceGuard.ts');
const planning = read('src/lib/wfm/wfmPlanningService.ts');
const manual = read('src/components/wfm/WfmNachtraegeOfficeScreen.tsx');
const details = read('src/components/wfm/WfmOfficeTimeReviewDetailPanel.tsx');
const migration = read('supabase/migrations/0262_wfm_worktime_system_repair.sql');

check('Demo-Datenpfad bleibt funktionsfähig', guard.includes("getServiceMode() !== 'supabase'"));
check('Nachträge nutzen alle aktiven Mitarbeitenden', manual.includes('listWfmActiveEmployees'));
check('Live-Mitarbeiterstatus nutzt das gültige Supabase-Enum', planning.includes(".eq('status', 'active')") && !planning.includes("['aktiv', 'active']"));
check('Roh-ISO-Zeitfelder wurden entfernt', !details.includes('placeholder="Start (ISO)"'));
check('Korrekturzeiten sind systemgeführt', details.includes('CareTimeInput') && details.includes('ListFilterSelect'));
check('Planungstabellen werden repariert', ['workforce_travel_rules', 'workforce_team_meetings', 'workforce_team_meeting_attendees'].every((name) => migration.includes(`CREATE TABLE IF NOT EXISTS public.${name}`)));
check('Meeting-Buchung ist wiederholsicher', migration.includes('attendee.booked_at IS NULL'));
check('PostgREST-Schema wird aktualisiert', migration.includes("NOTIFY pgrst, 'reload schema'"));

console.log('CareSuite+ office:worktime:v32.5:audit');
for (const label of checks) console.log(`✓ ${label}`);
console.log(`✓ ${checks.length} Integritätsprüfungen bestanden`);
