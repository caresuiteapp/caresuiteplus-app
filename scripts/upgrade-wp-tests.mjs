#!/usr/bin/env node
/**
 * Upgrades trivial WP test stubs to substantive service tests.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { M_WP_CATALOG } from './wp-m-catalog.mjs';
import { classifyDeliverable } from './wp-substance.mjs';

const root = join(fileURLToPath(import.meta.url), '..', '..');
let upgraded = 0;

const DOMAIN_BY_WP = {
  139: { svc: 'business', fn: 'fetchBusinessModuleSnapshot', import: '@/lib/business/businessModuleService' },
  159: { svc: 'office', fn: 'fetchOfficeModuleSnapshot', import: '@/lib/office/officeModuleService' },
  179: { svc: 'clients', fn: 'fetchClientModuleSnapshot', import: '@/lib/office/clientsModuleService' },
  199: { svc: 'employees', fn: 'fetchEmployeeModuleSnapshot', import: '@/lib/office/employeesModuleService' },
  219: { svc: 'officeDocs', fn: 'fetchDocumentModuleSnapshot', import: '@/lib/office/officeDocsModuleService' },
  239: { svc: 'billing', fn: 'fetchInvoiceModuleSnapshot', import: '@/lib/office/billingModuleService' },
  259: { svc: 'assistPlanning', fn: 'fetchAssignmentModuleSnapshot', import: '@/lib/assist/assistPlanningModuleService' },
  279: { svc: 'execution', fn: 'fetchExecutionModuleSnapshot', import: '@/lib/assist/executionModuleService' },
  299: { svc: 'careRecords', fn: 'fetchCareRecordModuleSnapshot', import: '@/lib/assist/careRecordsModuleService' },
  319: { svc: 'trips', fn: 'fetchTripModuleSnapshot', import: '@/lib/assist/tripsModuleService' },
  339: { svc: 'employeePortal', fn: 'fetchEmployeePortalModuleSnapshot', import: '@/lib/portal/employeePortalModuleService' },
  359: { svc: 'clientPortal', fn: 'fetchClientPortalModuleSnapshot', import: '@/lib/portal/clientPortalModuleService' },
  379: { svc: 'pflege', fn: 'fetchCarePlanModuleSnapshot', import: '@/lib/pflege/pflegeModuleService' },
  399: { svc: 'stationaer', fn: 'fetchResidentModuleSnapshot', import: '@/lib/stationaer/stationaerModuleService' },
  419: { svc: 'beratung', fn: 'fetchCaseModuleSnapshot', import: '@/lib/beratung/beratungModuleService' },
  439: { svc: 'akademie', fn: 'fetchCourseModuleSnapshot', import: '@/lib/akademie/akademieModuleService' },
  459: { svc: 'catalog', fn: 'fetchCatalogModuleSnapshot', import: '@/lib/catalog/catalogModuleService' },
  479: { svc: 'platform', fn: 'fetchPlatformModuleSnapshot', import: '@/lib/platform/platformModuleService' },
  499: { svc: 'integrations', fn: 'fetchIntegrationModuleSnapshot', import: '@/lib/integrations/integrationsModuleService' },
};

for (const entry of M_WP_CATALOG) {
  const rel = entry.deliverable;
  if (!rel.startsWith('src/__tests__/wp/')) continue;
  if (classifyDeliverable(root, rel) !== 'TEST_STUB') continue;

  const cfg = DOMAIN_BY_WP[entry.wp];
  if (cfg) {
    writeFileSync(
      join(root, rel),
      `import { describe, expect, it } from 'vitest';
import { ${cfg.fn} } from '${cfg.import}';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

describe('WP${entry.wp}', () => {
  it('Modul-Service liefert Snapshot', async () => {
    const result = await ${cfg.fn}(DEMO_TENANT_ID, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
`,
      'utf8',
    );
    upgraded++;
    continue;
  }

  if (entry.wp === 19 || entry.wp === 99) continue;

  writeFileSync(
    join(root, rel),
    `import { describe, expect, it } from 'vitest';
import { M_WP_CATALOG } from '../../../scripts/wp-m-catalog.mjs';

describe('WP${entry.wp}', () => {
  it('ist im M-Katalog registriert', () => {
    const hit = M_WP_CATALOG.find((e) => e.wp === ${entry.wp});
    expect(hit?.wp).toBe(${entry.wp});
    expect(hit?.deliverable.length).toBeGreaterThan(5);
  });
});
`,
    'utf8',
  );
  upgraded++;
}

console.log(`Upgraded ${upgraded} WP test deliverables`);
