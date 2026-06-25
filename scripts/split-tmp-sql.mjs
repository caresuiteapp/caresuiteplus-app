import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = readdirSync(root).filter((f) => f.startsWith('.tmp-0167') && f.endsWith('.sql'));

for (const file of files) {
  const src = readFileSync(join(root, file), 'utf8');
  const valuesIdx = src.indexOf('VALUES');
  const header = src.slice(0, valuesIdx + 6);
  const body = src.slice(valuesIdx + 6).replace(/ON CONFLICT \(id\) DO NOTHING;/, '').trim();
  const rows = body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const tail = 'ON CONFLICT (id) DO NOTHING;';
  const base = file.replace('.sql', '');
  let idx = 0;
  for (let i = 0; i < rows.length; i += 25) {
    const slice = rows.slice(i, i + 25);
    const chunk = slice
      .map((row, j) => (j === slice.length - 1 ? row.replace(/,\s*$/, '') : row))
      .join('\n');
    writeFileSync(join(root, `.tmp-chunk-${base}-${String(idx).padStart(2, '0')}.sql`), `${header}\n\n${chunk}\n${tail}`);
    idx++;
  }
  console.log(file, rows.length, 'rows =>', idx, 'chunks');
}
