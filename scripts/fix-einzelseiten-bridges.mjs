#!/usr/bin/env node
/** Fix generated bridge files with invalid Redirect href syntax. */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const appRoot = join(process.cwd(), 'app');

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (name.endsWith('.tsx')) files.push(full);
  }
  return files;
}

let fixed = 0;
for (const file of walk(appRoot)) {
  const src = readFileSync(file, 'utf8');
  if (!src.includes('Einzelseiten-Bridge:')) continue;
  let next = src
    .replace(/href="([^"]+)" as never/g, "href={'$1' as never}")
    .replace(/params: \{ id: value, id: value \}/g, 'params: { id: value }');
  if (next !== src) {
    writeFileSync(file, next, 'utf8');
    fixed += 1;
  }
}
console.log(`Fixed ${fixed} bridge files`);
