import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const liquidRoot = join(root, 'src', 'liquid-command');
const appRoot = join(root, 'app');
const compatibilityRouteRoot = join(appRoot, 'liquid-command');
const failures = [];

function collect(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? collect(path) : [path];
  });
}

function requireFile(path) {
  if (!existsSync(join(root, path))) failures.push(`Fehlende Datei: ${path}`);
}

[
  'app/index.tsx',
  'app/liquid-command/index.tsx',
  'app/liquid-command/access/index.tsx',
  'app/liquid-command/access/business.tsx',
  'app/liquid-command/access/employee.tsx',
  'app/liquid-command/access/client.tsx',
  'app/liquid-command/access/family.tsx',
  'app/liquid-command/access/register.tsx',
  'app/liquid-command/access/recovery.tsx',
  'app/liquid-command/access/reset-password.tsx',
  'app/liquid-command/portal/employee.tsx',
  'app/liquid-command/portal/client.tsx',
  'app/liquid-command/portal/family.tsx',
].forEach(requireFile);

for (const module of [
  'office',
  'assist',
  'pflege',
  'stationaer',
  'beratung',
  'akademie',
  'robotics',
  'platform',
  'settings',
]) {
  requireFile(`app/liquid-command/${module}/index.tsx`);
}

const sources = collect(liquidRoot).filter((path) => ['.ts', '.tsx'].includes(extname(path)));
const sourceText = sources.map((path) => readFileSync(path, 'utf8')).join('\n');
const compatibilityRouteFiles = collect(compatibilityRouteRoot).filter(
  (path) => extname(path) === '.tsx',
);
const applicationRouteFiles = collect(appRoot).filter((path) => extname(path) === '.tsx');

const forbiddenImports = /from\s+['"]@\/(components|screens|design|theme)(?:\/|['"])/g;
for (const path of sources) {
  const text = readFileSync(path, 'utf8');
  if (forbiddenImports.test(text)) {
    failures.push(`Legacy-UI-Import: ${relative(root, path)}`);
  }
  forbiddenImports.lastIndex = 0;
  if (/on(?:Press|ChangeText)=\{\(\)\s*=>\s*undefined\}/.test(text)) {
    failures.push(`Leere Interaktion: ${relative(root, path)}`);
  }
}

for (const [token, value] of Object.entries({
  navy950: '#010817',
  navy800: '#061B35',
  blue500: '#1683FF',
  blue200: '#9ACBFF',
  white: '#FFFFFF',
})) {
  if (!sourceText.includes(`${token}: '${value}'`)) {
    failures.push(`Binding Token fehlt: ${token} ${value}`);
  }
}

for (const pageType of [
  'command-center',
  'work-list',
  'record',
  'planning',
  'editor',
  'review',
  'analytics',
  'settings',
]) {
  if (!sourceText.includes(`pageType: '${pageType}'`)) {
    failures.push(`Universeller Seitentyp fehlt: ${pageType}`);
  }
}

if (!sourceText.includes('phone-landscape-blocked')) {
  failures.push('Smartphone-Querformat-Sperre fehlt.');
}
if (!sourceText.includes('fetchPortalAppointments')) {
  failures.push('Portal-Terminadapter fehlt.');
}
if (!sourceText.includes('downloadPortalDocument')) {
  failures.push('Portal-Dokumentdownload fehlt.');
}
if (!sourceText.includes('registerBusinessTenant')) {
  failures.push('Organisationsregistrierung fehlt.');
}

for (const route of [
  'app/auth/index.tsx',
  'app/auth/business-login.tsx',
  'app/auth/employee-login.tsx',
  'app/auth/client-login.tsx',
  'app/auth/family-login.tsx',
  'app/portal/client/(tabs)/index.tsx',
  'app/portal/employee/(tabs)/index.tsx',
  'app/portal/relative/index.tsx',
  'app/office/index.tsx',
  'app/assist/index.tsx',
  'app/pflege/index.tsx',
  'app/stationaer/index.tsx',
  'app/beratung/index.tsx',
  'app/akademie/index.tsx',
  'app/robotics/index.tsx',
  'app/platform/index.tsx',
  'app/settings/index.tsx',
]) {
  requireFile(route);
}

for (const layout of [
  'app/office/_layout.tsx',
  'app/assist/_layout.tsx',
  'app/pflege/_layout.tsx',
  'app/stationaer/_layout.tsx',
  'app/beratung/_layout.tsx',
  'app/akademie/_layout.tsx',
  'app/portal/_layout.tsx',
  'app/portal/client/_layout.tsx',
  'app/portal/employee/_layout.tsx',
  'app/portal/relative/_layout.tsx',
]) {
  const path = join(root, layout);
  if (!existsSync(path)) continue;
  const text = readFileSync(path, 'utf8');
  if (
    /ShellLayout|routeLayoutContentStyle|ShellAnimatedBackgroundLayer|(?:Client|Employee|Relative)PortalShell/.test(
      text,
    )
  ) {
    failures.push(`Alt-Shell in migrierter Route: ${layout}`);
  }
}

const migratedTopLevelRoots = new Set([
  'admin',
  'akademie',
  'assist',
  'auth',
  'beratung',
  'business',
  'communication',
  'design-system',
  'insight',
  'liquid-command',
  'medical',
  'office',
  'onboarding',
  'pflege',
  'platform',
  'portal',
  'public',
  'robotics',
  'settings',
  'stationaer',
  'zentrale',
]);

for (const path of applicationRouteFiles) {
  const route = relative(appRoot, path).replaceAll('\\', '/');
  if (
    route === '_layout.tsx' ||
    route === 'index.tsx' ||
    route === '+html.tsx' ||
    route === '+not-found.tsx'
  ) {
    continue;
  }
  const topLevelRoot = route.split('/')[0];
  if (!route.includes('/') && readFileSync(path, 'utf8').includes('<Redirect')) continue;
  if (!migratedTopLevelRoots.has(topLevelRoot)) {
    failures.push(`Route ohne Greenfield-Cutover: app/${route}`);
  }
}

const allLayouts = applicationRouteFiles.filter((path) => path.endsWith('_layout.tsx'));
const forbiddenLayoutShell =
  /ShellLayout|routeLayoutContentStyle|ShellAnimatedBackgroundLayer|(?:Client|Employee|Relative)PortalShell|OfficeTimeTrackingShell/;
for (const path of allLayouts) {
  const route = relative(root, path).replaceAll('\\', '/');
  if (route === 'app/_layout.tsx') continue;
  const text = readFileSync(path, 'utf8');
  if (forbiddenLayoutShell.test(text)) {
    failures.push(`Alt-Shell in Routenlayout: ${route}`);
  }
}

const cutoverSource = readFileSync(
  join(root, 'src/liquid-command/navigation/isLiquidCommandRoute.ts'),
  'utf8',
);
for (const routeRootName of migratedTopLevelRoots) {
  if (routeRootName === 'liquid-command') continue;
  if (!cutoverSource.includes(`'/${routeRootName}'`)) {
    failures.push(`Globaler Greenfield-Cutover fehlt: /${routeRootName}`);
  }
}

const compatibilityLayout = readFileSync(
  join(root, 'app/liquid-command/_layout.tsx'),
  'utf8',
);
if (!compatibilityLayout.includes('<Redirect')) {
  failures.push('Parallele /liquid-command-Demo ist noch direkt erreichbar.');
}

const moduleCatalog = readFileSync(
  join(root, 'src/liquid-command/navigation/moduleCatalog.ts'),
  'utf8',
);
if (/route:\s*['"]\/liquid-command\/(?:office|assist|pflege|stationaer|beratung|akademie|robotics|platform|settings)/.test(moduleCatalog)) {
  failures.push('Modulkatalog verwendet noch parallele Demo-Routen.');
}

for (const requiredWorkflow of [
  'Gehaltsstatistik',
  'Nachrichten',
  'Arbeitszeit',
  'Portale & Zugänge',
  'Profil',
]) {
  if (!moduleCatalog.includes(requiredWorkflow)) {
    failures.push(`Global erreichbarer Workflow fehlt: ${requiredWorkflow}`);
  }
}

const commandCenter = readFileSync(
  join(root, 'src/liquid-command/screens/CommandCenterScreen.tsx'),
  'utf8',
);
if (
  !commandCenter.includes('ClientNetworkMap') ||
  !commandCenter.includes('Alle Klient:innen auf der Karte')
) {
  failures.push('Dauerhafte mandantenweite Klient:innenkarte fehlt.');
}

const shellSource = readFileSync(
  join(root, 'src/liquid-command/shell/LiquidCommandShell.tsx'),
  'utf8',
);
if (!shellSource.includes('auth.signOut()') || !shellSource.includes('Sicher abmelden')) {
  failures.push('Profilmenü mit sicherer Abmeldung fehlt.');
}

if (failures.length) {
  console.error(`Liquid Command Audit fehlgeschlagen (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Liquid Command Audit: OK · ${sources.length} isolierte UI-Dateien · ${applicationRouteFiles.length} TSX-Routendateien vollständig im Cutover · ${compatibilityRouteFiles.length} alte Vorschaupfade kanonisch umgeleitet · 10 Module · 8 Seitentypen`,
);
