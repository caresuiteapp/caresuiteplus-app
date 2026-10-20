#!/usr/bin/env node
/**
 * Liquid Command responsive cutover audit.
 *
 * The previous audit verified the removed CareAdaptiveShell family. The
 * production application now has one four-form-factor Liquid Command runtime,
 * so this gate validates the actual active shells and route boundaries.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredFiles = [
  'src/liquid-command/foundation/tokens.ts',
  'src/liquid-command/foundation/useLiquidLayout.ts',
  'src/liquid-command/shell/LiquidCommandShell.tsx',
  'src/liquid-command/shell/LiquidModuleRouteLayout.tsx',
  'src/liquid-command/shell/LiquidPortalRouteLayout.tsx',
  'src/lib/portal/portalResponsiveLayout.ts',
  'src/liquid-command/screens/AccessScreens.tsx',
  'src/liquid-command/screens/CommandCenterScreen.tsx',
  'src/liquid-command/components/ClientNetworkMap.tsx',
  'src/liquid-command/components/ClientNetworkMap.web.tsx',
];

function source(relativePath) {
  const path = join(root, relativePath);
  if (!existsSync(path)) {
    failures.push(`Fehlende Datei: ${relativePath}`);
    return '';
  }
  return readFileSync(path, 'utf8');
}

for (const file of requiredFiles) source(file);

const layoutSource = source('src/liquid-command/foundation/useLiquidLayout.ts');
for (const formFactor of [
  'phone-portrait',
  'phone-landscape-blocked',
  'tablet-portrait',
  'tablet-landscape',
  'compact-web',
  'desktop',
]) {
  if (!layoutSource.includes(`'${formFactor}'`)) {
    failures.push(`Formfaktor fehlt: ${formFactor}`);
  }
}
for (const capability of ['showDock', 'showCommandLabels', 'contentPadding', 'panelCount']) {
  if (!layoutSource.includes(capability)) {
    failures.push(`Responsive Layout-Fähigkeit fehlt: ${capability}`);
  }
}

const shellSource = source('src/liquid-command/shell/LiquidCommandShell.tsx');
for (const marker of [
  "layout.formFactor === 'phone-landscape-blocked'",
  'layout.showDock',
  '!layout.isDesktop ? (',
  '<BottomNavigation activeModule={activeModule}',
  "layout.formFactor === 'tablet-portrait'",
]) {
  if (!shellSource.includes(marker)) {
    failures.push(`Liquid Command Shell: ${marker} fehlt`);
  }
}

const portalShellSource = source('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');
const portalResponsiveSource = source('src/lib/portal/portalResponsiveLayout.ts');
if (
  !portalShellSource.includes('desktopChrome = resolvePortalDesktopChrome(layout.width)') ||
  !portalShellSource.includes('!desktopChrome ? (') ||
  !portalShellSource.includes('compactNavigation.map') ||
  !portalResponsiveSource.includes('PORTAL_DESKTOP_CHROME_MIN_WIDTH = 1024')
) {
  failures.push('Portal-Shell besitzt keine eigene Smartphone-/Tablet-Navigation.');
}
if (!portalShellSource.includes('Abmelden')) {
  failures.push('Portal-Shell besitzt keine sichtbare Abmeldung.');
}

const moduleLayouts = [
  'app/admin/_layout.tsx',
  'app/akademie/_layout.tsx',
  'app/assist/_layout.tsx',
  'app/beratung/_layout.tsx',
  'app/business/_layout.tsx',
  'app/communication/_layout.tsx',
  'app/insight/_layout.tsx',
  'app/medical/_layout.tsx',
  'app/office/_layout.tsx',
  'app/pflege/_layout.tsx',
  'app/robotics/_layout.tsx',
  'app/settings/_layout.tsx',
  'app/stationaer/_layout.tsx',
  'app/zentrale/_layout.tsx',
];
for (const layout of moduleLayouts) {
  if (!source(layout).includes('LiquidModuleRouteLayout')) {
    failures.push(`Modulroute ohne LiquidModuleRouteLayout: ${layout}`);
  }
}

for (const [layout, kind] of [
  ['app/portal/client/_layout.tsx', 'client'],
  ['app/portal/employee/_layout.tsx', 'employee'],
]) {
  const portalLayout = source(layout);
  if (
    !portalLayout.includes('LiquidPortalRouteLayout') ||
    !portalLayout.includes(`kind="${kind}"`)
  ) {
    failures.push(`Portalroute ohne responsive Liquid-Shell: ${layout}`);
  }
}

const layoutFiles = [
  ...moduleLayouts,
  'app/business/office/time-tracking/_layout.tsx',
  'app/portal/client/_layout.tsx',
  'app/portal/employee/_layout.tsx',
];
const legacyShellPattern =
  /ShellLayout|CareAdaptiveShell|PortalShellLayout|OfficeTimeTrackingShell|routeLayoutContentStyle/;
for (const layout of layoutFiles) {
  if (legacyShellPattern.test(source(layout))) {
    failures.push(`Alte responsive Shell in produktiver Route: ${layout}`);
  }
}

if (failures.length) {
  console.error(`Liquid Command responsive:audit fehlgeschlagen (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Liquid Command responsive:audit: OK · 6 Formfaktorzustände · ${moduleLayouts.length} Modulwurzeln · 2 Portal-Familien · Smartphone-Querformat gesperrt`,
);
