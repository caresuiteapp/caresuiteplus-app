#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const files = [
  'src/components/office/BudgetsListHero.tsx',
  'src/components/pflege/MedicationListHero.tsx',
  'src/components/qm/QmDocumentsListHero.tsx',
  'src/components/ti/TIAuditLogListHero.tsx',
  'src/components/ti/TIConsentListHero.tsx',
  'src/components/ti/KIMMailboxListHero.tsx',
];

const cleanImport = `import {
  CareLightKpiCard,
  CareLightListHeroFrame,
  PremiumBadge,
} from '@/components/ui';`;

for (const rel of files) {
  const filePath = join(root, rel);
  let s = readFileSync(filePath, 'utf8');
  s = s.replace(/, mode\)/g, ", 'light')");
  s = s.replace(/import \{[\s\S]*?\} from '@\/components\/ui';/, cleanImport);
  s = s.replace(/import \{ designTokens, spacing \}/g, 'import { designTokens }');

  if (rel.includes('/qm/')) {
    s = s.replace(/const accent = moduleColor\('office'\);/, "const accent = moduleColor('qm');");
  }
  if (rel.includes('/ti/')) {
    s = s.replace(/const accent = moduleColor\('office'\);/, 'const accent = careLightColors.cyan;');
  }
  if (!s.includes('preparedHint:')) {
    s = s.replace(
      /kpiItem: \{ flex: 1, minWidth: 100 \},\n\}\);/,
      "kpiItem: { flex: 1, minWidth: 100 },\n  preparedHint: { ...careTypography.caption, color: careLightColors.muted },\n});",
    );
  }
  writeFileSync(filePath, s);
  console.log('fixed', rel);
}
