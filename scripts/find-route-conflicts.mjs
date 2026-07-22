#!/usr/bin/env node
import { existsSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = join(root, 'app');
const routeExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
      continue;
    }

    const extension = extname(entry.name);
    if (!routeExtensions.has(extension)) continue;
    if (entry.name.startsWith('_') || entry.name.startsWith('+')) continue;
    files.push(full);
  }

  return files;
}

function toRoutePattern(file) {
  const rel = relative(appRoot, file).replace(/\\/g, '/');
  const withoutExtension = rel.replace(/\.(js|jsx|ts|tsx)$/, '');
  const segments = withoutExtension
    .split('/')
    .filter((segment) => !/^\(.+\)$/.test(segment));

  if (segments.at(-1) === 'index') segments.pop();
  return segments.join('/') || '/';
}

const routeMap = new Map();

for (const file of walk(appRoot)) {
  const route = toRoutePattern(file);
  const files = routeMap.get(route) ?? [];
  files.push(relative(root, file).replace(/\\/g, '/'));
  routeMap.set(route, files);
}

const conflicts = [...routeMap.entries()]
  .filter(([, files]) => files.length > 1)
  .map(([route, files]) => ({ route, files }))
  .sort((a, b) => a.route.localeCompare(b.route));

console.log(JSON.stringify(conflicts, null, 2));
console.log('Total:', conflicts.length);
process.exit(conflicts.length > 0 ? 1 : 0);
