import { existsSync, readFileSync } from 'node:fs';

const routes = [
  'live', 'zeitkonten', 'pruefqueue', 'abwesenheiten', 'nachtraege',
  'fahrzeitregeln', 'team-meetings', 'historie', 'export', 'einstellungen',
];

const checks = [
  ['Alle zehn Arbeitszeit-Routen sind vorhanden', routes.every((route) => existsSync(`app/business/office/time-tracking/${route}.tsx`))],
  ['Review-Schreibzugriffe normalisieren employees.id', readFileSync('src/lib/wfm/wfmTimeReviewService.ts', 'utf8').includes('resolveCanonicalWfmEmployeeId')],
  ['Prüfaktionen erhalten den ausgewählten Eintragskontext', readFileSync('src/components/wfm/WfmOfficeTimeHistoryPanel.tsx', 'utf8').includes('reviewNote,\n      selected')],
  ['Nachträge verwenden Systemauswahl statt Mitarbeiter-ID-Freitext', !readFileSync('src/components/wfm/WfmOfficeManualEntryPanel.tsx', 'utf8').includes('placeholder="Mitarbeiter-ID"')],
  ['Geöffnete Prüfdetails wechseln auf lesbare Karten', readFileSync('src/components/wfm/WfmOfficeTimeEntryTable.tsx', 'utf8').includes('width < 640 || Boolean(selectedId)')],
];

console.log('CareSuite+ office:worktime:v32:audit');
let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
