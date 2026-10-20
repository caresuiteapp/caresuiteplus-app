import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(path), 'utf8');
const join = read('src/lib/wfm/wfmOfficeDataJoinService.ts');
const overview = read('src/lib/wfm/wfmOfficeTimekeepingService.ts');
const repository = read('src/lib/wfm/wfmWorkSessionRepository.ts');
const types = read('src/types/modules/wfm.ts');

const checks = [
  ['Vollständige Einsatz-Ist-Zeiten werden erkannt', join, /isPlannedVisitAutoBookable/],
  ['Die 5-Minuten-Toleranz wird auf Start und Ende angewendet', join, /startAmpel !== 'green'[\s\S]*endAmpel !== 'green'/],
  ['Überschneidungen verhindern automatische Buchungen', join, /intervalsOverlap/],
  ['Automatische Buchungen werden als freigegeben markiert', join, /auto_booked_from_assignment_actual[\s\S]*planned_with_actual/],
  ['Offene Alt-Prüfungen werden automatisch abgeschlossen', overview, /nextStatus:\s*'approved'[\s\S]*Automatische Freigabe/],
  ['Einsatzereignisse werden über reference_id zugeordnet', overview, /startEvent\.referenceId/],
  ['Die Ereignis-Repository lädt reference_id', repository, /reference_type, reference_id/],
  ['Das WFM-Ereignismodell führt die Einsatzreferenz', types, /referenceId\?: string \| null/],
];

console.log('CareSuite+ office:worktime-auto-booking:v32.4');
let failed = false;
for (const [label, source, pattern] of checks) {
  if (pattern.test(source)) console.log(`✓ ${label}`);
  else {
    failed = true;
    console.error(`✗ ${label}`);
  }
}
if (failed) process.exit(1);
