#!/usr/bin/env node
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mapData from '../src/lib/navigation/einzelseiten-route-map.json' with { type: 'json' };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = join(root, 'app');

function findRouteFile(routePath) {
  const segments = routePath.replace(/^\//, '').split('/').filter(Boolean);

  function walk(dir, index) {
    if (!existsSync(dir)) return null;
    if (index >= segments.length) {
      if (existsSync(join(dir, 'index.tsx'))) return join(dir, 'index.tsx');
      if (existsSync(`${dir}.tsx`)) return `${dir}.tsx`;
      const entries = readdirSync(dir, { withFileTypes: true });
      const tabs = entries.find((e) => e.isDirectory() && e.name === '(tabs)');
      if (tabs && existsSync(join(dir, '(tabs)', 'index.tsx'))) {
        return join(dir, '(tabs)', 'index.tsx');
      }
      return null;
    }

    const seg = segments[index];
    const entries = readdirSync(dir, { withFileTypes: true });
    const exactDir = entries.find((e) => e.isDirectory() && e.name === seg);
    if (exactDir) {
      const viaExact = walk(join(dir, exactDir.name), index + 1);
      if (viaExact) return viaExact;
    }

    const exactFile = entries.find((e) => e.isFile() && e.name === `${seg}.tsx`);
    if (exactFile) return join(dir, exactFile.name);

    const tabsDir = entries.find((e) => e.isDirectory() && e.name === '(tabs)');
    if (tabsDir) {
      const tabsFile = join(dir, '(tabs)', `${seg}.tsx`);
      if (existsSync(tabsFile)) return tabsFile;
      if (index === segments.length - 1 && existsSync(join(dir, '(tabs)', 'index.tsx'))) {
        return join(dir, '(tabs)', 'index.tsx');
      }
    }

    const dynamic = entries.find(
      (e) => e.isDirectory() && e.name.startsWith('[') && e.name.endsWith(']'),
    );
    if (dynamic) return walk(join(dir, dynamic.name), index + 1);

    const group = entries.find((e) => e.isDirectory() && e.name.startsWith('('));
    if (group) {
      const viaGroup = walk(join(dir, group.name), index);
      if (viaGroup) return viaGroup;
    }

    return null;
  }

  return walk(appRoot, 0);
}

const missing = [];
for (const entry of mapData) {
  const promptFile = findRouteFile(entry.prompt);
  const targetFile = findRouteFile(entry.target);
  if (!promptFile && !targetFile) {
    missing.push(entry);
  }
}

console.log(`CareSuite+ Einzelseiten Route Audit: ${mapData.length} Prompts\n`);
console.log(`✓ Erreichbar (Prompt- oder Ziel-Route): ${mapData.length - missing.length}`);
console.log(`✗ Weder Prompt noch Ziel gefunden: ${missing.length}\n`);

if (missing.length > 0) {
  for (const m of missing) {
    console.log(`  ${m.id} ${m.prompt} → ${m.target}`);
  }
  process.exit(1);
}

process.exit(0);
