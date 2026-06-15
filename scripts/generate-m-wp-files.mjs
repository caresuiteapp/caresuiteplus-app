#!/usr/bin/env node
/**
 * Generates deliverable files for the remaining 63 M-WPs (STREAM 1).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const DEMO_WPS = [
  [131, 'business'],
  [151, 'office'],
  [171, 'clients'],
  [191, 'employees'],
  [211, 'officeDocs'],
  [231, 'billing'],
  [251, 'assistPlanning'],
  [271, 'execution'],
  [291, 'careRecords'],
  [311, 'trips'],
  [331, 'employeePortal'],
  [351, 'clientPortal'],
  [371, 'pflege'],
  [391, 'stationaer'],
  [411, 'beratung'],
  [431, 'akademie'],
  [451, 'catalog'],
  [471, 'platform'],
  [491, 'integrations'],
];

const DOC_WPS = [
  [134, 'business'],
  [154, 'office'],
  [174, 'clients'],
  [194, 'employees'],
  [234, 'billing'],
  [254, 'assistPlanning'],
  [274, 'execution'],
  [294, 'careRecords'],
  [314, 'trips'],
  [334, 'employeePortal'],
  [354, 'clientPortal'],
  [374, 'pflege'],
  [394, 'stationaer'],
  [414, 'beratung'],
  [434, 'catalog'],
  [474, 'platform'],
  [494, 'integrations'],
];

const WORKFLOW_WPS = [
  [135, 'business'],
  [155, 'office'],
  [175, 'clients'],
  [195, 'employees'],
  [215, 'officeDocs'],
  [235, 'billing'],
  [255, 'assistPlanning'],
  [275, 'execution'],
  [295, 'careRecords'],
  [315, 'trips'],
  [335, 'employeePortal'],
  [355, 'clientPortal'],
  [375, 'pflege'],
  [395, 'stationaer'],
  [415, 'beratung'],
  [435, 'catalog'],
  [475, 'platform'],
  [495, 'integrations'],
];

function ensureDir(rel) {
  mkdirSync(join(root, dirname(rel)), { recursive: true });
}

function write(rel, content) {
  ensureDir(rel);
  writeFileSync(join(root, rel), content, 'utf8');
  console.log(`  + ${rel}`);
}

// Shared factories
write(
  'src/data/demo/domains/domainDemoFactory.ts',
  `import { DEMO_TENANT_ID } from '../tenant';

export type DomainDemoRecord = {
  id: string;
  tenantId: string;
  label: string;
  status: string;
};

export type DomainDemoSnapshot = {
  wpNumber: number;
  domain: string;
  records: DomainDemoRecord[];
  seededAt: string;
};

export function createDomainDemo(
  wpNumber: number,
  domain: string,
  records: Omit<DomainDemoRecord, 'tenantId'>[],
): DomainDemoSnapshot {
  return {
    wpNumber,
    domain,
    records: records.map((r) => ({ ...r, tenantId: DEMO_TENANT_ID })),
    seededAt: '2026-06-01T08:00:00.000Z',
  };
}
`,
);

write(
  'src/lib/documents/documentServiceFactory.ts',
  `import type { RoleKey, ServiceResult } from '@/types';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';
import { enforcePermission } from '@/lib/permissions';

export type DomainDocument = {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  status: string;
};

export type DomainDocumentService = {
  wpNumber: number;
  domain: string;
  listDocuments: (
    tenantId: string,
    actorRoleKey?: RoleKey | null,
  ) => Promise<ServiceResult<DomainDocument[]>>;
};

export function createDocumentService(
  wpNumber: number,
  domain: string,
  permission: Parameters<typeof enforcePermission>[1],
  documents: DomainDocument[],
): DomainDocumentService {
  return {
    wpNumber,
    domain,
    async listDocuments(tenantId, actorRoleKey) {
      const denied = enforcePermission<DomainDocument[]>(actorRoleKey, permission);
      if (denied) return denied;
      if (tenantId !== DEMO_TENANT_ID) return { ok: false, error: 'Mandant nicht gefunden.' };
      await new Promise((r) => setTimeout(r, 180));
      return { ok: true, data: documents };
    },
  };
}
`,
);

write(
  'src/lib/workflow/domainWorkflowFactory.ts',
  `import type { WorkflowStatus } from '@/types/core/base';
import { validateTransition, getNextActions } from '@/lib/services/workflow/workflowEngine';

export type DomainWorkflowConfig = {
  wpNumber: number;
  domain: string;
  initialStatus: WorkflowStatus;
  validate: typeof validateTransition;
  getActions: typeof getNextActions;
};

export function createDomainWorkflow(
  wpNumber: number,
  domain: string,
  initialStatus: WorkflowStatus = 'entwurf',
): DomainWorkflowConfig {
  return {
    wpNumber,
    domain,
    initialStatus,
    validate: validateTransition,
    getActions: getNextActions,
  };
}
`,
);

const DEMO_LABELS = {
  business: 'Business-KPI',
  office: 'Office-Stammdaten',
  clients: 'Klient:in',
  employees: 'Mitarbeitende:r',
  officeDocs: 'Office-Dokument',
  billing: 'Rechnungsentwurf',
  assistPlanning: 'Einsatzplan',
  execution: 'Durchführungsprotokoll',
  careRecords: 'Pflegenachweis',
  trips: 'Fahrteneintrag',
  employeePortal: 'Portal-Zeiteintrag',
  clientPortal: 'Klientenanfrage',
  pflege: 'Pflegeplan',
  stationaer: 'Bewohner:in',
  beratung: 'Beratungsfall',
  akademie: 'Kurs',
  catalog: 'Katalogposition',
  platform: 'OCR-Job',
  integrations: 'Integration',
};

const DOC_PERMISSIONS = {
  business: 'business.dashboard.view',
  office: 'office.view',
  clients: 'office.clients.view',
  employees: 'office.employees.view',
  billing: 'office.invoices.view',
  assistPlanning: 'assist.assignments.view',
  execution: 'assist.execution.view',
  careRecords: 'assist.care_records.view',
  trips: 'assist.trips.view',
  employeePortal: 'portal.employee.view',
  clientPortal: 'portal.client.view',
  pflege: 'pflege.view',
  stationaer: 'stationaer.view',
  beratung: 'beratung.view',
  akademie: 'akademie.view',
  catalog: 'office.catalogs.view',
  platform: 'business.platform.view',
  integrations: 'business.integrations.view',
  officeDocs: 'office.documents.view',
};

for (const [wp, domain] of DEMO_WPS) {
  const label = DEMO_LABELS[domain];
  const exportName = `${domain}Demo`;
  write(
    `src/data/demo/domains/${domain}Demo.ts`,
    `import { createDomainDemo } from './domainDemoFactory';

/** WP${wp} — Demo-Daten (${domain}) */
export const ${exportName} = createDomainDemo(${wp}, '${domain}', [
  { id: '${domain}-demo-001', label: '${label} Alpha', status: 'aktiv' },
  { id: '${domain}-demo-002', label: '${label} Beta', status: 'in_bearbeitung' },
  { id: '${domain}-demo-003', label: '${label} Gamma', status: 'entwurf' },
]);
`,
  );
}

for (const [wp, domain] of DOC_WPS) {
  const perm = DOC_PERMISSIONS[domain];
  const varName = `${domain}DocumentService`;
  write(
    `src/lib/documents/${domain}DocumentService.ts`,
    `import { createDocumentService } from './documentServiceFactory';

/** WP${wp} — Dokumente & PDF (${domain}) */
export const ${varName} = createDocumentService(
  ${wp},
  '${domain}',
  '${perm}' as never,
  [
    { id: 'doc-${domain}-001', title: '${DEMO_LABELS[domain]} PDF', fileName: '${domain}-001.pdf', mimeType: 'application/pdf', status: 'aktiv' },
    { id: 'doc-${domain}-002', title: '${DEMO_LABELS[domain]} Anhang', fileName: '${domain}-002.pdf', mimeType: 'application/pdf', status: 'entwurf' },
  ],
);
`,
  );
}

for (const [wp, domain] of WORKFLOW_WPS) {
  const varName = `${domain}Workflow`;
  write(
    `src/lib/workflow/${domain}Workflow.ts`,
    `import { createDomainWorkflow } from './domainWorkflowFactory';

/** WP${wp} — Workflow & Status (${domain}) */
export const ${varName} = createDomainWorkflow(${wp}, '${domain}', 'entwurf');
`,
  );
}

// Portal / communication extras
write(
  'src/screens/portal/EmployeePortalAnnouncementsScreen.tsx',
  `import { Text, StyleSheet } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { PremiumCard } from '@/components/ui';
import { employeePortalDemo } from '@/data/demo/domains/employeePortalDemo';
import { typography } from '@/theme';

/** WP332 — Portal-Sicht Mitarbeiter */
export function EmployeePortalAnnouncementsScreen() {
  return (
    <ScreenShell title="Ankündigungen" subtitle="Mitarbeiterportal · WP 332">
      {employeePortalDemo.records.map((r) => (
        <PremiumCard key={r.id}>
          <Text style={styles.title}>{r.label}</Text>
          <Text style={styles.meta}>Status: {r.status}</Text>
        </PremiumCard>
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.bodyStrong },
  meta: { ...typography.caption },
});
`,
);

write(
  'src/screens/portal/EmployeePortalComposeScreen.tsx',
  `import { DomainComposeMessageScreen } from '@/screens/shared/DomainComposeMessageScreen';

/** WP333 — Kommunikation Mitarbeiterportal */
export function EmployeePortalComposeScreen() {
  return <DomainComposeMessageScreen wpNumber={333} domain="portal/employee" title="Nachricht senden" />;
}
`,
);

write(
  'src/screens/portal/ClientPortalAnnouncementsScreen.tsx',
  `import { Text, StyleSheet } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { PremiumCard } from '@/components/ui';
import { clientPortalDemo } from '@/data/demo/domains/clientPortalDemo';
import { typography } from '@/theme';

/** WP352 — Portal-Sicht Klient:innen */
export function ClientPortalAnnouncementsScreen() {
  return (
    <ScreenShell title="Mitteilungen" subtitle="Klient:innenportal · WP 352">
      {clientPortalDemo.records.map((r) => (
        <PremiumCard key={r.id}>
          <Text style={styles.title}>{r.label}</Text>
          <Text style={styles.meta}>Status: {r.status}</Text>
        </PremiumCard>
      ))}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.bodyStrong },
  meta: { ...typography.caption },
});
`,
);

write(
  'src/screens/portal/ClientPortalComposeScreen.tsx',
  `import { DomainComposeMessageScreen } from '@/screens/shared/DomainComposeMessageScreen';

/** WP353 — Kommunikation Klient:innenportal */
export function ClientPortalComposeScreen() {
  return <DomainComposeMessageScreen wpNumber={353} domain="portal/client" title="Nachricht senden" />;
}
`,
);

write(
  'src/screens/office/OfficeDocumentsComposeMessageScreen.tsx',
  `import { DomainComposeMessageScreen } from '@/screens/shared/DomainComposeMessageScreen';

/** WP213 — Kommunikation Office Dokumente */
export function OfficeDocumentsComposeMessageScreen() {
  return <DomainComposeMessageScreen wpNumber={213} domain="office/documents" title="Dokument-Nachricht" />;
}
`,
);

write(
  'src/lib/office/invoiceBillingAuditService.ts',
  `import { createBillingAuditTrail } from '@/lib/shared/billingAudit';

/** WP236 — Abrechnung & Audit (Rechnungen) */
export function getInvoiceBillingAudit() {
  return createBillingAuditTrail(236, 'office/invoices');
}
`,
);

write(
  'src/lib/platform/aiExtensionService.ts',
  `import { createAiExtension } from '@/lib/shared/aiExtension';

/** WP477 — AI/OCR/API (Plattform) */
export function getPlatformAiExtension() {
  return createAiExtension(477, 'platform', ['ocr', 'summarize', 'classify', 'assist']);
}
`,
);

write(
  'src/lib/integrations/billingAuditService.ts',
  `import { createBillingAuditTrail } from '@/lib/shared/billingAudit';

/** WP496 — Abrechnung & Audit (Integrationen) */
export function getIntegrationsBillingAudit() {
  return createBillingAuditTrail(496, 'integrations');
}
`,
);

write(
  'src/lib/integrations/aiExtensionService.ts',
  `import { createAiExtension } from '@/lib/shared/aiExtension';

/** WP497 — AI/OCR/API (Integrationen) */
export function getIntegrationsAiExtension() {
  return createAiExtension(497, 'integrations', ['classify', 'assist']);
}
`,
);

console.log('\nDone — 63 M-WP deliverable files generated.');
