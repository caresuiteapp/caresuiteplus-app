import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = join(root, 'app');

const MODULES = ['assist', 'pflege', 'beratung', 'stationaer', 'akademie', 'communication', 'office', 'qm', 'portal'];

function buildExportMap(moduleName) {
  const indexPath = join(root, 'src/screens', moduleName, 'index.ts');
  if (!existsSync(indexPath)) return {};
  const src = readFileSync(indexPath, 'utf8');
  const map = {};
  for (const match of src.matchAll(/export \{ (\w+) \} from '\.\/(\w+)'/g)) {
    map[match[1]] = `@/screens/${moduleName}/${match[2]}`;
  }
  return map;
}

const exportMaps = Object.fromEntries(MODULES.map((m) => [m, buildExportMap(m)]));

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (name.endsWith('.tsx')) files.push(full);
  }
  return files;
}

let changed = 0;
for (const file of walk(appRoot)) {
  let src = readFileSync(file, 'utf8');
  const original = src;
  for (const moduleName of MODULES) {
    const re = new RegExp(`import \\{([^}]+)\\} from '@\\/screens\\/${moduleName}';`, 'g');
    src = src.replace(re, (full, names) => {
      const map = exportMaps[moduleName];
      if (!map || Object.keys(map).length === 0) return full;
      const parts = names.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length !== 1) return full;
      const name = parts[0].split(' as ')[0].trim();
      const path = map[name];
      if (!path) return full;
      return `import { ${parts[0]} } from '${path}';`;
    });
  }
  if (src !== original) {
    writeFileSync(file, src);
    changed += 1;
  }
}

console.log(`Fixed barrel imports in ${changed} route files`);
