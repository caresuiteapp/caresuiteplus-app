#!/usr/bin/env node
/** Ersetzt harte DEMO_TENANT_ID-Guards durch guardServiceTenant in Live-Services. */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const TARGETS = [
  'src/lib/beratung/beratungDashboardService.ts',
  'src/lib/beratung/caseListService.ts',
  'src/lib/beratung/caseDetailService.ts',
  'src/lib/akademie/akademieDashboardService.ts',
  'src/lib/akademie/courseListService.ts',
  'src/lib/akademie/courseDetailService.ts',
  'src/lib/stationaer/stationaerDashboardService.ts',
  'src/lib/stationaer/residentListService.ts',
  'src/lib/stationaer/residentDetailService.ts',
  'src/lib/office/officeDashboardService.ts',
  'src/lib/office/appointmentListService.ts',
  'src/lib/office/employeeDetailService.ts',
  'src/lib/business/businessDashboardService.ts',
  'src/lib/assist/assignmentListService.ts',
  'src/lib/assist/assignmentDetailService.ts',
  'src/lib/portal/clientPortalService.ts',
  'src/lib/portal/employeePortalService.ts',
  'src/lib/platform/platformHubService.ts',
  'src/lib/integrations/integrationHubService.ts',
];

const GUARD_BLOCK =
  /if \(tenantId !== DEMO_TENANT_ID\) \{\s*return \{ ok: false, error: '[^']+' \};\s*\}/g;

const GUARD_REPLACEMENT =
  'const tenantBlock = guardServiceTenant(tenantId);\n  if (tenantBlock) return tenantBlock;';

for (const rel of TARGETS) {
  const path = join(root, rel);
  let src = readFileSync(path, 'utf8');
  if (!GUARD_BLOCK.test(src)) {
    console.log(`skip (no guard): ${rel}`);
    continue;
  }
  src = src.replace(GUARD_BLOCK, GUARD_REPLACEMENT);
  if (!src.includes('guardServiceTenant')) {
    if (src.includes("from '@/lib/permissions'")) {
      src = src.replace(
        "from '@/lib/permissions'",
        "from '@/lib/permissions';\nimport { guardServiceTenant } from '@/lib/services/liveServiceGuard'",
      );
    } else {
      src = `import { guardServiceTenant } from '@/lib/services/liveServiceGuard';\n${src}`;
    }
  }
  src = src.replace(
    /import \{ DEMO_TENANT_ID \} from '@\/data\/demo\/tenant';\n?/g,
    '',
  );
  writeFileSync(path, src);
  console.log(`updated: ${rel}`);
}
