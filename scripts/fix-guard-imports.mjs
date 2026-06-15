#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMPORT = "import { guardServiceTenant } from '@/lib/services/liveServiceGuard';";

const files = [
  'src/lib/akademie/akademieDashboardService.ts',
  'src/lib/akademie/courseDetailService.ts',
  'src/lib/akademie/courseListService.ts',
  'src/lib/assist/assignmentDetailService.ts',
  'src/lib/assist/assignmentListService.ts',
  'src/lib/beratung/beratungDashboardService.ts',
  'src/lib/beratung/caseDetailService.ts',
  'src/lib/beratung/caseListService.ts',
  'src/lib/business/businessDashboardService.ts',
  'src/lib/office/appointmentListService.ts',
  'src/lib/office/employeeDetailService.ts',
  'src/lib/office/officeDashboardService.ts',
  'src/lib/stationaer/residentDetailService.ts',
  'src/lib/stationaer/residentListService.ts',
  'src/lib/stationaer/stationaerDashboardService.ts',
];

for (const rel of files) {
  const path = join(root, rel);
  let src = readFileSync(path, 'utf8');
  if (src.includes('guardServiceTenant') && src.includes(IMPORT)) {
    console.log(`ok: ${rel}`);
    continue;
  }
  if (!src.includes(IMPORT)) {
    const lines = src.split('\n');
    let insertAt = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) insertAt = i + 1;
    }
    lines.splice(insertAt, 0, IMPORT);
    src = lines.join('\n');
  }
  writeFileSync(path, src);
  console.log(`fixed import: ${rel}`);
}
