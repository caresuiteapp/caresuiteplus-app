#!/usr/bin/env node
import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = join(root, 'app');

function walk(dir) {
  const conflicts = [];
  if (!existsSync(dir)) return conflicts;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      conflicts.push(...walk(full));
      const name = entry.name;
      if (name.startsWith('(') || name.startsWith('[')) continue;
      const siblingTsx = join(dir, `${name}.tsx`);
      if (existsSync(siblingTsx)) {
        conflicts.push({
          folder: full.replace(/\\/g, '/').replace(root.replace(/\\/g, '/') + '/', ''),
          file: siblingTsx.replace(/\\/g, '/').replace(root.replace(/\\/g, '/') + '/', ''),
        });
      }
    }
  }
  return conflicts;
}

const conflicts = walk(appRoot);
console.log(JSON.stringify(conflicts, null, 2));
console.log('Total:', conflicts.length);
process.exit(conflicts.length > 0 ? 1 : 0);
