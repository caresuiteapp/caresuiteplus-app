#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { M_WP_CATALOG } from './wp-m-catalog.mjs';
import { isSubstantiveDeliverable, gradeWp } from './wp-substance.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function exists(rel) {
  return existsSync(join(root, rel.replace(/\//g, '\\')));
}

const catalog501 = M_WP_CATALOG.filter((e) => e.wp >= 501 && e.wp <= 600);
const deliverableCounts = {};
for (const e of M_WP_CATALOG) {
  deliverableCounts[e.deliverable] = (deliverableCounts[e.deliverable] ?? 0) + 1;
}
const grades = catalog501.map((entry) => {
  if (!exists(entry.deliverable)) return { wp: entry.wp, s: 'M' };
  const g = gradeWp(root, entry, deliverableCounts);
  return {
    wp: entry.wp,
    s: g.score >= 100 ? 'D' : g.score >= 50 ? 'P' : 'M',
  };
});

const c = { D: 0, P: 0, M: 0 };
grades.forEach((g) => c[g.s]++);

console.log('=== CareSuite+ Audit WP 501–600 ===\n');
console.log(`D (vollständig): ${c.D}`);
console.log(`P (teilweise):   ${c.P}`);
console.log(`M (fehlt):       ${c.M}`);
console.log(`Gesamt:          ${grades.length}`);
console.log(`Katalog-Einträge: ${catalog501.length}\n`);

for (let sec = 26; sec <= 30; sec++) {
  const start = 480 + (sec - 25) * 20 + 1;
  const rs = grades.filter((g) => g.wp >= start && g.wp < start + 20);
  const cc = { D: 0, P: 0, M: 0 };
  rs.forEach((r) => cc[r.s]++);
  console.log(
    `WP${String(start).padStart(3, '0')}-${String(start + 19).padStart(3, '0')}: ${rs.map((r) => r.s[0]).join('')} | D=${cc.D} P=${cc.P} M=${cc.M}`,
  );
}

const missing = grades.filter((g) => g.s === 'M');
if (missing.length) {
  console.log(`\nVerbleibende M (${missing.length}):`);
  missing.forEach((x) => console.log(`  WP${String(x.wp).padStart(3, '0')}`));
}

process.exit(c.M > 0 ? 1 : 0);
