#!/usr/bin/env node
/**
 * Responsive layout audit — adaptive shells, hooks, and components.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_FILES = [
  'src/design/tokens/breakpoints.ts',
  'src/hooks/useDeviceClass.ts',
  'src/hooks/usePlatformLayout.ts',
  'src/hooks/useResponsiveValue.ts',
  'src/hooks/platform/useDeviceClass.ts',
  'src/hooks/platform/usePlatformLayout.ts',
  'src/components/layout/CareAdaptiveShell.tsx',
  'src/components/layout/CareMobileShell.tsx',
  'src/components/layout/CareTabletShell.tsx',
  'src/components/layout/CareDesktopShell.tsx',
  'src/components/layout/CareWebShell.tsx',
  'src/components/layout/MobileShell.tsx',
  'src/components/layout/TabletShell.tsx',
  'src/components/layout/DesktopShell.tsx',
  'src/components/adaptive/AdaptiveKpiGrid.tsx',
  'src/components/adaptive/AdaptiveListDetail.tsx',
  'src/components/layout/ShellLayout.tsx',
  'src/components/layout/MasterDetailLayout.tsx',
];

const MODULE_SHELL_LAYOUTS = [
  'app/assist/(tabs)/_layout.tsx',
  'app/pflege/(tabs)/_layout.tsx',
  'app/beratung/(tabs)/_layout.tsx',
  'app/stationaer/(tabs)/_layout.tsx',
  'app/akademie/(tabs)/_layout.tsx',
  'app/office/(tabs)/_layout.tsx',
  'app/insight/_layout.tsx',
  'app/business/office/qm/_layout.tsx',
];

const MASTER_DETAIL_SCREENS = [
  'src/screens/office/ClientsAdaptiveScreen.tsx',
  'src/screens/office/EmployeesAdaptiveScreen.tsx',
  'src/screens/communication/CommunicationAdaptiveScreen.tsx',
  'src/screens/office/OfficeMessagesAdaptiveScreen.tsx',
];

const BREAKPOINT_MARKERS = ['phone', 'tablet', 'desktop', 'wide', '768', '1024', '1440'];

function fail(message) {
  console.error(`\n✗ responsive:audit fehlgeschlagen: ${message}\n`);
  process.exit(1);
}

console.log('CareSuite+ responsive:audit\n');

const missing = REQUIRED_FILES.filter((rel) => !existsSync(join(root, rel)));
if (missing.length > 0) {
  fail(`Fehlende Dateien:\n  - ${missing.join('\n  - ')}`);
}

const adaptiveBreakpoints = readFileSync(join(root, 'src/design/tokens/breakpoints.ts'), 'utf8');
for (const marker of BREAKPOINT_MARKERS) {
  if (!adaptiveBreakpoints.includes(marker)) {
    fail(`design/tokens/breakpoints.ts: Marker "${marker}" fehlt`);
  }
}

const platformBreakpoints = readFileSync(join(root, 'src/lib/platform/breakpoints.ts'), 'utf8');
if (!platformBreakpoints.includes('768')) {
  fail('lib/platform/breakpoints.ts: 768px Marker fehlt');
}

const shellLayout = readFileSync(join(root, 'src/components/layout/ShellLayout.tsx'), 'utf8');
if (!shellLayout.includes('CareAdaptiveShell')) {
  fail('ShellLayout delegiert nicht an CareAdaptiveShell');
}

const responsiveLayout = readFileSync(join(root, 'src/components/layout/ResponsiveLayout.tsx'), 'utf8');
if (!responsiveLayout.includes('CareAdaptiveShell')) {
  fail('ResponsiveLayout delegiert nicht an CareAdaptiveShell');
}

const adaptiveShell = readFileSync(join(root, 'src/components/layout/CareAdaptiveShell.tsx'), 'utf8');
for (const shell of ['CareMobileShell', 'CareTabletShell', 'CareDesktopShell', 'CareWebShell']) {
  if (!adaptiveShell.includes(shell)) {
    fail(`CareAdaptiveShell referenziert ${shell} nicht`);
  }
}

const desktopShell = readFileSync(join(root, 'src/components/layout/DesktopShell.tsx'), 'utf8');
if (desktopShell.includes('AppTabBar')) {
  fail('DesktopShell darf keine Bottom-Tabs (AppTabBar) enthalten');
}

const kpiGrid = readFileSync(join(root, 'src/components/adaptive/AdaptiveKpiGrid.tsx'), 'utf8');
if (!kpiGrid.includes('numberOfLines') && !kpiGrid.includes('kpiColumnsForDeviceClass')) {
  fail('AdaptiveKpiGrid: Spaltenlogik fehlt');
}

const responsiveValue = readFileSync(join(root, 'src/design/tokens/responsiveValue.ts'), 'utf8');
if (!responsiveValue.includes('resolveResponsiveValue') || !responsiveValue.includes('phone')) {
  fail('responsiveValue.ts: Resolver oder phone-Fallback fehlt');
}

const responsiveHook = readFileSync(join(root, 'src/hooks/useResponsiveValue.ts'), 'utf8');
if (!responsiveHook.includes('useResponsiveValue') || !responsiveHook.includes('resolveResponsiveValue')) {
  fail('useResponsiveValue.ts: Hook oder Resolver-Import fehlt');
}

const missingMd = MASTER_DETAIL_SCREENS.filter((rel) => !existsSync(join(root, rel)));
if (missingMd.length > 0) {
  fail(`Master-Detail-Referenzscreens fehlen:\n  - ${missingMd.join('\n  - ')}`);
}

for (const rel of MODULE_SHELL_LAYOUTS) {
  const filePath = join(root, rel);
  if (!existsSync(filePath)) {
    fail(`Modul-Shell-Layout fehlt: ${rel}`);
  }
  const src = readFileSync(filePath, 'utf8');
  if (!src.includes('ShellLayout')) {
    fail(`${rel} nutzt ShellLayout nicht`);
  }
}

console.log(`✓ ${REQUIRED_FILES.length} Shell-/Hook-/Adaptive-Dateien vorhanden`);
console.log('✓ Adaptive + Platform Breakpoints definiert');
console.log('✓ CareAdaptiveShell → Mobile/Tablet/Desktop/Web verdrahtet');
console.log('✓ ShellLayout → CareAdaptiveShell verdrahtet');
console.log('✓ ResponsiveLayout → CareAdaptiveShell (Alias) verdrahtet');
console.log('✓ DesktopShell ohne Bottom-Tabs');
console.log('✓ AdaptiveKpiGrid + AdaptiveListDetail vorhanden');
console.log('✓ useResponsiveValue Hook + Resolver vorhanden');
console.log(`✓ ${MASTER_DETAIL_SCREENS.length} Master-Detail-Referenzscreens`);
console.log(`✓ ${MODULE_SHELL_LAYOUTS.length} Modul-Routen mit CareAdaptiveShell\n`);
