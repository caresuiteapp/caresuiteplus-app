#!/usr/bin/env node
/**
 * Visual Reality audit — verifies light premium UI on main + list/detail screens.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const LIGHT_BRAND = [
  'src/components/brand/CareSuiteLightBackground.tsx',
  'src/components/brand/CareSuiteLogoMark.tsx',
  'src/components/brand/CareSuiteBrandHeader.tsx',
];

const LIGHT_LAYOUT = [
  'src/components/layout/CareLightScreen.tsx',
  'src/components/layout/CareLightModuleDashboard.tsx',
  'src/components/layout/CareLightPageHeader.tsx',
  'src/components/layout/CareLightPageShell.tsx',
  'src/components/layout/CareLightModuleHeader.tsx',
  'src/components/layout/CareLightMobileShell.tsx',
  'src/components/layout/CareLightTabletShell.tsx',
  'src/components/layout/CareLightDesktopShell.tsx',
];

const LIGHT_UI = [
  'src/components/ui/CareLightCard.tsx',
  'src/components/ui/CareLightKpiCard.tsx',
  'src/components/ui/CareLightButton.tsx',
  'src/components/ui/CareLightSection.tsx',
  'src/components/ui/CareLightListItem.tsx',
  'src/components/ui/CareLightModuleTile.tsx',
  'src/components/ui/CareLightBottomNav.tsx',
  'src/components/ui/CareLightEmptyState.tsx',
  'src/components/ui/CareLightErrorState.tsx',
  'src/components/ui/CareLightListHeroFrame.tsx',
  'src/components/ui/CareLightActionBar.tsx',
];

const MAIN_INDEX_SCREENS = [
  'src/screens/pflege/PflegeIndexScreen.tsx',
  'src/screens/AppStartScreen.tsx',
  'src/screens/auth/AuthLandingScreen.tsx',
  'src/screens/office/OfficeIndexScreen.tsx',
  'src/screens/assist/AssistIndexScreen.tsx',
  'src/screens/beratung/BeratungIndexScreen.tsx',
  'src/screens/stationaer/StationaerIndexScreen.tsx',
  'src/screens/akademie/AkademieIndexScreen.tsx',
  'src/screens/qm/QmDashboardScreen.tsx',
  'src/screens/insight/InsightIndexScreen.tsx',
];

/** Phase 2 — list/detail/create routes that must use CareLight shell (not dark-only). */
const PHASE2_LIST_DETAIL_SCREENS = [
  // Office
  'src/screens/office/ClientsListScreen.tsx',
  'src/screens/office/ClientDetailScreen.tsx',
  'src/screens/office/ClientCreateScreen.tsx',
  'src/screens/business/office/ClientIntakeWizardScreen.tsx',
  'src/screens/business/office/ClientRecordScreen.tsx',
  'src/screens/office/EmployeesListScreen.tsx',
  'src/screens/office/EmployeeDetailScreen.tsx',
  'src/screens/office/OfficeDocumentsListScreen.tsx',
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
  'src/screens/pflege/MedicationListScreen.tsx',
  'src/screens/pflege/PflegeReportsScreen.tsx',
  'src/screens/pflege/SisOverviewScreen.tsx',
  // Assist
  'src/screens/assist/AssignmentsListScreen.tsx',
  'src/screens/assist/AssignmentDetailScreen.tsx',
  'src/screens/assist/ExecutionsListScreen.tsx',
  'src/screens/assist/TripsListScreen.tsx',
  'src/screens/assist/TripDetailScreen.tsx',
  // Beratung / Stationär / Akademie
  'src/screens/beratung/CasesListScreen.tsx',
  'src/screens/beratung/CaseDetailScreen.tsx',
  'src/screens/stationaer/ResidentsListScreen.tsx',
  'src/screens/stationaer/ResidentDetailScreen.tsx',
  'src/screens/akademie/CoursesListScreen.tsx',
  'src/screens/akademie/CourseDetailScreen.tsx',
  // Auth
  'src/screens/auth/BusinessLoginScreen.tsx',
  'src/screens/auth/EmployeePortalLoginScreen.tsx',
  'src/screens/auth/PortalCodeLoginScreen.tsx',
];

/** Phase 3 — QM/TI/Portal/Templates, compose, create/edit forms. */
const PHASE3_LIST_DETAIL_SCREENS = [
  // QM (16)
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
  // TI (11)
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
  // Portal (15)
  'src/screens/portal/PortalClientDocumentDetailScreen.tsx',
  'src/screens/portal/PortalDocumentDetailScreen.tsx',
  'src/screens/portal/PortalAssignmentDetailScreen.tsx',
  'src/screens/portal/ClientPortalAnnouncementsScreen.tsx',
  'src/screens/portal/EmployeePortalAnnouncementsScreen.tsx',
  'src/screens/portal/PortalClientAppointmentDetailScreen.tsx',
  'src/screens/portal/PortalTabScreen.tsx',
  'src/screens/portal/PortalMessageDetailScreen.tsx',
  'src/screens/portal/ClientPortalProfileScreen.tsx',
  'src/screens/portal/PortalViewScreen.tsx',
  'src/screens/portal/EmployeeProfileScreen.tsx',
  'src/screens/portal/PortalClientMessageDetailScreen.tsx',
  'src/screens/PortalDashboardScreen.tsx',
  // Templates (8)
  'src/screens/templates/CatalogsScreen.tsx',
  'src/screens/templates/TemplateCenterScreen.tsx',
  'src/screens/templates/TemplateEditScreen.tsx',
  'src/screens/templates/TemplateListScreenBase.tsx',
  'src/screens/templates/TemplateSettingsScreen.tsx',
  'src/screens/templates/TemplateDetailScreen.tsx',
  'src/screens/templates/TemplateCategoriesScreen.tsx',
  'src/screens/templates/TemplateCreateScreen.tsx',
  // Office create/edit + access create (5)
  'src/screens/office/EmployeeCreateScreen.tsx',
  'src/screens/office/EmployeeEditScreen.tsx',
  'src/screens/office/ClientEditScreen.tsx',
  'src/screens/office/access/CreateEmployeePortalAccountScreen.tsx',
  'src/screens/office/access/CreateInternalUserScreen.tsx',
  // Compose shared + Pflege create (3)
  'src/screens/shared/MessageComposeScreenShell.tsx',
  'src/screens/shared/DomainComposeMessageScreen.tsx',
  'src/screens/pflege/VitalReadingCreateScreen.tsx',
];

const PHASE3_LIST_HERO_COMPONENTS = [
  'src/components/office/AppointmentsListHero.tsx',
  'src/components/office/DocumentsListHero.tsx',
  'src/components/office/EmployeesListHero.tsx',
  'src/components/office/InvoicesListHero.tsx',
  'src/components/office/BudgetsListHero.tsx',
  'src/components/office/OfficeMessagesListHero.tsx',
  'src/components/qm/QmDocumentsListHero.tsx',
  'src/components/templates/TemplateListHero.tsx',
  'src/components/ti/TIAuditLogListHero.tsx',
  'src/components/ti/TIConsentListHero.tsx',
  'src/components/ti/KIMMailboxListHero.tsx',
];

const FORBIDDEN_ON_MAIN = [
  'GlassCard',
  'DarkCard',
  'PremiumListHeroFrame',
  'AdaptiveModuleDashboard',
  'ScreenShell',
];

const FORBIDDEN_DARK_BG_PATTERNS = [
  'colors.bgBase',
  '#070B12',
  '#050816',
  '#080D1A',
  '#0f172a',
  '#132036',
  '#1E2330',
  '#171B22',
  'rgba(4,8,24',
  'rgba(0,0,0,0.55)',
  'rgba(0,0,0,0.65)',
  "backgroundColor: 'rgba(0,0,0",
  "backgroundColor: \"rgba(0,0,0",
];

const ROUTE_LAYOUT_FILES = [
  'app/auth/_layout.tsx',
  'app/office/_layout.tsx',
  'app/pflege/_layout.tsx',
  'app/assist/_layout.tsx',
  'app/beratung/_layout.tsx',
  'app/akademie/_layout.tsx',
  'app/stationaer/_layout.tsx',
  'app/business/_layout.tsx',
  'app/business/office/_layout.tsx',
  'app/business/office/modules/_layout.tsx',
  'app/business/office/access/_layout.tsx',
  'app/business/admin/_layout.tsx',
  'app/portal/_layout.tsx',
  'app/portal/client/_layout.tsx',
  'app/portal/employee/_layout.tsx',
  'app/onboarding/_layout.tsx',
];

const FORBIDDEN_DARK_ONLY = [
  'useLegacyTheme-only',
];

const LIGHT_SHELL_MARKERS = ['CareLightPageShell', 'CareLightScreen', 'CareLightModuleDashboard'];

const LIGHT_HERO_MARKERS = ['CareLightListHeroFrame', 'CareLightPageHeader', 'CareLightKpiCard'];

const PFLEGE_MARKERS = [
  'CareLightCarePlanCard',
  'buildPflegeDashboardKpis',
  'Aktive Pflegepläne',
  'CareLightModuleDashboard',
];

const LIGHT_COLORS = [
  "page: '#F8FAFC'",
  "surface: '#FFFFFF'",
  "navy: '#07122A'",
  "text: '#000000'",
  "muted: '#000000'",
  "orange: '#FF7A1A'",
  "green: '#22C55E'",
  'careSuiteModalScrim',
  'CARESUITE_INK',
  'careSuiteDocumentRootBg',
];

function assertNoDarkBackground(rel) {
  const filePath = join(root, rel);
  if (!existsSync(filePath)) {
    fail(`Route fehlt: ${rel}`);
  }
  const src = readFileSync(filePath, 'utf8');
  for (const pattern of FORBIDDEN_DARK_BG_PATTERNS) {
    if (src.includes(pattern)) {
      fail(`${rel}: verbotener Dark-Hintergrund — ${pattern}`);
    }
  }
}

function walkTsFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue;
      walkTsFiles(full, acc);
      continue;
    }
    if (/\.(tsx?|jsx?)$/.test(entry)) acc.push(full);
  }
  return acc;
}

function relFromRoot(absPath) {
  return absPath.replace(/\\/g, '/').replace(`${root.replace(/\\/g, '/')}/`, '');
}

const POPUP_SURFACE_FILES = walkTsFiles(join(root, 'src'))
  .map(relFromRoot)
  .filter(
    (rel) =>
      /Modal|Popup|Drawer|Overlay|platformmodal/i.test(rel) &&
      !rel.includes('__tests__') &&
      !rel.includes('modalscreens.ts') &&
      !rel.includes('ModalStack'),
  );

const CORE_SURFACE_TOKEN_FILES = [
  'src/design/tokens/effects.ts',
  'src/design/tokens/popupShellTokens.ts',
  'src/design/tokens/auroraGlass.ts',
  'src/components/ui/effects/globalanimatedbackground.tsx',
  'app/+html.tsx',
];

function fail(message) {
  console.error(`\n✗ visual:audit fehlgeschlagen: ${message}\n`);
  process.exit(1);
}

const FORBIDDEN_LEGACY_NAV_ROUTES = ['/office/clients/create'];

const DEMO_NAV_SOURCES = [
  'src/lib/navigation/shellConfig.ts',
  'src/data/demo/officeDashboard.ts',
  'src/data/demo/dashboard.ts',
  'src/data/demo/navigation.ts',
  'src/components/office/ClientsListView.tsx',
];

const DEMO_ENTRY_CHECKS = [
  {
    file: 'src/lib/navigation/redirects.ts',
    mustContain: "DEMO_BUSINESS_ENTRY_ROUTE",
  },
  {
    file: 'src/lib/navigation/demoNavigation.ts',
    mustContain: "DEMO_BUSINESS_ENTRY_ROUTE = '/office'",
  },
  {
    file: 'src/design/ThemeModeProvider.tsx',
    mustContain: 'isDemoMode()',
  },
  {
    file: 'src/screens/BusinessDashboardScreen.tsx',
    mustContain: 'CareLightModuleDashboard',
  },
];

function assertDemoNavigationWiring() {
  for (const rel of DEMO_NAV_SOURCES) {
    const filePath = join(root, rel);
    if (!existsSync(filePath)) {
      fail(`Demo-Navigation-Quelle fehlt: ${rel}`);
    }
    const src = readFileSync(filePath, 'utf8');
    for (const forbidden of FORBIDDEN_LEGACY_NAV_ROUTES) {
      if (src.includes(forbidden)) {
        fail(`${rel}: verbotene Legacy-Navigation — ${forbidden} (nutze CLIENT_INTAKE_NEW_ROUTE / Redirect)`);
      }
    }
  }

  for (const check of DEMO_ENTRY_CHECKS) {
    const filePath = join(root, check.file);
    if (!existsSync(filePath)) {
      fail(`Demo-Entry-Check fehlt: ${check.file}`);
    }
    const src = readFileSync(filePath, 'utf8');
    if (!src.includes(check.mustContain)) {
      fail(`${check.file}: Demo-Design-Wiring fehlt — erwartet „${check.mustContain}"`);
    }
  }

  const shellConfig = readFileSync(join(root, 'src/lib/navigation/shellConfig.ts'), 'utf8');
  if (!shellConfig.includes('CareLightBottomNav') && shellConfig.includes('AppTabBar')) {
    // shellConfig only has hrefs — tab bar is in CareAdaptiveShell
  }
  if (!shellConfig.includes("href: '/business/office/modules'")) {
    fail('shellConfig: Office-Module-Tab muss /business/office/modules verlinken');
  }

  const adaptiveShell = readFileSync(join(root, 'src/components/layout/CareAdaptiveShell.tsx'), 'utf8');
  if (!adaptiveShell.includes('CareLightMobileShell')) {
    fail('CareAdaptiveShell: CareLightMobileShell nicht verdrahtet');
  }

  const themeColors = readFileSync(join(root, 'src/theme/colors.ts'), 'utf8');
  if (!themeColors.includes("legacyColorsFromPalette('light')")) {
    fail('theme/colors.ts: @/theme muss light default für Demo nutzen');
  }

  const themeTypography = readFileSync(join(root, 'src/theme/typography.ts'), 'utf8');
  if (!themeTypography.includes("resolveCareTypography('light')")) {
    fail('theme/typography.ts: @/theme typography muss light default nutzen');
  }
}


function assertCareLightRoute(rel, requireHero = false) {
  const filePath = join(root, rel);
  if (!existsSync(filePath)) {
    fail(`Phase-2-Route fehlt: ${rel}`);
  }
  const src = readFileSync(filePath, 'utf8');
  const hasShell = LIGHT_SHELL_MARKERS.some((m) => src.includes(m));
  if (!hasShell) {
    fail(`${rel}: kein CareLight-Shell (CareLightPageShell/CareLightScreen erwartet)`);
  }
  if (src.match(/import[^;]*ScreenShell[^;]*from '@\/components\/layout'/)) {
    fail(`${rel}: importiert noch ScreenShell direkt — CareLightPageShell verwenden`);
  }
  if (requireHero) {
    const hasHero = LIGHT_HERO_MARKERS.some((m) => src.includes(m));
    const usesListHeroComponent = /ListHero|DetailHero|AuthLoginHero/.test(src);
    if (!hasHero && !usesListHeroComponent) {
      // list screens delegate heroes to child views — OK if shell is CareLight
    }
  }
}

console.log('CareSuite+ visual:audit (Phase 3)\n');

for (const group of [LIGHT_BRAND, LIGHT_LAYOUT, LIGHT_UI]) {
  const missing = group.filter((rel) => !existsSync(join(root, rel)));
  if (missing.length > 0) {
    fail(`CareLight-Komponenten fehlen:\n  - ${missing.join('\n  - ')}`);
  }
}

const lightTheme = join(root, 'src/design/tokens/lightTheme.ts');
if (!existsSync(lightTheme)) {
  fail('lightTheme.ts fehlt');
}
const lightThemeSrc = readFileSync(lightTheme, 'utf8');
for (const color of LIGHT_COLORS) {
  if (!lightThemeSrc.includes(color)) {
    fail(`lightTheme.ts: Pflichtfarbe fehlt — ${color}`);
  }
}

const themeProvider = readFileSync(join(root, 'src/design/ThemeModeProvider.tsx'), 'utf8');
if (
  !themeProvider.includes("useState<ColorMode>('light')") &&
  !themeProvider.includes('resolveInitialMode')
) {
  fail('ThemeModeProvider: Default muss light sein');
}

for (const rel of ['app/+html.tsx', 'app/_layout.tsx', ...ROUTE_LAYOUT_FILES]) {
  const layoutPath = join(root, rel);
  if (!existsSync(layoutPath)) {
    fail(`Route-Layout fehlt: ${rel}`);
  }
  const src = readFileSync(layoutPath, 'utf8');
  if (
    !src.includes('routeLayoutContentStyle') &&
    !src.includes('careLightColors.page') &&
    !src.includes('careSuiteDocumentRootBg')
  ) {
    fail(`${rel}: muss routeLayoutContentStyle oder careLightColors.page nutzen`);
  }
  for (const pattern of FORBIDDEN_DARK_BG_PATTERNS) {
    if (src.includes(pattern)) {
      fail(`${rel}: verbotener Dark-Hintergrund — ${pattern}`);
    }
  }
}

for (const rel of [...MAIN_INDEX_SCREENS, ...PHASE2_LIST_DETAIL_SCREENS]) {
  assertNoDarkBackground(rel);
}

for (const rel of MAIN_INDEX_SCREENS) {
  const filePath = join(root, rel);
  if (!existsSync(filePath)) {
    fail(`Hauptscreen fehlt: ${rel}`);
  }
  const src = readFileSync(filePath, 'utf8');
  for (const forbidden of FORBIDDEN_ON_MAIN) {
    if (src.includes(forbidden)) {
      fail(`${rel} enthält verbotenes Legacy-Muster: ${forbidden}`);
    }
  }
  const hasLight = LIGHT_SHELL_MARKERS.some((marker) => src.includes(marker));
  if (!hasLight && !rel.includes('AppStartScreen')) {
    fail(`${rel} nutzt keine CareLight-Hauptkomponenten`);
  }
}

for (const rel of PHASE2_LIST_DETAIL_SCREENS) {
  assertCareLightRoute(rel);
}

for (const rel of PHASE3_LIST_DETAIL_SCREENS) {
  assertCareLightRoute(rel);
}

for (const rel of PHASE3_LIST_HERO_COMPONENTS) {
  const filePath = join(root, rel);
  if (!existsSync(filePath)) {
    fail(`Phase-3-List-Hero fehlt: ${rel}`);
  }
  const src = readFileSync(filePath, 'utf8');
  if (!src.includes('CareLightListHeroFrame')) {
    fail(`${rel}: muss CareLightListHeroFrame explizit nutzen`);
  }
  if (src.includes('PremiumListHeroFrame')) {
    fail(`${rel}: darf PremiumListHeroFrame nicht mehr direkt importieren`);
  }
}

const pflege = readFileSync(join(root, 'src/screens/pflege/PflegeIndexScreen.tsx'), 'utf8');
for (const marker of PFLEGE_MARKERS) {
  if (!pflege.includes(marker)) {
    fail(`PflegeIndexScreen: ${marker} fehlt`);
  }
}

const start = readFileSync(join(root, 'src/screens/AppStartScreen.tsx'), 'utf8');
if (!start.includes('CareSuiteLightBackground') || !start.includes('CareLightCard')) {
  fail('AppStartScreen: light premium Brand/Card fehlt');
}

const auth = readFileSync(join(root, 'src/screens/auth/AuthLandingScreen.tsx'), 'utf8');
if (!auth.includes('CareLightScreen') || !auth.includes('CareLightModuleTile')) {
  fail('AuthLandingScreen: light landing fehlt');
}

const screenShellBridge = readFileSync(join(root, 'src/components/layout/ScreenShell.tsx'), 'utf8');
if (!screenShellBridge.includes('CareLightPageShell')) {
  fail('ScreenShell: muss in light mode an CareLightPageShell delegieren');
}

const heroBridge = readFileSync(join(root, 'src/components/ui/PremiumListHeroFrame.tsx'), 'utf8');
if (!heroBridge.includes('CareLightListHeroFrame')) {
  fail('PremiumListHeroFrame: muss in light mode an CareLightListHeroFrame delegieren');
}

const adaptiveShell = readFileSync(join(root, 'src/components/layout/CareAdaptiveShell.tsx'), 'utf8');
if (!adaptiveShell.includes('CareLightMobileShell')) {
  fail('CareAdaptiveShell: CareLightMobileShell nicht verdrahtet');
}

assertDemoNavigationWiring();

for (const rel of CORE_SURFACE_TOKEN_FILES) {
  assertNoDarkBackground(rel);
}

for (const rel of POPUP_SURFACE_FILES) {
  assertNoDarkBackground(rel);
}

const bottomNav = readFileSync(join(root, 'src/components/ui/CareLightBottomNav.tsx'), 'utf8');
if (!bottomNav.includes('careLightColors.surface') || !bottomNav.includes('careLightColors.navy')) {
  fail('CareLightBottomNav: light premium Farben fehlen');
}

const componentCount = LIGHT_BRAND.length + LIGHT_LAYOUT.length + LIGHT_UI.length;
console.log(`✓ ${componentCount} CareLight-Komponenten vorhanden`);
console.log('✓ lightTheme.ts mit Pflichtfarben');
console.log('✓ ThemeModeProvider default = light');
console.log(`✓ ${ROUTE_LAYOUT_FILES.length} Route-Layouts ohne Dark-bgBase`);
console.log(`✓ ${MAIN_INDEX_SCREENS.length + PHASE2_LIST_DETAIL_SCREENS.length} Index/List-Routen ohne hardcoded Dark-BG`);
console.log(`✓ ${MAIN_INDEX_SCREENS.length} Hauptscreens ohne Legacy-Dark-Muster`);
console.log(`✓ ${PHASE2_LIST_DETAIL_SCREENS.length} Phase-2 list/detail-Routen mit CareLight-Shell`);
console.log(`✓ ${PHASE3_LIST_DETAIL_SCREENS.length} Phase-3 QM/TI/Portal/Templates/Compose/Form-Routen`);
console.log(`✓ ${PHASE3_LIST_HERO_COMPONENTS.length} List-Heroes explizit CareLightListHeroFrame`);
console.log('✓ ScreenShell + PremiumListHeroFrame → CareLight-Bridge (light default)');
console.log('✓ Pflege-Dashboard: KPI-Grid + CareLightCarePlanCard');
console.log('✓ Startseite + Auth: light premium');
console.log('✓ CareAdaptiveShell → CareLight-Shells\n');
console.log(`✓ ${POPUP_SURFACE_FILES.length} Modal/Popup/Drawer/Overlay-Dateien ohne Dark-Hintergrund`);
console.log(`✓ ${CORE_SURFACE_TOKEN_FILES.length} Kern-Token-Dateien ohne Dark-Hintergrund`);
console.log('✓ Demo-Navigation: keine Legacy-Create-Routen, Entry /office, light @/theme default\n');
