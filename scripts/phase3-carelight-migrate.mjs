#!/usr/bin/env node
/**
 * Phase 3 — replace ScreenShell with explicit CareLightPageShell on priority routes.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const PHASE3_SCREENS = [
  // QM
  'src/screens/qm/QmSettingsScreen.tsx',
  'src/screens/qm/QmDocumentsScreen.tsx',
  'src/screens/qm/QmTemplatesScreen.tsx',
  'src/screens/qm/QmLegalReferencesScreen.tsx',
  'src/screens/qm/QmExportCenterScreen.tsx',
  'src/screens/qm/QmAiAssistantScreen.tsx',
  'src/screens/qm/QmHandbookChapterScreen.tsx',
  'src/screens/qm/QmAuditsScreen.tsx',
  'src/screens/qm/MdShareViewScreen.tsx',
  'src/screens/qm/QmHandbookScreen.tsx',
  'src/screens/qm/MdAuditCenterScreen.tsx',
  'src/screens/qm/QmComplianceScreen.tsx',
  'src/screens/qm/QmDocumentDetailScreen.tsx',
  'src/screens/qm/MdAuditPackageDetailScreen.tsx',
  'src/screens/qm/QmChangesScreen.tsx',
  'src/screens/qm/QmMeasuresScreen.tsx',
  // TI
  'src/screens/ti/TIConsentManagementScreen.tsx',
  'src/screens/ti/EGKVorbereitungScreen.tsx',
  'src/screens/ti/ERezeptVorbereitungScreen.tsx',
  'src/screens/ti/EPAVorbereitungScreen.tsx',
  'src/screens/ti/TIDocumentAssignmentScreen.tsx',
  'src/screens/ti/TIProviderSettingsScreen.tsx',
  'src/screens/ti/TIAuditLogScreen.tsx',
  'src/screens/ti/EMPVorbereitungScreen.tsx',
  'src/screens/ti/TIDashboardScreen.tsx',
  'src/screens/ti/KIMMessageDetailScreen.tsx',
  'src/screens/ti/KIMMailboxScreen.tsx',
  // Portal
  'src/screens/portal/PortalClientDocumentDetailScreen.tsx',
  'src/screens/portal/PortalDocumentDetailScreen.tsx',
  'src/screens/portal/PortalAssignmentDetailScreen.tsx',
  'src/screens/portal/ClientPortalAnnouncementsScreen.tsx',
  'src/screens/portal/EmployeePortalAnnouncementsScreen.tsx',
  'src/screens/portal/PortalClientAppointmentDetailScreen.tsx',
  'src/screens/portal/PortalTabScreen.tsx',
  'src/screens/portal/EmployeePortalComposeScreen.tsx',
  'src/screens/portal/ClientPortalComposeScreen.tsx',
  'src/screens/portal/PortalMessageDetailScreen.tsx',
  'src/screens/portal/ClientPortalProfileScreen.tsx',
  'src/screens/portal/PortalViewScreen.tsx',
  'src/screens/portal/EmployeeProfileScreen.tsx',
  'src/screens/portal/PortalClientMessageDetailScreen.tsx',
  'src/screens/PortalDashboardScreen.tsx',
  // Templates
  'src/screens/templates/CatalogsScreen.tsx',
  'src/screens/templates/TemplateCenterScreen.tsx',
  'src/screens/templates/TemplateEditScreen.tsx',
  'src/screens/templates/TemplateListScreenBase.tsx',
  'src/screens/templates/TemplateSettingsScreen.tsx',
  'src/screens/templates/TemplateDetailScreen.tsx',
  'src/screens/templates/TemplateCategoriesScreen.tsx',
  'src/screens/templates/TemplateCreateScreen.tsx',
  // Office create/edit
  'src/screens/office/EmployeeCreateScreen.tsx',
  'src/screens/office/EmployeeEditScreen.tsx',
  'src/screens/office/ClientEditScreen.tsx',
  'src/screens/office/access/CreateEmployeePortalAccountScreen.tsx',
  'src/screens/office/access/CreateInternalUserScreen.tsx',
  // Compose shared
  'src/screens/shared/MessageComposeScreenShell.tsx',
  'src/screens/shared/DomainComposeMessageScreen.tsx',
  // Pflege create
  'src/screens/pflege/VitalReadingCreateScreen.tsx',
];

function migrateScreenShell(content) {
  if (!content.includes('ScreenShell')) return content;
  let next = content;
  next = next.replace(
    /import \{ ScreenShell \} from '@\/components\/layout';/g,
    "import { CareLightPageShell } from '@/components/layout';",
  );
  next = next.replace(/<ScreenShell\b/g, '<CareLightPageShell');
  next = next.replace(/<\/ScreenShell>/g, '</CareLightPageShell>');
  return next;
}

let migrated = 0;
let skipped = 0;

for (const rel of PHASE3_SCREENS) {
  const filePath = join(root, rel);
  if (!existsSync(filePath)) {
    console.warn(`skip (missing): ${rel}`);
    skipped++;
    continue;
  }
  const before = readFileSync(filePath, 'utf8');
  const after = migrateScreenShell(before);
  if (after === before) {
    skipped++;
    continue;
  }
  writeFileSync(filePath, after);
  migrated++;
  console.log(`✓ ${rel}`);
}

console.log(`\nPhase 3 screen migration: ${migrated} updated, ${skipped} unchanged/missing`);
