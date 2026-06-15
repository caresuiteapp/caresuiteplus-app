#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'components');

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, files);
    else if (name.endsWith('ListHero.tsx')) files.push(p);
  }
  return files;
}

for (const filePath of walk(root)) {
  let s = readFileSync(filePath, 'utf8');
  if (!s.includes('CareLightKpiCard')) continue;
  const next = s.replace(/value=\{kpi\.value\}/g, 'value={String(kpi.value)}');
  if (next !== s) {
    writeFileSync(filePath, next);
    console.log('fixed', filePath.replace(root, ''));
  }
}
