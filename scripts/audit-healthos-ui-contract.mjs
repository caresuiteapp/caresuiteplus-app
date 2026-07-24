import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();

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

function countMatching(files, pattern) {
  return files.filter((file) => pattern.test(readFileSync(file, 'utf8'))).length;
}

const contextualSegments = new Set([
  'new',
  'create',
  'compose',
  'anlegen',
  'edit',
  'review',
  'configure',
  'request',
  'prepare',
  'upload',
  'settings',
  'einstellungen',
  'details',
  'detail',
]);

function isContextualRoute(file) {
  const route = `/${relative(join(root, 'app'), file)
    .replace(/\\/g, '/')
    .replace(/\.(tsx|jsx)$/, '')
    .replace(/\/index$/, '')
    .replace(/\/\([^/]+\)/g, '')}`;
  if (/^\/(auth|portal|client-portal|employee-portal)(\/|$)/.test(route)) return false;
  if (/\/assignments\/\[id\]\/execute|\/execution\/|\/first-login|\/recovery-bridge|\/reset-password/.test(route)) {
    return false;
  }
  return route
    .split('/')
    .filter(Boolean)
    .some((segment) => /^\[.+\]$/.test(segment) || contextualSegments.has(segment.toLowerCase()));
}

const routes = walk(join(root, 'app'));
const screens = walk(join(root, 'src/screens'));
const components = walk(join(root, 'src/components'));
const userFacing = [...screens, ...components];

const summary = {
  generatedAt: new Date().toISOString(),
  routesChecked: routes.length,
  screensChecked: screens.length,
  interactiveFilesChecked: countMatching(userFacing, /onPress=|<Pressable|<TouchableOpacity/),
  routeNavigationFiles: countMatching(userFacing, /router\.(push|replace)\(/),
  screenShellFiles: countMatching(userFacing, /<ScreenShell/),
  sectionPanelFiles: countMatching(userFacing, /<SectionPanel/),
  filterFiles: countMatching(userFacing, /FilterChip|ListFilterSelect|FilterToolbar/),
  tabFiles: countMatching(userFacing, /SegmentedTabs|CarePopupTabPills|TabBar/),
  tableFiles: countMatching(userFacing, /PremiumDataTable|ListTable/),
  rawModalFiles: countMatching(userFacing, /<Modal\b/),
  pageRoutes: routes.filter((file) => !isContextualRoute(file)).length,
  contextualPopupRoutes: routes.filter(isContextualRoute).length,
};

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
