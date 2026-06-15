#!/usr/bin/env node
/**
 * Migrate Office list heroes to explicit CareLightListHeroFrame (ClientsListHero pattern).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const OFFICE_LIST_HEROES = [
  'src/components/office/AppointmentsListHero.tsx',
  'src/components/office/DocumentsListHero.tsx',
  'src/components/office/EmployeesListHero.tsx',
  'src/components/office/InvoicesListHero.tsx',
  'src/components/office/BudgetsListHero.tsx',
  'src/components/office/OfficeMessagesListHero.tsx',
];

const PHASE3_MODULE_LIST_HEROES = [
  'src/components/qm/QmDocumentsListHero.tsx',
  'src/components/templates/TemplateListHero.tsx',
  'src/components/ti/TIAuditLogListHero.tsx',
  'src/components/ti/TIConsentListHero.tsx',
  'src/components/ti/KIMMailboxListHero.tsx',
  'src/components/pflege/CarePlansListHero.tsx',
  'src/components/pflege/VitalReadingsListHero.tsx',
  'src/components/pflege/MedicationListHero.tsx',
  'src/components/assist/AssignmentsListHero.tsx',
  'src/components/assist/ExecutionsListHero.tsx',
  'src/components/assist/TripsListHero.tsx',
  'src/components/beratung/CasesListHero.tsx',
  'src/components/stationaer/ResidentsListHero.tsx',
  'src/components/akademie/CoursesListHero.tsx',
];

function migrateHeroImports(content) {
  let next = content;
  next = next.replace(
    /import \{ useMemo \} from 'react';\nimport \{ useLegacyTheme \} from '@\/design\/tokens\/themeBridge';\n/g,
    '',
  );
  next = next.replace(
    /PremiumListHeroFrame/g,
    'CareLightListHeroFrame',
  );
  next = next.replace(/PremiumKpiCard/g, 'CareLightKpiCard');
  next = next.replace(/PremiumButton/g, 'CareLightButton');

  if (!next.includes('CareLightListHeroFrame')) return next;

  if (!next.includes("from '@/design/tokens/lightTheme'")) {
    next = next.replace(
      /from '@\/components\/ui';/,
      "from '@/components/ui';\nimport { careLightColors } from '@/design/tokens/lightTheme';\nimport { careSpacing } from '@/design/tokens/spacing';\nimport { careTypography } from '@/design/tokens/typography';\nimport { moduleColor } from '@/design/tokens/modules';",
    );
  }

  next = next.replace(
    /(\s+)PremiumBadge,/,
    '$1CareLightButton,\n$1CareLightKpiCard,\n$1CareLightListHeroFrame,\n$1PremiumBadge,',
  );
  next = next.replace(/\n\s+CareLightButton,\n\s+CareLightKpiCard,\n\s+CareLightListHeroFrame,\n/g, '\n  CareLightButton,\n  CareLightKpiCard,\n  CareLightListHeroFrame,\n  ');

  // Deduplicate accidental double imports
  next = next.replace(/CareLightKpiCard,\n\s+CareLightKpiCard,/g, 'CareLightKpiCard,');
  next = next.replace(/CareLightListHeroFrame,\n\s+CareLightListHeroFrame,/g, 'CareLightListHeroFrame,');
  next = next.replace(/CareLightButton,\n\s+CareLightButton,/g, 'CareLightButton,');

  return next;
}

function migrateHeroBody(content) {
  let next = content;

  // Remove useLegacyTheme hook block
  next = next.replace(
    /\n  const \{ colors, typography, gradients, mode \} = useLegacyTheme\(\);\n  const styles = useMemo\(\n    \(\) =>\n      StyleSheet\.create\(\{[\s\S]*?\}\),\n    \[colors, typography, gradients\],\n  \);\n\n\n/,
    '\n  const accent = moduleColor(\'office\');\n\n',
  );

  // BudgetsListHero variant
  next = next.replace(
    /\n  const \{ colors, typography, gradients, mode \} = useLegacyTheme\(\);\n  const styles = useMemo\(\n    \(\) =>\n      StyleSheet\.create\(\{[\s\S]*?\}\),\n    \[colors, typography, gradients\],\n  \);\n\n\n  const kpis = buildBudgetListKpis\(items, mode\);/,
    "\n  const accent = moduleColor('office');\n  const kpis = buildBudgetListKpis(items, 'light');\n",
  );

  // Wrap CareLightListHeroFrame with accent
  next = next.replace(/<CareLightListHeroFrame>/g, '<CareLightListHeroFrame accentColor={accent}>');

  // Static styles block (append if missing)
  if (!next.includes('const styles = StyleSheet.create')) {
    next = next.replace(
      /const iconSize = designTokens\.hero\.iconBadgeSize;/,
      `const iconSize = designTokens.hero.iconBadgeSize;

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', gap: careSpacing.md },
  textCol: { flex: 1, gap: 2 },
  eyebrow: {
    ...careTypography.caption,
    color: careLightColors.cyan,
    letterSpacing: designTokens.hero.eyebrowLetterSpacing,
    fontWeight: '700',
  },
  title: { ...careTypography.h2, color: careLightColors.navy },
  meta: { ...careTypography.caption, color: careLightColors.muted },
  iconBadge: {
    width: iconSize,
    height: iconSize,
    borderRadius: iconSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: careLightColors.border,
  },
  iconText: { fontSize: 22 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: careSpacing.sm },
  kpiItem: { flex: 1, minWidth: 100 },
});`,
    );
  }

  // Icon badge background
  next = next.replace(
    /<View style={styles\.iconBadge}>/g,
    '<View style={[styles.iconBadge, { backgroundColor: `${accent}18` }]}>',
  );

  // CareLightButton without fullWidth
  next = next.replace(
    /<CareLightButton title="([^"]+)" onPress={(\w+)} fullWidth \/>/g,
    '<CareLightButton title="$1" onPress={$2} accentColor={accent} />',
  );

  return next;
}

function migrateFile(rel) {
  const filePath = join(root, rel);
  const before = readFileSync(filePath, 'utf8');
  if (!before.includes('PremiumListHeroFrame') && !before.includes('useLegacyTheme')) {
    console.log(`skip ${rel}`);
    return;
  }
  let after = migrateHeroImports(before);
  after = migrateHeroBody(after);
  if (after !== before) {
    writeFileSync(filePath, after);
    console.log(`✓ ${rel}`);
  }
}

for (const rel of [...OFFICE_LIST_HEROES, ...PHASE3_MODULE_LIST_HEROES]) {
  migrateFile(rel);
}

console.log('\nList hero CareLight migration complete');
