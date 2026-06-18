import fs from 'node:fs';
import path from 'node:path';

const replacements = [
  [/<PremiumBadge label="preparedOnly" variant="muted" dot \/>/g, '<PremiumBadge statusKind="preparedOnly" dot />'],
  [/<PremiumBadge label="preparedOnly" variant="muted" \/>/g, '<PremiumBadge statusKind="preparedOnly" />'],
  [/<PremiumBadge label="Live Supabase" variant="green" dot \/>/g, '<PremiumBadge statusKind="live" dot />'],
  [/<PremiumBadge label="Live Supabase" variant="green" \/>/g, '<PremiumBadge statusKind="live" />'],
  [/<PremiumBadge label="Demo \/ preparedOnly" variant="muted" \/>/g, '<PremiumBadge statusKind="preparedOnly" />'],
  [/<PremiumBadge label="Demo \/ preparedOnly" variant="muted" dot \/>/g, '<PremiumBadge statusKind="preparedOnly" dot />'],
];

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      walk(full, acc);
    } else if (/\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const roots = ['src/components', 'src/screens'];
let changed = 0;

for (const root of roots) {
  for (const file of walk(root)) {
    const src = fs.readFileSync(file, 'utf8');
    let next = src;
    for (const [pattern, replacement] of replacements) {
      next = next.replace(pattern, replacement);
    }
    if (next !== src) {
      fs.writeFileSync(file, next);
      changed += 1;
      console.log(path.relative(process.cwd(), file));
    }
  }
}

console.log(`Changed files: ${changed}`);
