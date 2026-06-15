#!/usr/bin/env node
/**
 * Adaptive Design System audit — tokens, brand components, assets, start page.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const TOKEN_FILES = [
  'src/design/tokens/colors.ts',
  'src/design/tokens/typography.ts',
  'src/design/tokens/spacing.ts',
  'src/design/tokens/radius.ts',
  'src/design/tokens/effects.ts',
  'src/design/tokens/breakpoints.ts',
  'src/design/tokens/modules.ts',
  'src/design/tokens/index.ts',
];

const BRAND_COMPONENTS = [
  'src/components/brand/CareSuiteLogo.tsx',
  'src/components/brand/CareSuiteWordmark.tsx',
  'src/components/brand/CareSuiteHeader.tsx',
  'src/components/brand/CareSuiteModuleHeader.tsx',
  'src/components/brand/CareSuiteBackground.tsx',
  'src/components/brand/CareSuiteIcon.tsx',
  'src/components/brand/CareBotCard.tsx',
  'src/components/brand/VoiceFlowPanel.tsx',
  'src/components/brand/PlanPilotPanel.tsx',
];

const ASSET_FILES = [
  'assets/icon.png',
  'assets/splash-icon.png',
  'assets/favicon.png',
  'assets/android-icon-foreground.png',
  'assets/android-icon-background.png',
  'assets/android-icon-monochrome.png',
];

const WP_FORBIDDEN_ON_START = ['WP ', 'WP-', 'Arbeitspaket', 'work package'];

const CRITICAL_SCREENS = [
  {
    path: 'src/screens/office/OfficeIndexScreen.tsx',
    markers: ['CareLightModuleDashboard'],
  },
  {
    path: 'src/screens/pflege/PflegeIndexScreen.tsx',
    markers: ['CareLightModuleDashboard'],
  },
  {
    path: 'src/screens/assist/AssistIndexScreen.tsx',
    markers: ['CareLightModuleDashboard'],
  },
  {
    path: 'src/screens/beratung/BeratungIndexScreen.tsx',
    markers: ['CareLightModuleDashboard'],
  },
  {
    path: 'src/screens/stationaer/StationaerIndexScreen.tsx',
    markers: ['CareLightModuleDashboard'],
  },
  {
    path: 'src/screens/akademie/AkademieIndexScreen.tsx',
    markers: ['CareLightModuleDashboard'],
  },
  {
    path: 'src/screens/qm/QmDashboardScreen.tsx',
    markers: ['CareLightModuleDashboard'],
  },
  {
    path: 'src/screens/insight/InsightIndexScreen.tsx',
    markers: ['CareLightModuleDashboard'],
  },
  {
    path: 'src/components/layout/ShellLayout.tsx',
    markers: ['CareAdaptiveShell'],
  },
  {
    path: 'src/components/adaptive/AdaptiveModuleDashboard.tsx',
    markers: ['PlanPilotPanel', 'useLegacyTheme'],
  },
];

const OFFICE_LIST_VIEWS = [
  'src/components/office/ClientsListView.tsx',
  'src/components/office/EmployeesListView.tsx',
  'src/components/office/DocumentsListView.tsx',
  'src/components/office/InvoicesListView.tsx',
  'src/components/office/AppointmentsListView.tsx',
  'src/components/office/OfficeMessagesListView.tsx',
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

function fail(message) {
  console.error(`\n✗ design:audit fehlgeschlagen: ${message}\n`);
  process.exit(1);
}

console.log('CareSuite+ design:audit\n');

const missingTokens = TOKEN_FILES.filter((rel) => !existsSync(join(root, rel)));
if (missingTokens.length > 0) {
  fail(`Design-Tokens fehlen:\n  - ${missingTokens.join('\n  - ')}`);
}

const colors = readFileSync(join(root, 'src/design/tokens/colors.ts'), 'utf8');
if (!colors.includes('careSuiteColors')) {
  fail('colors.ts: careSuiteColors fehlt');
}
if (!colors.includes('light') || !colors.includes('dark')) {
  fail('colors.ts: Light- und Dark-Palette fehlen');
}

const modules = readFileSync(join(root, 'src/design/tokens/modules.ts'), 'utf8');
for (const key of ['office', 'assist', 'pflege', 'beratung', 'stationaer', 'akademie', 'qm', 'insight']) {
  if (!modules.includes(key)) {
    fail(`modules.ts: Modulfarbe "${key}" fehlt`);
  }
}

const missingBrand = BRAND_COMPONENTS.filter((rel) => !existsSync(join(root, rel)));
if (missingBrand.length > 0) {
  fail(`Brand-Komponenten fehlen:\n  - ${missingBrand.join('\n  - ')}`);
}

const startScreen = readFileSync(join(root, 'src/screens/AppStartScreen.tsx'), 'utf8');
for (const forbidden of WP_FORBIDDEN_ON_START) {
  if (startScreen.includes(forbidden)) {
    fail(`AppStartScreen enthält WP-Text: "${forbidden}"`);
  }
}
if (!startScreen.includes('CareSuiteWordmark') && !startScreen.includes('CareSuiteLightBackground')) {
  fail('AppStartScreen nutzt keine Care-Brand-Komponenten');
}
if (!startScreen.includes('CareAdaptiveShell') && !startScreen.includes('CareSuiteLogo')) {
  fail('AppStartScreen: CareAdaptiveShell oder CareSuiteLogo fehlt');
}

const themeProvider = join(root, 'src/design/ThemeModeProvider.tsx');
if (!existsSync(themeProvider)) {
  fail('ThemeModeProvider fehlt');
}
const themeProviderSrc = readFileSync(themeProvider, 'utf8');
if (!themeProviderSrc.includes('AsyncStorage')) {
  fail('ThemeModeProvider: Persistenz fehlt');
}

const shellLayout = readFileSync(join(root, 'src/components/layout/ShellLayout.tsx'), 'utf8');
if (!shellLayout.includes('CareAdaptiveShell')) {
  fail('ShellLayout nutzt CareAdaptiveShell nicht');
}

const themeBridge = join(root, 'src/design/tokens/themeBridge.ts');
if (!existsSync(themeBridge)) {
  fail('themeBridge.ts fehlt — Legacy @/theme nicht an Tokens angebunden');
}
const themeBridgeSrc = readFileSync(themeBridge, 'utf8');
if (!themeBridgeSrc.includes('useLegacyTheme')) {
  fail('themeBridge.ts: useLegacyTheme Hook fehlt');
}
if (!themeBridgeSrc.includes('resolveLegacyGradients')) {
  fail('themeBridge.ts: resolveLegacyGradients fehlt');
}
if (!themeBridgeSrc.includes('PlanPilotPanel') && !themeBridgeSrc.includes('planPilotRoutes')) {
  fail('themeBridge.ts: planPilotRoutes fehlen');
}

for (const screen of CRITICAL_SCREENS) {
  const filePath = join(root, screen.path);
  if (!existsSync(filePath)) {
    fail(`Kritischer Screen fehlt: ${screen.path}`);
  }
  const src = readFileSync(filePath, 'utf8');
  for (const marker of screen.markers) {
    if (!src.includes(marker)) {
      fail(`${screen.path} nutzt ${marker} nicht`);
    }
  }
}

for (const rel of OFFICE_LIST_VIEWS) {
  const filePath = join(root, rel);
  if (!existsSync(filePath)) {
    fail(`Office-Listenansicht fehlt: ${rel}`);
  }
  const src = readFileSync(filePath, 'utf8');
  if (!src.includes('AdaptiveActionBar')) {
    fail(`${rel} nutzt AdaptiveActionBar nicht`);
  }
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

const missingAssets = ASSET_FILES.filter((rel) => !existsSync(join(root, rel)));
if (missingAssets.length > 0) {
  fail(`Store-Assets fehlen:\n  - ${missingAssets.join('\n  - ')}`);
}

console.log(`✓ ${TOKEN_FILES.length} Design-Token-Dateien vorhanden`);
console.log('✓ careSuiteColors Light + Dark definiert');
console.log('✓ Modulfarben vollständig');
console.log(`✓ ${BRAND_COMPONENTS.length} Brand-Komponenten vorhanden`);
console.log('✓ Startseite ohne WP-Texte, mit Brand-Komponenten');
console.log('✓ ThemeModeProvider + ShellLayout → CareAdaptiveShell verdrahtet');
console.log(`✓ ${CRITICAL_SCREENS.length} kritische Screens mit Care-Komponenten`);
console.log('✓ themeBridge: useLegacyTheme + resolveLegacyGradients + planPilotRoutes');
console.log(`✓ ${OFFICE_LIST_VIEWS.length} Office-Listen mit AdaptiveActionBar`);
console.log(`✓ ${MODULE_SHELL_LAYOUTS.length} Modul-Routen mit CareAdaptiveShell`);
console.log(`✓ ${ASSET_FILES.length} Store-Assets vorhanden\n`);
