#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = join(root, 'scripts', 'wp-m-catalog.mjs');

const NEW_ENTRIES = [
  // Demo-Daten (pos 11)
  { wp: 131, topic: 'Demo-Daten', deliverable: 'src/data/demo/domains/businessDemo.ts' },
  { wp: 151, topic: 'Demo-Daten', deliverable: 'src/data/demo/domains/officeDemo.ts' },
  { wp: 171, topic: 'Demo-Daten', deliverable: 'src/data/demo/domains/clientsDemo.ts' },
  { wp: 191, topic: 'Demo-Daten', deliverable: 'src/data/demo/domains/employeesDemo.ts' },
  { wp: 211, topic: 'Demo-Daten', deliverable: 'src/data/demo/domains/officeDocsDemo.ts' },
  { wp: 231, topic: 'Demo-Daten', deliverable: 'src/data/demo/domains/billingDemo.ts' },
  { wp: 251, topic: 'Demo-Daten', deliverable: 'src/data/demo/domains/assistPlanningDemo.ts' },
  { wp: 271, topic: 'Demo-Daten', deliverable: 'src/data/demo/domains/executionDemo.ts' },
  { wp: 291, topic: 'Demo-Daten', deliverable: 'src/data/demo/domains/careRecordsDemo.ts' },
  { wp: 311, topic: 'Demo-Daten', deliverable: 'src/data/demo/domains/tripsDemo.ts' },
  { wp: 331, topic: 'Demo-Daten', deliverable: 'src/data/demo/domains/employeePortalDemo.ts' },
  { wp: 351, topic: 'Demo-Daten', deliverable: 'src/data/demo/domains/clientPortalDemo.ts' },
  { wp: 371, topic: 'Demo-Daten', deliverable: 'src/data/demo/domains/pflegeDemo.ts' },
  { wp: 391, topic: 'Demo-Daten', deliverable: 'src/data/demo/domains/stationaerDemo.ts' },
  { wp: 411, topic: 'Demo-Daten', deliverable: 'src/data/demo/domains/beratungDemo.ts' },
  { wp: 431, topic: 'Demo-Daten', deliverable: 'src/data/demo/domains/akademieDemo.ts' },
  { wp: 451, topic: 'Demo-Daten', deliverable: 'src/data/demo/domains/catalogDemo.ts' },
  { wp: 471, topic: 'Demo-Daten', deliverable: 'src/data/demo/domains/platformDemo.ts' },
  { wp: 491, topic: 'Demo-Daten', deliverable: 'src/data/demo/domains/integrationsDemo.ts' },
  // Dokumente (pos 14)
  { wp: 134, topic: 'Dokumente & PDF', deliverable: 'src/lib/documents/businessDocumentService.ts' },
  { wp: 154, topic: 'Dokumente & PDF', deliverable: 'src/lib/documents/officeDocumentService.ts' },
  { wp: 174, topic: 'Dokumente & PDF', deliverable: 'src/lib/documents/clientsDocumentService.ts' },
  { wp: 194, topic: 'Dokumente & PDF', deliverable: 'src/lib/documents/employeesDocumentService.ts' },
  { wp: 234, topic: 'Dokumente & PDF', deliverable: 'src/lib/documents/billingDocumentService.ts' },
  { wp: 254, topic: 'Dokumente & PDF', deliverable: 'src/lib/documents/assistPlanningDocumentService.ts' },
  { wp: 274, topic: 'Dokumente & PDF', deliverable: 'src/lib/documents/executionDocumentService.ts' },
  { wp: 294, topic: 'Dokumente & PDF', deliverable: 'src/lib/documents/careRecordsDocumentService.ts' },
  { wp: 314, topic: 'Dokumente & PDF', deliverable: 'src/lib/documents/tripsDocumentService.ts' },
  { wp: 334, topic: 'Dokumente & PDF', deliverable: 'src/lib/documents/employeePortalDocumentService.ts' },
  { wp: 354, topic: 'Dokumente & PDF', deliverable: 'src/lib/documents/clientPortalDocumentService.ts' },
  { wp: 374, topic: 'Dokumente & PDF', deliverable: 'src/lib/documents/pflegeDocumentService.ts' },
  { wp: 394, topic: 'Dokumente & PDF', deliverable: 'src/lib/documents/stationaerDocumentService.ts' },
  { wp: 414, topic: 'Dokumente & PDF', deliverable: 'src/lib/documents/beratungDocumentService.ts' },
  { wp: 434, topic: 'Dokumente & PDF', deliverable: 'src/lib/documents/catalogDocumentService.ts' },
  { wp: 474, topic: 'Dokumente & PDF', deliverable: 'src/lib/documents/platformDocumentService.ts' },
  { wp: 494, topic: 'Dokumente & PDF', deliverable: 'src/lib/documents/integrationsDocumentService.ts' },
  // Workflow (pos 15)
  { wp: 135, topic: 'Workflow & Status', deliverable: 'src/lib/workflow/businessWorkflow.ts' },
  { wp: 155, topic: 'Workflow & Status', deliverable: 'src/lib/workflow/officeWorkflow.ts' },
  { wp: 175, topic: 'Workflow & Status', deliverable: 'src/lib/workflow/clientsWorkflow.ts' },
  { wp: 195, topic: 'Workflow & Status', deliverable: 'src/lib/workflow/employeesWorkflow.ts' },
  { wp: 215, topic: 'Workflow & Status', deliverable: 'src/lib/workflow/officeDocsWorkflow.ts' },
  { wp: 235, topic: 'Workflow & Status', deliverable: 'src/lib/workflow/billingWorkflow.ts' },
  { wp: 255, topic: 'Workflow & Status', deliverable: 'src/lib/workflow/assistPlanningWorkflow.ts' },
  { wp: 275, topic: 'Workflow & Status', deliverable: 'src/lib/workflow/executionWorkflow.ts' },
  { wp: 295, topic: 'Workflow & Status', deliverable: 'src/lib/workflow/careRecordsWorkflow.ts' },
  { wp: 315, topic: 'Workflow & Status', deliverable: 'src/lib/workflow/tripsWorkflow.ts' },
  { wp: 335, topic: 'Workflow & Status', deliverable: 'src/lib/workflow/employeePortalWorkflow.ts' },
  { wp: 355, topic: 'Workflow & Status', deliverable: 'src/lib/workflow/clientPortalWorkflow.ts' },
  { wp: 375, topic: 'Workflow & Status', deliverable: 'src/lib/workflow/pflegeWorkflow.ts' },
  { wp: 395, topic: 'Workflow & Status', deliverable: 'src/lib/workflow/stationaerWorkflow.ts' },
  { wp: 415, topic: 'Workflow & Status', deliverable: 'src/lib/workflow/beratungWorkflow.ts' },
  { wp: 435, topic: 'Workflow & Status', deliverable: 'src/lib/workflow/catalogWorkflow.ts' },
  { wp: 475, topic: 'Workflow & Status', deliverable: 'src/lib/workflow/platformWorkflow.ts' },
  { wp: 495, topic: 'Workflow & Status', deliverable: 'src/lib/workflow/integrationsWorkflow.ts' },
  // Portal/Kommunikation
  { wp: 332, topic: 'Portal-Sicht', deliverable: 'src/screens/portal/EmployeePortalAnnouncementsScreen.tsx' },
  { wp: 333, topic: 'Kommunikation', deliverable: 'src/screens/portal/EmployeePortalComposeScreen.tsx' },
  { wp: 352, topic: 'Portal-Sicht', deliverable: 'src/screens/portal/ClientPortalAnnouncementsScreen.tsx' },
  { wp: 353, topic: 'Kommunikation', deliverable: 'src/screens/portal/ClientPortalComposeScreen.tsx' },
  // Abrechnung/KI
  { wp: 236, topic: 'Abrechnung & Audit', deliverable: 'src/lib/office/invoiceBillingAuditService.ts' },
  { wp: 477, topic: 'AI/OCR/API', deliverable: 'src/lib/platform/aiExtensionService.ts' },
  { wp: 496, topic: 'Abrechnung & Audit', deliverable: 'src/lib/integrations/billingAuditService.ts' },
  { wp: 497, topic: 'AI/OCR/API', deliverable: 'src/lib/integrations/aiExtensionService.ts' },
  // Office Kommunikation
  { wp: 213, topic: 'Kommunikation', deliverable: 'src/screens/office/OfficeDocumentsComposeMessageScreen.tsx' },
];

let content = readFileSync(catalogPath, 'utf8');
const header = content.match(/^[\s\S]*?export const M_WP_CATALOG = \[/)[0];
const existing = [...content.matchAll(/\{\s*wp:\s*(\d+)/g)].map((m) => parseInt(m[1], 10));
const existingSet = new Set(existing);

const toAdd = NEW_ENTRIES.filter((e) => !existingSet.has(e.wp));
const allEntries = [...content.matchAll(/\{\s*wp:\s*(\d+),\s*topic:\s*'([^']+)',\s*deliverable:\s*'([^']+)'\s*\}/g)]
  .map((m) => ({ wp: parseInt(m[1], 10), topic: m[2], deliverable: m[3] }));

for (const e of toAdd) allEntries.push(e);
allEntries.sort((a, b) => a.wp - b.wp);

const lines = allEntries.map(
  (e) => `  { wp: ${e.wp}, topic: '${e.topic}', deliverable: '${e.deliverable}' },`,
);

const newContent = `/**
 * CareSuite+ — Katalog aller M-Arbeitspakete (WP 001–500).
 * Jedes Paket hat mindestens eine Prüf-Datei (deliverable).
 */
export const M_WP_CATALOG = [
${lines.join('\n')}
];
`;

writeFileSync(catalogPath, newContent, 'utf8');
console.log(`Catalog updated: ${allEntries.length} entries (${toAdd.length} new)`);
