import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repository = readFileSync(
  resolve('src/lib/wfm/wfmOfficePlannedVisitRepository.ts'),
  'utf8',
);

const checks = [
  ['Arbeitszeit nutzt den kanonischen Einsatz-Repository', /visitSupabaseRepository\.list/],
  ['Der vollständige gewählte Zeitraum wird an Einsätze übergeben', /dateFrom:[\s\S]*dateTo:/],
  ['Serienvorkommen behalten ihre kanonische Einsatz-ID', /assignmentId:\s*visit\.id[\s\S]*visitId:\s*visit\.id/],
  ['Plan- und Ist-Zeiten werden gemeinsam übernommen', /plannedStartAt:\s*visit\.scheduledStart[\s\S]*assignmentActualStartAt:\s*visit\.actualStartAt/],
  ['Entwürfe werden nicht als offene Arbeitszeitfälle geführt', /planningStatus\s*===\s*'draft'/],
  ['Altdaten besitzen nur noch einen technischen Rückfallweg', /listLegacyAssignmentsForPeriod/],
];

console.log('CareSuite+ office:worktime-canonical-visits:v32.3');
let failed = false;
for (const [label, pattern] of checks) {
  if (pattern.test(repository)) {
    console.log(`✓ ${label}`);
  } else {
    failed = true;
    console.error(`✗ ${label}`);
  }
}

if (failed) process.exit(1);
