import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildPflegeDashboardKpis } from '@/lib/pflege/pflegeDashboardStats';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Visual Reality — light premium main screens', () => {
  it('ThemeModeProvider defaults to light for demo view', () => {
    const src = readSrc('src/design/ThemeModeProvider.tsx');
    expect(src).toContain("useState<ColorMode>('light')");
  });

  it('PflegeIndexScreen uses CareLight dashboard without legacy dark heroes', () => {
    const screen = readSrc('src/screens/pflege/PflegeIndexScreen.tsx');
    expect(screen).toContain('CareLightScreen');
    expect(screen).toContain('CareLightModuleDashboard');
    expect(screen).toContain('CareLightCarePlanCard');
    expect(screen).toContain('buildPflegeDashboardKpis');
    expect(screen).not.toContain('AdaptiveModuleDashboard');
    expect(screen).not.toContain('PremiumListHeroFrame');
    expect(screen).not.toContain('ScreenShell');
  });

  it('buildPflegeDashboardKpis exposes mandated KPI labels', () => {
    const kpis = buildPflegeDashboardKpis({
      totalPlans: 8,
      activePlansCount: 5,
      dueVitalsCount: 2,
      alertsCount: 1,
    }, 'light');
    expect(kpis.find((k) => k.id === 'active-plans')?.label).toBe('Aktive Pflegepläne');
    expect(kpis.find((k) => k.id === 'due-vitals')?.label).toBe('Fällige Vitalwerte');
    expect(kpis.find((k) => k.id === 'open-reports')?.label).toBe('Offene Berichte');
    expect(kpis.find((k) => k.id === 'alerts')?.label).toBe('Hinweise / Risiken');
  });

  it('AppStartScreen uses aurora dark shell and glass portal cards', () => {
    const screen = readSrc('src/screens/AppStartScreen.tsx');
    expect(screen).toContain('AppScreen');
    expect(screen).toContain('PortalCard');
    expect(screen).not.toContain('CareSuiteLightBackground');
    expect(screen).not.toContain('CareLightCard');
  });

  it('AuthLandingScreen is light premium landing', () => {
    const screen = readSrc('src/screens/auth/AuthLandingScreen.tsx');
    expect(screen).toContain('CareLightScreen');
    expect(screen).toContain('CareLightModuleTile');
    expect(screen).not.toContain('ScreenShell');
  });

  const moduleScreens = [
    'src/screens/office/OfficeIndexScreen.tsx',
    'src/screens/assist/AssistIndexScreen.tsx',
    'src/screens/beratung/BeratungIndexScreen.tsx',
    'src/screens/stationaer/StationaerIndexScreen.tsx',
    'src/screens/akademie/AkademieIndexScreen.tsx',
    'src/screens/insight/InsightIndexScreen.tsx',
    'src/screens/qm/QmDashboardScreen.tsx',
  ];

  it.each(moduleScreens)('%s has no legacy dark dashboard shell', (relPath) => {
    const screen = readSrc(relPath);
    expect(screen).toContain('CareLightScreen');
    expect(screen).toContain('CareLightModuleDashboard');
    expect(screen).not.toContain('AdaptiveModuleDashboard');
    expect(screen).not.toContain('PremiumListHeroFrame');
    expect(screen).not.toContain('ScreenShell');
  });

  it('CareLightBottomNav uses light surface and navy text', () => {
    const nav = readSrc('src/components/ui/CareLightBottomNav.tsx');
    expect(nav).toContain('careLightColors.surface');
    expect(nav).toContain('careLightColors.navy');
  });

  it('ScreenShell delegates to CareLightPageShell in light mode', () => {
    const shell = readSrc('src/components/layout/ScreenShell.tsx');
    expect(shell).toContain('CareLightPageShell');
    expect(shell).toContain("mode === 'light'");
  });

  it('PremiumListHeroFrame delegates to CareLightListHeroFrame in light mode', () => {
    const hero = readSrc('src/components/ui/PremiumListHeroFrame.tsx');
    expect(hero).toContain('CareLightListHeroFrame');
    expect(hero).toContain("mode === 'light'");
  });

  it('visual-reality-audit script covers Phase 2 list/detail routes', () => {
    const audit = readSrc('scripts/visual-reality-audit.mjs');
    expect(audit).toContain('PHASE2_LIST_DETAIL_SCREENS');
    expect(audit).toContain('PHASE3_LIST_DETAIL_SCREENS');
    expect(audit).toContain('PHASE3_LIST_HERO_COMPONENTS');
    expect(audit).toContain('CareLightPageShell');
    expect(audit).toContain('ROUTE_LAYOUT_FILES');
    expect(audit).toContain('FORBIDDEN_DARK_BG_PATTERNS');
    const pkg = readSrc('package.json');
    expect(pkg).toContain('"visual:audit"');
  });

  it('route layouts use light background, not dark colors.bgBase', () => {
    const layouts = [
      'app/auth/_layout.tsx',
      'app/office/_layout.tsx',
      'app/pflege/_layout.tsx',
      'app/business/_layout.tsx',
    ];
    for (const rel of layouts) {
      const src = readSrc(rel);
      expect(src).toMatch(/routeLayoutContentStyle|careLightColors\.page/);
      expect(src).not.toContain('colors.bgBase');
    }
  });

  it('DemoLoginScreen uses CareLightPageShell and CareLightButton', () => {
    const screen = readSrc('src/screens/DemoLoginScreen.tsx');
    expect(screen).toContain('CareLightPageShell');
    expect(screen).toContain('CareLightButton');
    expect(screen).not.toMatch(/import[^;]*ScreenShell[^;]*from '@\/components\/layout'/);
  });
});

describe('Visual Reality — Phase 2 list/detail screens', () => {
  const phase2ListScreens = [
    'src/screens/office/ClientsListScreen.tsx',
    'src/screens/office/EmployeesListScreen.tsx',
    'src/screens/office/InvoicesListScreen.tsx',
    'src/screens/office/AppointmentsListScreen.tsx',
    'src/screens/office/OfficeDocumentsListScreen.tsx',
    'src/screens/office/OfficeMessagesListScreen.tsx',
    'src/screens/pflege/CarePlansListScreen.tsx',
    'src/screens/pflege/VitalReadingsListScreen.tsx',
    'src/screens/pflege/MedicationListScreen.tsx',
    'src/screens/assist/AssignmentsListScreen.tsx',
    'src/screens/assist/ExecutionsListScreen.tsx',
    'src/screens/assist/TripsListScreen.tsx',
    'src/screens/beratung/CasesListScreen.tsx',
    'src/screens/stationaer/ResidentsListScreen.tsx',
    'src/screens/akademie/CoursesListScreen.tsx',
  ];

  it.each(phase2ListScreens)('%s uses CareLightPageShell', (relPath) => {
    const screen = readSrc(relPath);
    expect(screen).toContain('CareLightPageShell');
    expect(screen).not.toMatch(/import[^;]*ScreenShell[^;]*from '@\/components\/layout'/);
  });

  const phase2DetailScreens = [
    'src/screens/office/ClientDetailScreen.tsx',
    'src/screens/office/EmployeeDetailScreen.tsx',
    'src/screens/office/InvoiceDetailScreen.tsx',
    'src/screens/pflege/CarePlanDetailScreen.tsx',
    'src/screens/pflege/VitalReadingDetailScreen.tsx',
    'src/screens/beratung/CaseDetailScreen.tsx',
    'src/screens/stationaer/ResidentDetailScreen.tsx',
    'src/screens/akademie/CourseDetailScreen.tsx',
    'src/screens/assist/AssignmentDetailScreen.tsx',
    'src/screens/assist/TripDetailScreen.tsx',
  ];

  it.each(phase2DetailScreens)('%s uses CareLightPageShell', (relPath) => {
    const screen = readSrc(relPath);
    expect(screen).toContain('CareLightPageShell');
  });

  it('ClientsListHero uses CareLight list hero components', () => {
    const hero = readSrc('src/components/office/ClientsListHero.tsx');
    expect(hero).toContain('CareLightListHeroFrame');
    expect(hero).toContain('CareLightKpiCard');
    expect(hero).not.toContain('PremiumListHeroFrame');
  });

  it('auth login screens use CareLightPageShell', () => {
    for (const rel of [
      'src/screens/auth/BusinessLoginScreen.tsx',
      'src/screens/auth/EmployeePortalLoginScreen.tsx',
      'src/screens/auth/PortalCodeLoginScreen.tsx',
    ]) {
      const screen = readSrc(rel);
      expect(screen).toContain('CareLightPageShell');
    }
  });
});

describe('Visual Reality — Phase 3 QM/TI/Portal/Templates/Forms', () => {
  const phase3Screens = [
    'src/screens/qm/QmDocumentsScreen.tsx',
    'src/screens/qm/QmSettingsScreen.tsx',
    'src/screens/ti/TIProviderSettingsScreen.tsx',
    'src/screens/ti/TIAuditLogScreen.tsx',
    'src/screens/portal/PortalTabScreen.tsx',
    'src/screens/PortalDashboardScreen.tsx',
    'src/screens/templates/TemplateCenterScreen.tsx',
    'src/screens/templates/TemplateCreateScreen.tsx',
    'src/screens/office/EmployeeCreateScreen.tsx',
    'src/screens/office/ClientEditScreen.tsx',
    'src/screens/shared/MessageComposeScreenShell.tsx',
    'src/screens/pflege/VitalReadingCreateScreen.tsx',
  ];

  it.each(phase3Screens)('%s uses CareLightPageShell', (relPath) => {
    const screen = readSrc(relPath);
    expect(screen).toContain('CareLightPageShell');
    expect(screen).not.toMatch(/import[^;]*ScreenShell[^;]*from '@\/components\/layout'/);
  });

  const phase3ListHeroes = [
    'src/components/office/EmployeesListHero.tsx',
    'src/components/office/InvoicesListHero.tsx',
    'src/components/qm/QmDocumentsListHero.tsx',
    'src/components/templates/TemplateListHero.tsx',
    'src/components/ti/TIAuditLogListHero.tsx',
  ];

  it('OfficeModulesHubScreen uses CareLightPageShell', () => {
    const screen = readSrc('src/screens/business/office/OfficeModulesHubScreen.tsx');
    expect(screen).toContain('CareLightPageShell');
    expect(screen).not.toMatch(/import[^;]*ScreenShell[^;]*from '@\/components\/layout'/);
  });
});

describe('Visual Reality — Verification Round 2 design wiring', () => {
  it('ThemeModeProvider erzwingt light im Demo-Modus', () => {
    const src = readSrc('src/design/ThemeModeProvider.tsx');
    expect(src).toContain('isDemoMode()');
    expect(src).toContain("setModeState('light')");
  });

  it('getPostLoginRedirect leitet Business-Rollen nach /office', () => {
    const src = readSrc('src/lib/navigation/redirects.ts');
    expect(src).toContain('DEMO_BUSINESS_ENTRY_ROUTE');
    expect(readSrc('src/lib/navigation/demoNavigation.ts')).toContain("DEMO_BUSINESS_ENTRY_ROUTE = '/office'");
  });

  it('BusinessDashboardScreen nutzt CareLightModuleDashboard', () => {
    const screen = readSrc('src/screens/BusinessDashboardScreen.tsx');
    expect(screen).toContain('CareLightModuleDashboard');
    expect(screen).toContain('CareLightScreen');
    expect(screen).not.toMatch(/import[^;]*ScreenShell[^;]*from '@\/components\/layout'/);
  });

  it('@/theme default ist light (colors + typography)', () => {
    expect(readSrc('src/theme/colors.ts')).toContain("legacyColorsFromPalette('light')");
    expect(readSrc('src/theme/typography.ts')).toContain("resolveCareTypography('light')");
  });

  it('officeDashboard Quick-Action nutzt CLIENT_INTAKE_NEW_ROUTE', () => {
    const src = readSrc('src/data/demo/officeDashboard.ts');
    expect(src).toContain('CLIENT_INTAKE_NEW_ROUTE');
    expect(src).not.toContain("'/office/clients/create'");
  });

  it('visual-reality-audit prüft Demo-Navigation-Wiring', () => {
    const audit = readSrc('scripts/visual-reality-audit.mjs');
    expect(audit).toContain('assertDemoNavigationWiring');
    expect(audit).toContain('FORBIDDEN_LEGACY_NAV_ROUTES');
    expect(audit).toContain('DEMO_NAV_SOURCES');
  });
});
