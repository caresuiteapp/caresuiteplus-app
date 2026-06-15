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
  if (!s.includes('CareLightListHeroFrame')) continue;
  if (!s.includes('StyleSheet.create') && !s.includes('<View')) continue;

  if (!s.includes("from 'react-native'")) {
    s = `import { StyleSheet, Text, View } from 'react-native';\n${s}`;
  }

  s = s.replace(/moduleColor\('ti'\)/g, 'careLightColors.cyan');

  if (filePath.includes(`${join('', 'ti')}`) || filePath.includes('\\ti\\')) {
    s = s.replace(/const accent = moduleColor\('office'\);/, 'const accent = careLightColors.cyan;');
  }

  writeFileSync(filePath, s);
  console.log('fixed', filePath.replace(root, ''));
}
