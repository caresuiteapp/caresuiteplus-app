import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';

const root = process.cwd();
const appRoot = join(root, 'app');
const srcRoot = join(root, 'src');

function walk(directory, extension = '.tsx') {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = join(directory, entry);
    return statSync(absolute).isDirectory()
      ? walk(absolute, extension)
      : absolute.endsWith(extension)
        ? [absolute]
        : [];
  });
}

function resolveLocalImport(fromFile, specifier) {
  const base = specifier.startsWith('@/')
    ? join(srcRoot, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(fromFile), specifier)
      : null;
  if (!base) return null;

  const candidates = extname(base)
    ? [base]
    : [
        `${base}.tsx`,
        `${base}.ts`,
        `${base}.jsx`,
        `${base}.js`,
        join(base, 'index.tsx'),
        join(base, 'index.ts'),
      ];
  return candidates.find(existsSync) ?? null;
}

function localImports(file) {
  const source = readFileSync(file, 'utf8');
  const matches = source.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g);
  return [...matches]
    .map((match) => resolveLocalImport(file, match[1]))
    .filter(Boolean);
}

function dependencyClosure(entry) {
  const queue = [entry];
  const visited = new Set();
  while (queue.length) {
    const file = queue.shift();
    if (!file || visited.has(file) || visited.size > 800) continue;
    visited.add(file);
    for (const dependency of localImports(file)) {
      if (!visited.has(dependency)) queue.push(dependency);
    }
  }
  return [...visited];
}

const shellMarkers = [
  '<ScreenShell',
  '<C14vSubpageShell',
  '<PortalTabScreen',
  '<EmployeePortalPageFrame',
  '<PlatformShellLayout',
  '<HealthOSPageSurface',
  '<ModuleDashboardShell',
  '<LiquidCommandShell',
  '<LiquidBackdrop',
  '<LiquidPortalRouteLayout',
  '<LiquidModuleRouteLayout',
];

function routeLabel(file) {
  return `/${relative(appRoot, file)
    .replaceAll('\\', '/')
    .replace(/\.(tsx|jsx)$/, '')
    .replace(/\/index$/, '')
    .replace(/^index$/, '')
    .replace(/\/\([^/]+\)/g, '')}`;
}

function isAuditedProductRoute(route, file) {
  const basename = file.split(/[\\/]/).at(-1);
  if (basename === '_layout.tsx' || basename?.startsWith('+')) return false;
  return route !== '/' && !/^\/(auth|onboarding|design-system|liquid-command|shell-preview|.*-shell-preview)(\/|$)/.test(route);
}

function usesCanonicalShell(files) {
  return files.some((file) => {
    const source = readFileSync(file, 'utf8');
    return shellMarkers.some((marker) => source.includes(marker)) || source.includes('<Redirect');
  });
}

const routeFiles = walk(appRoot);
const auditedRoutes = routeFiles
  .map((file) => ({ file, route: routeLabel(file) }))
  .filter(({ file, route }) => isAuditedProductRoute(route, file));

const missingShell = auditedRoutes.filter(({ file }) => !usesCanonicalShell(dependencyClosure(file)));

const forbiddenParallelWorlds = [
  {
    file: 'src/components/ui/PremiumListHeroFrame.tsx',
    patterns: [/useThemeMode/, /CareLightListHeroFrame/, /AURORA_HERO_COLORS/],
  },
  {
    file: 'src/components/ui/CareLightListHeroFrame.tsx',
    required: [/PremiumListHeroFrame/],
  },
  {
    file: 'src/components/ui/CareLightCard.tsx',
    required: [/PremiumCard/],
  },
  {
    file: 'src/components/ui/CareLightButton.tsx',
    required: [/PremiumButton/],
  },
  {
    file: 'src/components/layout/CareLightScreenHeader.tsx',
    required: [/ScreenHeader/],
  },
];

const contractFailures = [];
for (const rule of forbiddenParallelWorlds) {
  const source = readFileSync(join(root, rule.file), 'utf8');
  for (const pattern of rule.patterns ?? []) {
    if (pattern.test(source)) contractFailures.push(`${rule.file}: verbotener Parallelpfad ${pattern}`);
  }
  for (const pattern of rule.required ?? []) {
    if (!pattern.test(source)) contractFailures.push(`${rule.file}: zentrale Komponente fehlt ${pattern}`);
  }
}

const screenFiles = walk(join(srcRoot, 'screens'));
const moduleLegacyScreens = screenFiles.filter((file) => {
  const source = readFileSync(file, 'utf8');
  return source.includes('<CareLightScreen') && !relative(srcRoot, file).replaceAll('\\', '/').startsWith('screens/auth/');
});

const moduleCounts = new Map();
for (const { route } of auditedRoutes) {
  const segment = route.split('/').filter(Boolean)[0] ?? 'root';
  moduleCounts.set(segment, (moduleCounts.get(segment) ?? 0) + 1);
}

const report = {
  generatedAt: new Date().toISOString(),
  auditedProductRoutes: auditedRoutes.length,
  canonicalShellRoutes: auditedRoutes.length - missingShell.length,
  missingShellRoutes: missingShell.map(({ route }) => route),
  moduleLegacyScreens: moduleLegacyScreens.map((file) => relative(root, file).replaceAll('\\', '/')),
  contractFailures,
  moduleRouteCounts: Object.fromEntries([...moduleCounts].sort(([a], [b]) => a.localeCompare(b))),
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (missingShell.length || moduleLegacyScreens.length || contractFailures.length) {
  process.exitCode = 1;
}
