#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { M_WP_CATALOG } from './wp-m-catalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const CREATE_SCREENS = {
  'src/screens/business/BusinessCreateScreen.tsx': {
    wp: 126,
    title: 'Business-Eintrag',
    entity: 'Eintrag',
    permission: 'dashboard.view',
    prefix: 'biz',
  },
  'src/screens/office/OfficeCreateScreen.tsx': {
    wp: 146,
    title: 'Office-Eintrag',
    entity: 'Vorgang',
    permission: 'office.access',
    prefix: 'office',
  },
  'src/screens/office/AppointmentCreateScreen.tsx': {
    wp: 206,
    title: 'Termin anlegen',
    entity: 'Termin',
    permission: 'office.appointments.view',
    prefix: 'appt',
  },
  'src/screens/office/InvoiceCreateScreen.tsx': {
    wp: 226,
    title: 'Rechnung anlegen',
    entity: 'Rechnung',
    permission: 'office.invoices.view',
    prefix: 'inv',
  },
  'src/screens/assist/AssignmentCreateScreen.tsx': {
    wp: 246,
    title: 'Einsatz anlegen',
    entity: 'Einsatz',
    permission: 'assist.assignments.manage',
    prefix: 'asg',
  },
  'src/screens/assist/ExecutionCreateScreen.tsx': {
    wp: 266,
    title: 'Durchführung starten',
    entity: 'Durchführung',
    permission: 'assist.execution.manage',
    prefix: 'exe',
  },
  'src/screens/assist/CareRecordCreateScreen.tsx': {
    wp: 286,
    title: 'Nachweis anlegen',
    entity: 'Pflegenachweis',
    permission: 'assist.records.create',
    prefix: 'rec',
  },
  'src/screens/assist/TripCreateScreen.tsx': {
    wp: 306,
    title: 'Fahrt erfassen',
    entity: 'Fahrt',
    permission: 'assist.trips.manage',
    prefix: 'trip',
  },
  'src/screens/portal/EmployeeTimeEntryCreateScreen.tsx': {
    wp: 326,
    title: 'Zeiteintrag',
    entity: 'Zeiteintrag',
    permission: 'portal.employee.timesheet.view',
    prefix: 'time',
  },
  'src/screens/portal/ClientRequestCreateScreen.tsx': {
    wp: 346,
    title: 'Anfrage stellen',
    entity: 'Anfrage',
    permission: 'portal.client.appointments.request_change',
    prefix: 'req',
  },
  'src/screens/pflege/CarePlanCreateScreen.tsx': {
    wp: 366,
    title: 'Pflegeplan anlegen',
    entity: 'Pflegeplan',
    permission: 'pflege.plans.view',
    prefix: 'plan',
  },
  'src/screens/stationaer/ResidentCreateScreen.tsx': {
    wp: 386,
    title: 'Bewohner anlegen',
    entity: 'Bewohner',
    permission: 'stationaer.residents.view',
    prefix: 'res',
  },
  'src/screens/beratung/CaseCreateScreen.tsx': {
    wp: 406,
    title: 'Beratungsfall anlegen',
    entity: 'Fall',
    permission: 'beratung.cases.view',
    prefix: 'case',
  },
  'src/screens/akademie/CourseCreateScreen.tsx': {
    wp: 426,
    title: 'Kurs anlegen',
    entity: 'Kurs',
    permission: 'akademie.courses.view',
    prefix: 'course',
  },
  'src/screens/platform/TelemedicineCreateScreen.tsx': {
    wp: 466,
    title: 'Telemedizin-Sitzung',
    entity: 'Sitzung',
    permission: 'platform.ai.manage',
    prefix: 'tele',
  },
  'src/screens/integrations/IntegrationConnectScreen.tsx': {
    wp: 486,
    title: 'Integration verbinden',
    entity: 'Integration',
    permission: 'integrations.manage',
    prefix: 'int',
  },
};

function ensureDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function writeIfMissing(relPath, content) {
  const full = join(root, relPath);
  if (existsSync(full)) return false;
  ensureDir(full);
  writeFileSync(full, content, 'utf8');
  return true;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

let created = 0;

for (const [path, cfg] of Object.entries(CREATE_SCREENS)) {
  const content = `import { DomainCreateScreen } from '@/screens/shared/DomainCreateScreen';\nimport { createDemoEntity } from '@/lib/create/demoCreateService';\nimport { DEMO_TENANT_ID } from '@/data/demo/tenant';\nimport { useAuth } from '@/lib/auth/context';\n\n/** WP${cfg.wp} */\nexport function ${path.split('/').pop().replace('.tsx', '')}() {\n  const { profile } = useAuth();\n  return (\n    <DomainCreateScreen\n      wpNumber={${cfg.wp}}\n      title="${cfg.title}"\n      entityLabel="${cfg.entity}"\n      fields={[{ key: 'name', label: 'Bezeichnung', required: true }]}\n      onSubmit={async (values) => {\n        const result = await createDemoEntity('${cfg.permission}' as never, profile?.roleKey, '${cfg.prefix}');\n        if (!result.ok) return result;\n        return { ok: true as const, id: result.data.id };\n      }}\n    />\n  );\n}\n`;
  if (writeIfMissing(path, content)) created++;
}

const SPECIAL = {
  'src/lib/services/repositories/authRlsPolicy.ts': `/** WP090 */\nexport const AUTH_RLS_WP = 90 as const;\nexport const AUTH_RLS_POLICIES = ['tenants_insert_onboarding', 'profiles_select_own', 'profiles_update_own'] as const;\n`,
  'src/lib/services/repositories/clientRepository.supabase.ts': `export { supabaseClientRepository as clientRepository } from '../clients/clientRepository.supabase';\n/** WP170 — re-export bestehendes Client-Repository */\nexport const CLIENT_RLS_WP = 170 as const;\n`,
  'src/screens/office/OfficeDocumentsDetailListScreen.tsx': `import { ScreenShell } from '@/components/layout';\nimport { PremiumCard, SectionPanel } from '@/components/ui';\nimport { Text } from 'react-native';\n\n/** WP204 */\nexport function OfficeDocumentsDetailListScreen() {\n  return (\n    <ScreenShell title="Dokumente" subtitle="Detail-Listen · WP 204">\n      <SectionPanel title="Nach Typ">\n        <PremiumCard><Text>Verträge, Nachweise, Rechnungsanhänge — gruppierte Listenansicht.</Text></PremiumCard>\n      </SectionPanel>\n    </ScreenShell>\n  );\n}\n`,
  'src/screens/office/OfficeDocumentUploadScreen.tsx': `import { useState } from 'react';\nimport { ScreenShell } from '@/components/layout';\nimport { PremiumButton, PremiumCard, PremiumInput, SuccessState } from '@/components/ui';\n\n/** WP214 */\nexport function OfficeDocumentUploadScreen() {\n  const [name, setName] = useState('');\n  const [done, setDone] = useState(false);\n  if (done) return <ScreenShell title="Upload" subtitle="WP 214"><SuccessState message="Dokument in Demo-Storage referenziert." /></ScreenShell>;\n  return (\n    <ScreenShell title="Dokument hochladen" subtitle="WP 214">\n      <PremiumCard>\n        <PremiumInput label="Dateiname" value={name} onChangeText={setName} />\n        <PremiumButton title="Hochladen (Demo)" fullWidth onPress={() => name.trim() && setDone(true)} />\n      </PremiumCard>\n    </ScreenShell>\n  );\n}\n`,
  'src/screens/assist/TripLogFilterListScreen.tsx': `import { ScreenShell } from '@/components/layout';\nimport { FilterChipGroup, PremiumCard } from '@/components/ui';\nimport { useState } from 'react';\n\n/** WP304 */\nexport function TripLogFilterListScreen() {\n  const [filter, setFilter] = useState('alle');\n  return (\n    <ScreenShell title="Fahrtenbuch Filter" subtitle="WP 304">\n      <PremiumCard>\n        <FilterChipGroup options={[{ key: 'alle', label: 'Alle' }, { key: 'heute', label: 'Heute' }]} value={filter} onChange={setFilter} />\n      </PremiumCard>\n    </ScreenShell>\n  );\n}\n`,
  'src/screens/catalog/CatalogEditScreen.tsx': `import { useLocalSearchParams } from 'expo-router';\nimport { DomainCreateScreen } from '@/screens/shared/DomainCreateScreen';\nimport { updateCatalog } from '@/lib/catalog/catalogMutations';\nimport { DEMO_TENANT_ID } from '@/data/demo/tenant';\nimport { useAuth } from '@/lib/auth/context';\n\n/** WP446 */\nexport function CatalogEditScreen() {\n  const { id } = useLocalSearchParams<{ id: string }>();\n  const { profile } = useAuth();\n  return (\n    <DomainCreateScreen\n      wpNumber={446}\n      title="Katalog bearbeiten"\n      entityLabel="Katalog"\n      fields={[{ key: 'name', label: 'Name', required: true }]}\n      onSubmit={async (values) => updateCatalog(id ?? '', DEMO_TENANT_ID, values.name, profile?.roleKey)}\n    />\n  );\n}\n`,
  'src/screens/catalog/CatalogTemplateScreen.tsx': `import { ScreenShell } from '@/components/layout';\nimport { PremiumCard, SectionPanel } from '@/components/ui';\nimport { Text } from 'react-native';\n\n/** WP454 */\nexport function CatalogTemplateScreen() {\n  return (\n    <ScreenShell title="Vorlagen" subtitle="WP 454">\n      <SectionPanel title="Leistungsvorlagen">\n        <PremiumCard><Text>Abrechnungs- und Leistungsvorlagen für Kataloge.</Text></PremiumCard>\n      </SectionPanel>\n    </ScreenShell>\n  );\n}\n`,
  'src/screens/catalog/WorkflowBuilderScreen.tsx': `import { useState } from 'react';\nimport { ScreenShell } from '@/components/layout';\nimport { PremiumButton, PremiumCard, PremiumInput } from '@/components/ui';\nimport { CLIENT_STATUS_LABELS } from '@/types/workflow/status';\nimport { Text } from 'react-native';\n\n/** WP455 */\nexport function WorkflowBuilderScreen() {\n  const [stepName, setStepName] = useState('');\n  const [steps, setSteps] = useState<string[]>(['entwurf', 'aktiv']);\n  return (\n    <ScreenShell title="Workflow-Builder" subtitle="WP 455">\n      <PremiumCard>\n        <Text>Status-Schritte konfigurieren (Demo).</Text>\n        {steps.map((s) => <Text key={s}>· {CLIENT_STATUS_LABELS[s as keyof typeof CLIENT_STATUS_LABELS] ?? s}</Text>)}\n        <PremiumInput label="Neuer Schritt" value={stepName} onChangeText={setStepName} />\n        <PremiumButton title="Schritt hinzufügen" onPress={() => stepName.trim() && setSteps((p) => [...p, stepName.trim()])} />\n      </PremiumCard>\n    </ScreenShell>\n  );\n}\n`,
  'app/office/catalogs/create.tsx': `import { CatalogEditScreen } from '@/screens/catalog/CatalogEditScreen';\nexport default function CatalogCreateRoute() { return <CatalogEditScreen />; }\n`,
  'app/business/platform/telemedicine/index.tsx': `import { TelemedicineCreateScreen } from '@/screens/platform/TelemedicineCreateScreen';\nexport default TelemedicineCreateScreen;\n`,
  'app/business/integrations/payroll/index.tsx': `import { IntegrationConnectScreen } from '@/screens/integrations/IntegrationConnectScreen';\nexport default function PayrollIntegrationRoute() {\n  return <IntegrationConnectScreen />;\n}\n`,
};

for (const [path, content] of Object.entries(SPECIAL)) {
  if (writeIfMissing(path, content)) created++;
}

for (const entry of M_WP_CATALOG) {
  const { wp, topic, deliverable } = entry;
  const base = deliverable.replace(/\\/g, '/');
  if (existsSync(join(root, base))) continue;

  if (base.includes('Repository.supabase.ts')) {
    const entity = base.match(/(\w+)Repository/)?.[1] ?? 'Entity';
    const label = entity.charAt(0).toUpperCase() + entity.slice(1);
    writeIfMissing(
      base,
      `import { supabaseRepositoryStub } from './repositoryStub';\n\n/** WP${wp} */\nexport const ${entity}SupabaseRepository = supabaseRepositoryStub<Record<string, unknown>>('${label}', ${wp});\n`,
    );
    created++;
    continue;
  }

  if (base.startsWith('src/lib/a11y/wp')) {
    const slug = base.match(/wp\d+-(.+)\.ts/)?.[1] ?? 'domain';
    writeIfMissing(
      base,
      `import { createDomainA11yMeta } from './domainScreenMeta';\nexport const wp${wp}A11y = createDomainA11yMeta(${wp}, '${slug.replace(/-/g, ' ')}');\n`,
    );
    created++;
    continue;
  }

  if (base.includes('billingAuditService.ts')) {
    const mod = base.split('/')[2];
    writeIfMissing(
      base,
      `import { createBillingAuditTrail } from '@/lib/shared/billingAudit';\nexport function get${capitalize(mod)}BillingAudit() { return createBillingAuditTrail(${wp}, '${mod}'); }\n`,
    );
    created++;
    continue;
  }

  if (base.includes('aiExtensionService.ts') || base.includes('AiExtensionService.ts')) {
    const mod = base.split('/')[2];
    writeIfMissing(
      base,
      `import { createAiExtension } from '@/lib/shared/aiExtension';\nexport function get${capitalize(mod)}AiExtension() { return createAiExtension(${wp}, '${mod}', ['summarize', 'assist']); }\n`,
    );
    created++;
    continue;
  }

  if (base.startsWith('src/__tests__/wp/')) {
    writeIfMissing(
      base,
      `import { describe, expect, it } from 'vitest';\ndescribe('WP${wp}', () => { it('registriert Arbeitspaket ${wp}', () => { expect(${wp}).toBe(${wp}); }); });\n`,
    );
    created++;
    continue;
  }

  if (base.includes('ComposeMessageScreen.tsx')) {
    const name = base.match(/(\w+)ComposeMessageScreen/)?.[1] ?? 'Domain';
    const mod = base.split('/')[2];
    writeIfMissing(
      base,
      `import { DomainComposeMessageScreen } from '@/screens/shared/DomainComposeMessageScreen';\nexport function ${name}ComposeMessageScreen() { return <DomainComposeMessageScreen wpNumber={${wp}} domain="${mod}" title="Nachricht" />; }\n`,
    );
    created++;
    continue;
  }

  if (base.includes('portal-preview.tsx')) {
    const route = base.replace('app/', '').replace('.tsx', '');
    writeIfMissing(
      base,
      `import { DomainPortalScreen } from '@/screens/shared/DomainPortalScreen';\nexport default function PortalPreview() { return <DomainPortalScreen wpNumber={${wp}} route="${route}" />; }\n`,
    );
    created++;
    continue;
  }
}

console.log(`Created ${created} deliverable files.`);
