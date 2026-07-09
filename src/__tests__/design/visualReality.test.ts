import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Visual Reality — light premium main screens', () => {
  it('ThemeModeProvider defaults mobile and desktop to light', () => {
    const src = readSrc('src/design/ThemeModeProvider.tsx');
    expect(src).toContain('resolveInitialMode');
    expect(src).toContain("return 'light'");
    expect(src).not.toContain("return isDesktopWeb() ? 'dark' : 'light'");
  });

  it('PflegeIndexScreen uses platform dashboard shell', () => {
    const screen = readSrc('src/screens/pflege/PflegeIndexScreen.tsx');
    expect(screen).toContain('ModuleDashboardShell');
    expect(screen).toContain('PflegeDashboardView');
    expect(screen).not.toContain('CareLightModuleDashboard');
    expect(screen).not.toContain('AdaptiveModuleDashboard');
    expect(screen).not.toContain('PremiumListHeroFrame');
  });

  it('buildPflegeWorkspaceKpis exposes mandated KPI labels', () => {
    const stats = readSrc('src/lib/pflege/pflegeDashboardWorkspace.ts');
    expect(stats).toContain('Pflegeeinsätze heute');
    expect(stats).toContain('Auffällige Vitalwerte');
    expect(stats).toContain('SIS/Assessment offen');
    expect(stats).toContain('Berichte offen');
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
    'src/screens/assist/AssistIndexScreen.tsx',
    'src/screens/beratung/BeratungIndexScreen.tsx',
    'src/screens/stationaer/StationaerIndexScreen.tsx',
    'src/screens/akademie/AkademieIndexScreen.tsx',
    'src/screens/insight/InsightIndexScreen.tsx',
    'src/screens/qm/QmDashboardScreen.tsx',
  ];

  it('OfficeIndexScreen uses platform dashboard shell', () => {
    const screen = readSrc('src/screens/office/OfficeIndexScreen.tsx');
    expect(screen).toContain('ModuleDashboardShell');
    expect(screen).not.toContain('AdaptiveModuleDashboard');
  });

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

  it('ScreenShell delegates to ScreenShell in light mode', () => {
    const shell = readSrc('src/components/layout/ScreenShell.tsx');
    expect(shell).toContain('ScreenShell');
    expect(shell).toContain("mode === 'light'");
  });

  it('PremiumListHeroFrame delegates to PremiumListHeroFrame in light mode', () => {
    const hero = readSrc('src/components/ui/PremiumListHeroFrame.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain("mode === 'light'");
  });

  it('visual-reality-audit script covers Phase 2 list/detail routes', () => {
    const audit = readSrc('scripts/visual-reality-audit.mjs');
    expect(audit).toContain('PHASE2_LIST_DETAIL_SCREENS');
    expect(audit).toContain('PHASE3_LIST_DETAIL_SCREENS');
    expect(audit).toContain('PHASE3_LIST_HERO_COMPONENTS');
    expect(audit).toContain('ScreenShell');
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

  it.each(phase2ListScreens)('%s uses ScreenShell or ScreenShell', (relPath) => {
    const screen = readSrc(relPath);
    const usesLightShell =
      screen.includes('ScreenShell') ||
      (screen.includes('ScreenShell') && readSrc('src/components/layout/ScreenShell.tsx').includes('ScreenShell'));
    expect(usesLightShell).toBe(true);
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

  it.each(phase2DetailScreens)('%s uses ScreenShell', (relPath) => {
    const screen = readSrc(relPath);
    expect(screen).toContain('ScreenShell');
  });

  it('ClientsListHero uses list hero frame and KPI cards', () => {
    const hero = readSrc('src/components/office/ClientsListHero.tsx');
    expect(hero).toContain('PremiumListHeroFrame');
    expect(hero).toContain('PremiumKpiCard');
  });

  it('auth login screens use AuthLayout or ScreenShell', () => {
    for (const rel of [
      'src/screens/auth/BusinessLoginScreen.tsx',
      'src/screens/auth/EmployeePortalLoginScreen.tsx',
      'src/screens/auth/PortalCodeLoginScreen.tsx',
    ]) {
      const screen = readSrc(rel);
      expect(screen.includes('AuthLayout') || screen.includes('ScreenShell')).toBe(true);
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

  it.each(phase3Screens)('%s uses ScreenShell', (relPath) => {
    const screen = readSrc(relPath);
    expect(screen).toContain('ScreenShell');
  });

  it('OfficeModulesHubScreen uses ScreenShell', () => {
    const screen = readSrc('src/screens/business/office/OfficeModulesHubScreen.tsx');
    expect(screen).toContain('ScreenShell');
  });
});

describe('Visual Reality — Verification Round 2 design wiring', () => {
  it('ThemeModeProvider resolves responsive light/dark defaults', () => {
    const src = readSrc('src/design/ThemeModeProvider.tsx');
    expect(src).toContain('resolveInitialMode');
    expect(src).toContain('isDesktopWeb');
  });

  it('getPostLoginRedirect leitet Business-Rollen nach /office', () => {
    const src = readSrc('src/lib/navigation/redirects.ts');
    expect(src).toContain('DEMO_BUSINESS_ENTRY_ROUTE');
    expect(readSrc('src/lib/navigation/demoNavigation.ts')).toContain("DEMO_BUSINESS_ENTRY_ROUTE = '/office'");
  });

  it('BusinessDashboardScreen nutzt KPI-Grid ohne doppelten Willkommens-Hero', () => {
    const screen = readSrc('src/screens/BusinessDashboardScreen.tsx');
    expect(screen).not.toContain('ZentraleDashboardHero');
    expect(screen).toContain('PremiumKpiCard');
    expect(screen).not.toContain('CareLightModuleDashboard');
    expect(screen).not.toContain('Letzte Aktivitäten');
    expect(screen).not.toContain('Schnellzugriff');
  });

  it('@/theme default uses light palette with black ink', () => {
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
