#!/usr/bin/env node
/**
 * Mechanical Aurora migration — CareLight → Premium/Aurora equivalents.
 * Run: node scripts/migrate-to-aurora.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

const REPLACEMENTS = [
  { from: /CareLightListHeroFrame/g, to: 'PremiumListHeroFrame' },
  { from: /CareLightKpiCard/g, to: 'PremiumKpiCard' },
  { from: /CareLightPageShell/g, to: 'ScreenShell' },
];

/** Skip files that define legacy components or tests that assert legacy names. */
const SKIP_FILES = new Set([
  'PremiumButton.tsx',
  'PremiumListHeroFrame.tsx',
  'ScreenShell.tsx',
  'CareLightButton.tsx',
  'CareLightKpiCard.tsx',
  'CareLightPageShell.tsx',
  'CareLightCard.tsx',
  'migrate-to-aurora.mjs',
]);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === '.expo-resolve-test') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts)$/.test(name)) acc.push(p);
  }
  return acc;
}

function migrateFile(filePath) {
  if (SKIP_FILES.has(filePath.split(/[/\\]/).pop() ?? '')) return null;
  let src = readFileSync(filePath, 'utf8');
  let changed = false;
  for (const { from, to } of REPLACEMENTS) {
    if (from.test(src)) {
      src = src.replace(from, to);
      changed = true;
    }
  }
  // CareLightButton → PremiumButton (except variant props like accentColor)
  if (/CareLightButton/.test(src)) {
    src = src.replace(/CareLightButton/g, 'PremiumButton');
    src = src.replace(/\s+accentColor=\{[^}]+\}/g, '');
    changed = true;
  }
  if (!changed) return null;
  if (!dryRun) writeFileSync(filePath, src, 'utf8');
  return relative(root, filePath);
}

const files = walk(join(root, 'src'));
const updated = files.map(migrateFile).filter(Boolean);
console.log(dryRun ? '[dry-run] Would update:' : 'Updated:');
updated.forEach((f) => console.log(' ', f));
console.log(`Total: ${updated.length} files`);
