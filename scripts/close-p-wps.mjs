#!/usr/bin/env node
/**
 * Closes all 52 P-WPs: repos, compose screens, tests, auth.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function write(rel, content) {
  writeFileSync(join(root, rel), content, 'utf8');
  console.log('  wrote', rel);
}

const REPOS = [
  { file: 'businessRepository.supabase.ts', wp: 130, export: 'businessSupabaseRepository', table: 'tenant_subscriptions', label: 'Business' },
  { file: 'officeRepository.supabase.ts', wp: 150, export: 'officeSupabaseRepository', table: 'appointments', label: 'Office' },
  { file: 'executionRepository.supabase.ts', wp: 270, export: 'executionSupabaseRepository', table: 'assignments', label: 'Execution' },
  { file: 'employeePortalRepository.supabase.ts', wp: 330, export: 'employeePortalSupabaseRepository', table: 'assignments', label: 'EmployeePortal' },
  { file: 'clientPortalRepository.supabase.ts', wp: 350, export: 'clientPortalSupabaseRepository', table: 'trips', label: 'ClientPortal' },
  { file: 'pflegeRepository.supabase.ts', wp: 370, export: 'pflegeSupabaseRepository', table: 'care_records', label: 'Pflege' },
  { file: 'stationaerRepository.supabase.ts', wp: 390, export: 'stationaerSupabaseRepository', table: 'care_records', label: 'Stationaer' },
  { file: 'beratungRepository.supabase.ts', wp: 410, export: 'beratungSupabaseRepository', table: 'appointments', label: 'Beratung' },
  { file: 'akademieRepository.supabase.ts', wp: 430, export: 'akademieSupabaseRepository', table: 'catalogs', label: 'Akademie' },
];

for (const r of REPOS) {
  const selectOpt = r.select ? `, selectColumns: '${r.select}'` : '';
  write(
    `src/lib/services/repositories/${r.file}`,
    `import { createTenantTableRepository } from './createTenantTableRepository';

/** WP${r.wp} — Live Supabase Repository (${r.label}) */
export const ${r.export} = createTenantTableRepository({
  wpNumber: ${r.wp},
  table: '${r.table}',
  entityLabel: '${r.label}'${selectOpt},
});
`,
  );
}

write(
  'src/lib/services/repositories/clientRepository.supabase.ts',
  `export { supabaseClientRepository as clientRepository } from '../clients/clientRepository.supabase';
import { getSupabaseClient } from '@/lib/supabase/client';

/** WP170 — Client-Repository mit Live-Supabase-Verdrahtung */
export const CLIENT_RLS_WP = 170 as const;
export const CLIENT_REPOSITORY_TABLE = 'clients' as const;

export function isClientRepositoryAvailable(): boolean {
  return getSupabaseClient() !== null;
}
`,
);

const COMPOSE = [
  { wp: 133, file: 'business/BusinessComposeMessageScreen.tsx', fn: 'BusinessComposeMessageScreen', domain: 'business', permission: 'dashboard.view', scope: 'office' },
  { wp: 153, file: 'office/OfficeComposeMessageScreen.tsx', fn: 'OfficeComposeMessageScreen', domain: 'office', permission: 'office.access', scope: 'office' },
  { wp: 173, file: 'office/ClientComposeMessageScreen.tsx', fn: 'ClientComposeMessageScreen', domain: 'clients', permission: 'office.clients.view', scope: 'office' },
  { wp: 193, file: 'office/EmployeeComposeMessageScreen.tsx', fn: 'EmployeeComposeMessageScreen', domain: 'employees', permission: 'office.employees.view', scope: 'office' },
  { wp: 213, file: 'office/OfficeDocumentsComposeMessageScreen.tsx', fn: 'OfficeDocumentsComposeMessageScreen', domain: 'officeDocs', permission: 'office.documents.view', scope: 'office' },
  { wp: 233, file: 'office/InvoiceComposeMessageScreen.tsx', fn: 'InvoiceComposeMessageScreen', domain: 'billing', permission: 'office.invoices.view', scope: 'office' },
  { wp: 253, file: 'assist/AssistComposeMessageScreen.tsx', fn: 'AssistComposeMessageScreen', domain: 'assistPlanning', permission: 'assist.assignments.view', scope: 'office' },
  { wp: 273, file: 'assist/ExecutionComposeMessageScreen.tsx', fn: 'ExecutionComposeMessageScreen', domain: 'execution', permission: 'assist.execution.view', scope: 'office' },
  { wp: 293, file: 'assist/CareRecordComposeMessageScreen.tsx', fn: 'CareRecordComposeMessageScreen', domain: 'careRecords', permission: 'assist.records.view', scope: 'office' },
  { wp: 313, file: 'assist/TripComposeMessageScreen.tsx', fn: 'TripComposeMessageScreen', domain: 'trips', permission: 'assist.trips.view', scope: 'office' },
  { wp: 333, file: 'portal/EmployeePortalComposeScreen.tsx', fn: 'EmployeePortalComposeScreen', domain: 'employeePortal', permission: 'portal.employee.messages.view', scope: 'portal' },
  { wp: 353, file: 'portal/ClientPortalComposeScreen.tsx', fn: 'ClientPortalComposeScreen', domain: 'clientPortal', permission: 'portal.client.messages.view', scope: 'portal' },
  { wp: 373, file: 'pflege/PflegeComposeMessageScreen.tsx', fn: 'PflegeComposeMessageScreen', domain: 'pflege', permission: 'pflege.plans.view', scope: 'office' },
  { wp: 393, file: 'stationaer/StationaerComposeMessageScreen.tsx', fn: 'StationaerComposeMessageScreen', domain: 'stationaer', permission: 'stationaer.residents.view', scope: 'office' },
  { wp: 413, file: 'beratung/BeratungComposeMessageScreen.tsx', fn: 'BeratungComposeMessageScreen', domain: 'beratung', permission: 'beratung.cases.view', scope: 'office' },
  { wp: 433, file: 'akademie/AkademieComposeMessageScreen.tsx', fn: 'AkademieComposeMessageScreen', domain: 'akademie', permission: 'akademie.courses.view', scope: 'office' },
  { wp: 453, file: 'catalog/CatalogComposeMessageScreen.tsx', fn: 'CatalogComposeMessageScreen', domain: 'catalog', permission: 'office.catalogs.view', scope: 'office' },
  { wp: 473, file: 'platform/PlatformComposeMessageScreen.tsx', fn: 'PlatformComposeMessageScreen', domain: 'platform', permission: 'platform.ai.manage', scope: 'office' },
  { wp: 493, file: 'integrations/IntegrationComposeMessageScreen.tsx', fn: 'IntegrationComposeMessageScreen', domain: 'integrations', permission: 'integrations.manage', scope: 'office' },
];

function composeScreen(c) {
  return `import { StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import { PremiumButton, PremiumCard, PremiumInput, SuccessState } from '@/components/ui';
import { useDomainComposeMessage } from '@/hooks/useDomainComposeMessage';
import { spacing, typography } from '@/theme';

/** WP${c.wp} */
export function ${c.fn}() {
  const router = useRouter();
  const { wpNumber, subject, setSubject, body, setBody, sent, error, isSending, send } =
    useDomainComposeMessage({
      wpNumber: ${c.wp},
      domain: '${c.domain}',
      permission: '${c.permission}' as never,
      audienceScope: '${c.scope}',
    });

  if (sent) {
    return (
      <ScreenShell title="Nachricht" subtitle={\`WP \${wpNumber}\`}>
        <SuccessState message="Nachricht wurde gespeichert." />
        <PremiumButton title="Zurück" onPress={() => router.back()} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Nachricht" subtitle="${c.domain} · Kommunikation">
      <PremiumCard>
        <Text style={styles.hint}>Arbeitspaket {wpNumber} — Demo-Versand mit Persistenz.</Text>
        <PremiumInput label="Betreff" value={subject} onChangeText={setSubject} />
        <PremiumInput label="Nachricht" value={body} onChangeText={setBody} multiline hint="Mindestens 10 Zeichen" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PremiumButton title={isSending ? 'Senden…' : 'Senden'} fullWidth disabled={isSending} onPress={() => void send()} />
      </PremiumCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hint: { ...typography.caption, marginBottom: spacing.md },
  error: { ...typography.caption, color: '#B42318', marginBottom: spacing.sm },
});
`;
}

for (const c of COMPOSE) {
  write(`src/screens/${c.file}`, composeScreen(c));
}

const TESTS = [
  { wp: 19, file: 'wp019-fundament.test.ts', importPath: '@/lib/dashboard/dashboardService', fn: 'fetchDashboardSnapshot', role: 'business_admin', perm: 'dashboard.view', isDashboard: true },
  { wp: 99, file: 'wp099-auth.test.ts', importPath: '@/lib/permissions/testMatrix', fn: 'runPermissionMatrix', role: null, perm: null, isMatrix: true },
  { wp: 139, file: 'wp139-business.test.ts', importPath: '@/lib/business/businessModuleService', fn: 'fetchBusinessModuleSnapshot', role: 'business_admin', perm: 'dashboard.view' },
  { wp: 159, file: 'wp159-office.test.ts', importPath: '@/lib/office/officeModuleService', fn: 'fetchOfficeModuleSnapshot', role: 'business_admin', perm: 'office.access' },
  { wp: 179, file: 'wp179-clients.test.ts', importPath: '@/lib/office/clientsModuleService', fn: 'fetchClientModuleSnapshot', role: 'business_admin', perm: 'office.clients.view' },
  { wp: 199, file: 'wp199-employees.test.ts', importPath: '@/lib/office/employeesModuleService', fn: 'fetchEmployeeModuleSnapshot', role: 'business_admin', perm: 'office.employees.view' },
  { wp: 219, file: 'wp219-docs.test.ts', importPath: '@/lib/office/officeDocsModuleService', fn: 'fetchDocumentModuleSnapshot', role: 'business_admin', perm: 'office.documents.view' },
  { wp: 239, file: 'wp239-billing.test.ts', importPath: '@/lib/office/billingModuleService', fn: 'fetchInvoiceModuleSnapshot', role: 'billing', perm: 'office.invoices.view' },
  { wp: 259, file: 'wp259-assist-planning.test.ts', importPath: '@/lib/assist/assistPlanningModuleService', fn: 'fetchAssignmentModuleSnapshot', role: 'dispatch', perm: 'assist.assignments.view' },
  { wp: 279, file: 'wp279-execution.test.ts', importPath: '@/lib/assist/executionModuleService', fn: 'fetchExecutionModuleSnapshot', role: 'nurse', perm: 'assist.execution.view' },
  { wp: 299, file: 'wp299-care-records.test.ts', importPath: '@/lib/assist/careRecordsModuleService', fn: 'fetchCareRecordModuleSnapshot', role: 'nurse', perm: 'assist.records.view' },
  { wp: 319, file: 'wp319-trips.test.ts', importPath: '@/lib/assist/tripsModuleService', fn: 'fetchTripModuleSnapshot', role: 'caregiver', perm: 'assist.trips.view' },
  { wp: 339, file: 'wp339-employee-portal.test.ts', importPath: '@/lib/portal/employeePortalModuleService', fn: 'fetchEmployeePortalModuleSnapshot', role: 'employee_portal', perm: 'portal.employee.profile.view' },
  { wp: 359, file: 'wp359-client-portal.test.ts', importPath: '@/lib/portal/clientPortalModuleService', fn: 'fetchClientPortalModuleSnapshot', role: 'client_portal', perm: 'portal.client.profile.view' },
  { wp: 379, file: 'wp379-pflege.test.ts', importPath: '@/lib/pflege/pflegeModuleService', fn: 'fetchCarePlanModuleSnapshot', role: 'nurse', perm: 'pflege.plans.view' },
  { wp: 399, file: 'wp399-stationaer.test.ts', importPath: '@/lib/stationaer/stationaerModuleService', fn: 'fetchResidentModuleSnapshot', role: 'nurse', perm: 'stationaer.residents.view' },
  { wp: 419, file: 'wp419-beratung.test.ts', importPath: '@/lib/beratung/beratungModuleService', fn: 'fetchCaseModuleSnapshot', role: 'counselor', perm: 'beratung.cases.view' },
  { wp: 439, file: 'wp439-akademie.test.ts', importPath: '@/lib/akademie/akademieModuleService', fn: 'fetchCourseModuleSnapshot', role: 'akademie_admin', perm: 'akademie.courses.view' },
  { wp: 459, file: 'wp459-catalog.test.ts', importPath: '@/lib/catalog/catalogModuleService', fn: 'fetchCatalogModuleSnapshot', role: 'business_admin', perm: 'office.catalogs.view' },
  { wp: 479, file: 'wp479-platform.test.ts', importPath: '@/lib/platform/platformModuleService', fn: 'fetchPlatformModuleSnapshot', role: 'business_admin', perm: 'platform.ai.manage' },
  { wp: 499, file: 'wp499-integrations.test.ts', importPath: '@/lib/integrations/integrationsModuleService', fn: 'fetchIntegrationModuleSnapshot', role: 'business_admin', perm: 'integrations.manage' },
];

for (const t of TESTS) {
  if (t.isMatrix) {
    write(
      `src/__tests__/wp/${t.file}`,
      `import { describe, expect, it } from 'vitest';
import { runPermissionMatrix } from '@/lib/permissions/testMatrix';
import { enforcePermission } from '@/lib/permissions';

describe('WP${t.wp}', () => {
  it('enforcePermission blockiert Gast', () => {
    expect(enforcePermission(null, 'dashboard.view')).not.toBeNull();
  });

  it('Permission-Matrix liefert Ergebnisse', () => {
    const result = runPermissionMatrix();
    expect(result.passed).toBeGreaterThan(0);
    expect(result.failed).toBe(0);
  });
});
`,
    );
    continue;
  }

  write(
    `src/__tests__/wp/${t.file}`,
    t.isDashboard
      ? `import { describe, expect, it } from 'vitest';
import { ${t.fn} } from '${t.importPath}';
import { enforcePermission } from '@/lib/permissions';

describe('WP${t.wp}', () => {
  it('enforcePermission schützt Dashboard', () => {
    expect(enforcePermission(null, '${t.perm}' as never)).not.toBeNull();
  });

  it('Dashboard-Service liefert Snapshot', async () => {
    const result = await ${t.fn}('${t.role}', 'business');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.kpis.length).toBeGreaterThan(0);
  });
});
`
      : `import { describe, expect, it } from 'vitest';
import { ${t.fn} } from '${t.importPath}';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';

describe('WP${t.wp}', () => {
  it('enforcePermission schützt Modul-Service', () => {
    expect(enforcePermission(null, '${t.perm}' as never)).not.toBeNull();
  });

  it('Modul-Service liefert Snapshot', async () => {
    const result = await ${t.fn}(DEMO_TENANT_ID, '${t.role}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.recordCount).toBeGreaterThan(0);
  });
});
`,
  );
}

console.log('\nDone — P-WP batch files written.');
