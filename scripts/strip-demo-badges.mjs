#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['node_modules', '.git', '.expo-resolve-test'].includes(ent.name)) continue;
      walk(p, acc);
    } else if (/\.(tsx|ts)$/.test(ent.name)) {
      acc.push(p);
    }
  }
  return acc;
}

const badgeRes = [
  /\r?\n[ \t]*\{isDemoMode\(\) \? <PremiumBadge label="Demo-Modus" variant="cyan" \/> : null\}/g,
  /\r?\n[ \t]*\{isDemoMode\(\) \? <PremiumBadge label="Demo-Modus" variant="orange" \/> : null\}/g,
  /\r?\n[ \t]*\{showDemoBadge \? <PremiumBadge label="Demo-Modus" variant="cyan" \/> : null\}/g,
];

let changed = 0;
for (const file of walk(path.join(root, 'src'))) {
  let src = fs.readFileSync(file, 'utf8');
  const orig = src;
  for (const re of badgeRes) src = src.replace(re, '');

  if (src.includes('isDemoMode') && !src.includes('isDemoMode(')) {
    src = src.replace(/import \{([^}]*)\} from '@\/lib\/supabase\/config';/g, (m, inner) => {
      const parts = inner
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((x) => x !== 'isDemoMode');
      if (!parts.length) return '';
      return `import { ${parts.join(', ')} } from '@/lib/supabase/config';`;
    });
  }

  if (src !== orig) {
    fs.writeFileSync(file, src);
    changed += 1;
  }
}

console.log(`strip-demo-badges: updated ${changed} files`);
