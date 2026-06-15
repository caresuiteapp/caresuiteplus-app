#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const TARGETS = [
  ['src/lib/akademie/courseListService.ts', 'Kursliste'],
  ['src/lib/akademie/courseDetailService.ts', 'Kursdetail'],
  ['src/lib/akademie/akademieDashboardService.ts', 'Akademie-Dashboard'],
  ['src/lib/stationaer/residentListService.ts', 'Bewohnerliste'],
  ['src/lib/stationaer/residentDetailService.ts', 'Bewohnerdetail'],
  ['src/lib/stationaer/stationaerDashboardService.ts', 'Stationär-Dashboard'],
  ['src/lib/assist/assignmentListService.ts', 'Einsatzliste'],
  ['src/lib/assist/assignmentDetailService.ts', 'Einsatzdetail'],
  ['src/lib/office/appointmentListService.ts', 'Terminliste'],
  ['src/lib/office/employeeDetailService.ts', 'Mitarbeiterdetail'],
  ['src/lib/office/officeDashboardService.ts', 'Office-Dashboard'],
  ['src/lib/business/businessDashboardService.ts', 'Business-Dashboard'],
  ['src/lib/beratung/caseDetailService.ts', 'Beratungsfall-Detail'],
  ['src/lib/beratung/beratungDashboardService.ts', 'Beratung-Dashboard'],
];

for (const [rel, label] of TARGETS) {
  const path = join(root, rel);
  let src = readFileSync(path, 'utf8');
  if (src.includes('blockDemoOnlyInLiveMode') || src.includes('getServiceMode() === \'supabase\'')) {
    console.log(`skip: ${rel}`);
    continue;
  }
  if (!src.includes('blockDemoOnlyInLiveMode')) {
    src = src.replace(
      "import { guardServiceTenant } from '@/lib/services/liveServiceGuard';",
      "import { blockDemoOnlyInLiveMode, guardServiceTenant } from '@/lib/services/liveServiceGuard';\nimport { getServiceMode } from '@/lib/services/mode';",
    );
  }
  src = src.replace(
    /const tenantBlock = guardServiceTenant\((tenantId)\);\s*\n\s*if \(tenantBlock\) return tenantBlock;/g,
    `const tenantBlock = guardServiceTenant($1);\n  if (tenantBlock) return tenantBlock;\n\n  if (getServiceMode() === 'supabase') {\n    const liveDemoBlock = blockDemoOnlyInLiveMode('${label}');\n    if (liveDemoBlock) return liveDemoBlock;\n  }`,
  );
  writeFileSync(path, src);
  console.log(`updated: ${rel}`);
}
