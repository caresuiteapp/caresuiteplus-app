#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED = [
  'src/screens/business/office/ClientIntakeWizardScreen.tsx',
  'src/components/office/clientintakewizardform.tsx',
  'src/lib/clients/clientIntakeFieldRules.ts',
  'src/lib/clients/clientIntakeService.ts',
  'src/screens/business/office/ClientRecordScreen.tsx',
  'app/business/office/clients/new.tsx',
  'app/business/office/clients/[id].tsx',
  'src/hooks/useClientIntakeWizard.ts',
  'src/components/inputs/CareCatalogSelect.tsx',
  'src/components/inputs/CareMultiCatalogSelect.tsx',
  'src/lib/navigation/clientRoutes.ts',
];

const PATTERNS = [
  { file: 'src/components/office/clientintakewizardform.tsx', pattern: 'leistungsart' },
  { file: 'src/components/office/clientintakewizardform.tsx', pattern: 'CareMultiCatalogSelect' },
  { file: 'src/screens/business/office/ClientIntakeWizardScreen.tsx', pattern: 'ScreenShell' },
  { file: 'src/lib/clients/clientIntakeFieldRules.ts', pattern: 'getClientRecordTabsForClientContext' },
  { file: 'src/lib/clients/clientIntakeFieldRules.ts', pattern: 'homeAccess' },
  { file: 'src/lib/clients/clientIntakeFieldRules.ts', pattern: 'roomNumber' },
  { file: 'src/screens/business/office/ClientRecordScreen.tsx', pattern: 'Stammdaten bearbeiten' },
  { file: 'src/screens/business/office/ClientRecordScreen.tsx', pattern: 'ScreenShell' },
  { file: 'app/business/office/clients/new.tsx', pattern: 'ClientIntakeWizardScreen' },
  { file: 'app/business/office/clients/[id].tsx', pattern: 'ClientRecordScreen' },
];

/** Entry points must not hard-link to the legacy create wizard screen. */
const WIRING_CHECKS = [
  {
    file: 'src/components/office/ClientsListView.tsx',
    mustContain: ['CLIENT_INTAKE_NEW_ROUTE', 'clientRecordRoute'],
    mustNotContain: ["'/office/clients/create'"],
  },
  {
    file: 'src/screens/office/ClientsListScreen.tsx',
    mustContain: ['CLIENT_INTAKE_NEW_ROUTE'],
    mustNotContain: ["'/office/clients/create'"],
  },
  {
    file: 'app/office/clients/create.tsx',
    mustContain: ['Redirect', 'CLIENT_INTAKE_NEW_ROUTE'],
    mustNotContain: ['ClientCreateScreen'],
  },
  {
    file: 'app/office/clients/[id]/index.tsx',
    mustContain: ['Redirect', 'clientRecordRoute'],
    mustNotContain: ['ClientDetailScreen'],
  },
];

function fail(msg) {
  console.error(`\n✗ client-intake:audit fehlgeschlagen: ${msg}\n`);
  process.exit(1);
}

console.log('CareSuite+ client-intake:audit\n');

for (const rel of REQUIRED) {
  if (!existsSync(join(root, rel))) fail(`Fehlende Datei: ${rel}`);
}

for (const { file, pattern } of PATTERNS) {
  const content = readFileSync(join(root, file), 'utf8');
  if (!content.includes(pattern)) fail(`${file}: Muster „${pattern}" fehlt`);
}

for (const { file, mustContain, mustNotContain } of WIRING_CHECKS) {
  const content = readFileSync(join(root, file), 'utf8');
  for (const pattern of mustContain) {
    if (!content.includes(pattern)) fail(`${file}: Wiring fehlt — „${pattern}"`);
  }
  for (const pattern of mustNotContain) {
    if (content.includes(pattern)) fail(`${file}: Legacy-Wiring noch aktiv — „${pattern}"`);
  }
}

const wizard = readFileSync(join(root, 'src/components/office/clientintakewizardform.tsx'), 'utf8');
if (!wizard.includes("section === 'leistungsart'")) {
  fail('ClientIntakeWizardForm: Leistungsart-Schritt fehlt');
}

const rules = readFileSync(join(root, 'src/lib/clients/clientIntakeFieldRules.ts'), 'utf8');
if (!rules.includes('daily_assistance')) fail('Leistungsarten fehlen');
if (!rules.includes('ambulatory_care')) fail('Ambulante Pflege fehlt');

const intakeService = readFileSync(join(root, 'src/lib/clients/clientIntakeService.ts'), 'utf8');
if (!intakeService.includes('getVisibleSectionsForClientContext')) {
  fail('clientIntakeService: getIntakeStepsForContexts muss sichtbare Sektionen nutzen');
}
if (!rules.includes("'leistungsart'")) {
  fail('clientIntakeFieldRules: leistungsart muss erste Sichtbarkeits-Sektion sein');
}

console.log('✓ client-intake:audit bestanden\n');
