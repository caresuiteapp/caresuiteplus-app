import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const assertions = [];

function check(label, condition) {
  if (!condition) throw new Error(`✗ ${label}`);
  assertions.push(label);
}

function walk(relative) {
  const absolute = path.join(root, relative);
  return readdirSync(absolute).flatMap((name) => {
    const next = path.join(relative, name);
    return statSync(path.join(root, next)).isDirectory() ? walk(next) : [next];
  });
}

const globalBackground = read('src/components/ui/effects/globalanimatedbackground.tsx');
const webSurfaceCss = read('src/design/web/lightLiquidGlassSurfaceCss.ts');
const officeLayout = read('app/office/_layout.tsx');
const assistLayout = read('app/assist/_layout.tsx');
const officeDashboard = read('src/screens/office/OfficeIndexScreen.tsx');
const assistDashboard = read('src/screens/assist/AssistIndexScreen.tsx');
const subpageShell = read('src/components/layout/C14vSubpageShell.tsx');
const routePlanning = read('src/lib/assist/routePlanningService.ts');

check('der kanonische Spatial-Care-Hintergrund ist systemweit aktiv',
  globalBackground.includes('SpatialCareBackground') &&
  !globalBackground.includes('DarkLiquidGlassBackground'));
check('die Web-Wurzel verwendet die produktive HealthOS-Dunkelfläche',
  webSurfaceCss.includes('color-scheme: dark') &&
  webSurfaceCss.includes('background: #071225') &&
  !webSurfaceCss.includes('background: #F7FAFF'));
check('Office und Assist verwenden dieselbe äußere Shell',
  officeLayout.includes('LiquidModuleRouteLayout') &&
  assistLayout.includes('LiquidModuleRouteLayout'));
check('Office- und Assist-Startseite verwenden dieselbe Seitenschale',
  officeDashboard.includes('<ScreenShell') && assistDashboard.includes('<ScreenShell'));
check('Unterseiten laufen zentral über ScreenShell', subpageShell.includes('<ScreenShell'));
check('Vertretungsvorschläge erzwingen echte Qualifikation',
  routePlanning.includes('!qualification.data.qualificationOk'));

const routeFiles = [...walk('app/office'), ...walk('app/assist')]
  .filter((file) => file.endsWith('.tsx') && !file.endsWith('_layout.tsx'));
check('Office und Assist besitzen erreichbare Routen', routeFiles.length >= 95);
check('keine leere Office-/Assist-Routendatei',
  routeFiles.every((file) => read(file).trim().length > 20));

const screenFiles = [...walk('src/screens/office'), ...walk('src/screens/assist')]
  .filter((file) => file.endsWith('.tsx'));
const darkRuntime = screenFiles.filter((file) =>
  /DarkLiquidGlassBackground/.test(read(file)),
);
check('keine Office-/Assist-Seite bindet den veralteten Testhintergrund ein', darkRuntime.length === 0);

console.log('CareSuite+ Office + Assist Experience Audit V33.1');
for (const label of assertions) console.log(`✓ ${label}`);
console.log(`Geprüfte Routen: ${routeFiles.length}`);
console.log(`Geprüfte Screens: ${screenFiles.length}`);
