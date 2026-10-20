#!/usr/bin/env node
/**
 * Phase 2 CareLight migration — batch-replace ScreenShell + dark heroes on priority routes.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const PRIORITY_SCREENS = [
  // Office lists/details/create
  'src/screens/office/ClientsListScreen.tsx',
  'src/screens/office/ClientDetailScreen.tsx',
  'src/screens/office/ClientCreateScreen.tsx',
  'src/screens/office/ClientEditScreen.tsx',
  'src/screens/office/EmployeesListScreen.tsx',
  'src/screens/office/EmployeeDetailScreen.tsx',
  'src/screens/office/EmployeeCreateScreen.tsx',
  'src/screens/office/EmployeeEditScreen.tsx',
  'src/screens/office/OfficeDocumentsListScreen.tsx',
  'src/screens/office/OfficeDocumentsDetailListScreen.tsx',
  'src/screens/office/OfficeDocumentUploadScreen.tsx',
  'src/screens/office/InvoicesListScreen.tsx',
  'src/screens/office/InvoiceDetailScreen.tsx',
  'src/screens/office/AppointmentsListScreen.tsx',
  'src/screens/office/AppointmentDetailScreen.tsx',
  'src/screens/office/OfficeMessagesListScreen.tsx',
  'src/screens/business/office/OfficeModuleAssignmentListScreen.tsx',
  // Pflege
  'src/screens/pflege/CarePlansListScreen.tsx',
  'src/screens/pflege/CarePlanDetailScreen.tsx',
  'src/screens/pflege/VitalReadingsListScreen.tsx',
  'src/screens/pflege/VitalReadingDetailScreen.tsx',
  'src/screens/pflege/VitalReadingCreateScreen.tsx',
  'src/screens/pflege/MedicationListScreen.tsx',
  'src/screens/pflege/MedicationDetailScreen.tsx',
  'src/screens/pflege/PflegeReportsScreen.tsx',
  'src/screens/pflege/SisOverviewScreen.tsx',
  // Assist
  'src/screens/assist/AssignmentsListScreen.tsx',
  'src/screens/assist/AssignmentDetailScreen.tsx',
  'src/screens/assist/ExecutionsListScreen.tsx',
  'src/screens/assist/ActiveExecutionsScreen.tsx',
  'src/screens/assist/AssignmentExecutionScreen.tsx',
  'src/screens/assist/TripsListScreen.tsx',
  'src/screens/assist/TripDetailScreen.tsx',
  // Beratung
  'src/screens/beratung/CasesListScreen.tsx',
  'src/screens/beratung/CaseDetailScreen.tsx',
  // Stationär
  'src/screens/stationaer/ResidentsListScreen.tsx',
  'src/screens/stationaer/ResidentDetailScreen.tsx',
  // Akademie
  'src/screens/akademie/CoursesListScreen.tsx',
  'src/screens/akademie/CourseDetailScreen.tsx',
  // Auth
  'src/screens/auth/BusinessLoginScreen.tsx',
  'src/screens/auth/EmployeePortalLoginScreen.tsx',
  'src/screens/auth/PortalCodeLoginScreen.tsx',
];

const PRIORITY_HEROES = [
  'src/components/office/ClientsListHero.tsx',
  'src/components/office/EmployeesListHero.tsx',
  'src/components/office/DocumentsListHero.tsx',
  'src/components/office/InvoicesListHero.tsx',
  'src/components/office/AppointmentsListHero.tsx',
  'src/components/office/OfficeMessagesListHero.tsx',
  'src/components/office/ClientDetailHero.tsx',
  'src/components/office/EmployeeDetailHero.tsx',
  'src/components/office/InvoiceDetailHero.tsx',
  'src/components/office/AppointmentDetailHero.tsx',
  'src/components/pflege/CarePlansListHero.tsx',
  'src/components/pflege/CarePlanDetailHero.tsx',
  'src/components/pflege/VitalReadingsListHero.tsx',
  'src/components/pflege/VitalReadingDetailHero.tsx',
  'src/components/pflege/MedicationListHero.tsx',
  'src/components/pflege/MedicationDetailHero.tsx',
  'src/components/pflege/PflegeReportsHero.tsx',
  'src/components/pflege/SisOverviewHero.tsx',
  'src/components/assist/AssignmentsListHero.tsx',
  'src/components/assist/ExecutionsListHero.tsx',
  'src/components/assist/TripsListHero.tsx',
  'src/components/assist/TrackingListHero.tsx',
  'src/components/beratung/CasesListHero.tsx',
  'src/components/beratung/CaseDetailHero.tsx',
  'src/components/stationaer/ResidentsListHero.tsx',
  'src/components/stationaer/ResidentDetailHero.tsx',
  'src/components/akademie/CoursesListHero.tsx',
  'src/components/akademie/CourseDetailHero.tsx',
  'src/components/auth/AuthLoginHero.tsx',
];

function migrateScreen(relPath) {
  const filePath = join(root, relPath);
  if (!existsSync(filePath)) {
    console.warn(`  skip (missing): ${relPath}`);
    return false;
  }
  let src = readFileSync(filePath, 'utf8');
  if (!src.includes('ScreenShell')) {
    console.log(`  skip (no ScreenShell): ${relPath}`);
    return false;
  }

  src = src.replace(
    /import \{([^}]*)\} from '@\/components\/layout';/,
    (match, imports) => {
      const parts = imports.split(',').map((s) => s.trim()).filter(Boolean);
      const filtered = parts.filter((p) => p !== 'ScreenShell');
      if (!filtered.includes('CareLightPageShell')) {
        filtered.push('CareLightPageShell');
      }
      return `import { ${filtered.join(', ')} } from '@/components/layout';`;
    },
  );

  // Fallback: add import if layout import didn't have ScreenShell
  if (!src.includes('CareLightPageShell')) {
    src = `import { CareLightPageShell } from '@/components/layout';\n${src}`;
  }

  src = src.replace(/\bScreenShell\b/g, 'CareLightPageShell');

  // Upgrade state components in screens
  src = src.replace(
    /import \{([^}]*)\} from '@\/components\/ui';/g,
    (match, imports) => {
      if (!imports.includes('EmptyState') && !imports.includes('ErrorState') && !imports.includes('LoadingState')) {
        return match;
      }
      const parts = imports.split(',').map((s) => s.trim()).filter(Boolean);
      const add = [];
      if (parts.some((p) => p === 'EmptyState') && !parts.includes('CareLightEmptyState')) {
        parts.splice(parts.indexOf('EmptyState'), 1, 'CareLightEmptyState');
      }
      if (parts.some((p) => p === 'ErrorState') && !parts.includes('CareLightErrorState')) {
        parts.splice(parts.indexOf('ErrorState'), 1, 'CareLightErrorState');
      }
      return `import { ${parts.join(', ')} } from '@/components/ui';`;
    },
  );

  src = src.replace(/\bEmptyState\b/g, 'CareLightEmptyState');
  src = src.replace(/\bErrorState\b/g, 'CareLightErrorState');

  // PremiumButton -> CareLightButton in list screen headers
  if (src.includes('PremiumButton') && (relPath.includes('ListScreen') || relPath.includes('CreateScreen'))) {
    src = src.replace(/\bPremiumButton\b/g, 'CareLightButton');
    if (!src.includes('CareLightButton')) {
      src = src.replace(
        /from '@\/components\/ui';/,
        (m, offset) => {
          const before = src.slice(0, offset);
          const lastImport = before.lastIndexOf("from '@/components/ui'");
          if (lastImport >= 0) return m;
          return m;
        },
      );
    }
    src = src.replace(
      /import \{([^}]*)\} from '@\/components\/ui';/,
      (match, imports) => {
        const parts = imports.split(',').map((s) => s.trim()).filter(Boolean);
        if (!parts.includes('CareLightButton') && parts.includes('PremiumButton')) {
          const idx = parts.indexOf('PremiumButton');
          parts[idx] = 'CareLightButton';
        } else if (!parts.includes('CareLightButton') && match.includes('PremiumButton')) {
          parts.push('CareLightButton');
        }
        return `import { ${parts.join(', ')} } from '@/components/ui';`;
      },
    );
  }

  writeFileSync(filePath, src, 'utf8');
  console.log(`  ✓ screen: ${relPath}`);
  return true;
}

function migrateHero(relPath) {
  const filePath = join(root, relPath);
  if (!existsSync(filePath)) {
    console.warn(`  skip (missing): ${relPath}`);
    return false;
  }
  let src = readFileSync(filePath, 'utf8');
  if (!src.includes('PremiumListHeroFrame') && !src.includes('PremiumKpiCard')) {
    console.log(`  skip (already migrated): ${relPath}`);
    return false;
  }

  // Replace imports
  src = src.replace(/\bPremiumListHeroFrame\b/g, 'CareLightListHeroFrame');
  src = src.replace(/\bPremiumKpiCard\b/g, 'CareLightKpiCard');
  src = src.replace(/\bPremiumButton\b/g, 'CareLightButton');

  // Add careLightColors for light typography
  if (src.includes('useLegacyTheme') && !src.includes('careLightColors')) {
    src = src.replace(
      "import { useLegacyTheme } from '@/design/tokens/themeBridge';",
      "import { careLightColors } from '@/design/tokens/lightTheme';\nimport { careTypography } from '@/design/tokens/typography';",
    );
    // Replace typography references in styles
    src = src.replace(/colors\.cyan/g, 'careLightColors.cyan');
    src = src.replace(/colors\.orange/g, 'careLightColors.orange');
    src = src.replace(/colors\.textMuted/g, 'careLightColors.muted');
    src = src.replace(/\.\.\.typography\.h2/g, '...careTypography.h2, color: careLightColors.navy');
    src = src.replace(/\.\.\.typography\.caption/g, '...careTypography.caption');
    // Remove useLegacyTheme hook usage if only used for styles
    src = src.replace(
      /const \{ colors, typography, gradients, mode \} = useLegacyTheme\(\);\s*const styles = useMemo\(\s*\(\) =>/,
      'const styles = useMemo(\n    () =>',
    );
    src = src.replace(/\[colors, typography, gradients\]/g, '[]');
  }

  writeFileSync(filePath, src, 'utf8');
  console.log(`  ✓ hero: ${relPath}`);
  return true;
}

console.log('CareLight Phase 2 migration\n');
console.log('Screens:');
let screenCount = 0;
for (const rel of PRIORITY_SCREENS) {
  if (migrateScreen(rel)) screenCount++;
}
console.log(`\nHeroes:`);
let heroCount = 0;
for (const rel of PRIORITY_HEROES) {
  if (migrateHero(rel)) heroCount++;
}
console.log(`\nDone: ${screenCount} screens, ${heroCount} heroes`);
