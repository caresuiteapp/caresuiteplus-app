#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const root = process.cwd();
const appRoot = join(root, 'app');
const forbiddenImport =
  /from\s+['"]@\/(?:screens|components|design|theme)(?:\/|['"])/;
const infrastructureAllowlist = new Set([
  'app/+html.tsx',
  'app/_layout.tsx',
]);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

if (!existsSync(appRoot)) {
  console.error('Greenfield-Routenaudit: app/ fehlt.');
  process.exit(1);
}

const routeFiles = walk(appRoot)
  .filter((file) => extname(file) === '.tsx')
  .map((file) => relative(root, file).replaceAll('\\', '/'))
  .sort();

const violations = routeFiles
  .filter((file) => !infrastructureAllowlist.has(file))
  .flatMap((file) => {
    const source = readFileSync(join(root, file), 'utf8');
    return forbiddenImport.test(source) ? [file] : [];
  });

const report = {
  generatedAt: new Date().toISOString(),
  auditedRoutes: routeFiles.length,
  greenfieldRoutes: routeFiles.length - violations.length,
  legacyUiRoutes: violations.length,
  violations,
};

console.log(JSON.stringify(report, null, 2));

if (violations.length) {
  console.error(
    `Liquid Command Greenfield-Routenaudit fehlgeschlagen: ${violations.length} Routen verwenden noch alte sichtbare UI.`,
  );
  process.exit(1);
}

console.log(
  `Liquid Command Greenfield-Routenaudit: OK · ${routeFiles.length} TSX-Routen ohne alte UI-Imports`,
);
