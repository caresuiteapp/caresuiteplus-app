import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase/migrations');
const sql = readFileSync(join(dir, '0167_assist_catalog_items_and_template_entries.sql'), 'utf8');
const [head, entriesBlock] = sql.split('INSERT INTO public.catalog_entries');
const valuesStart = head.indexOf(') VALUES');
const prefix = head.slice(0, valuesStart + 9);
const suffix = head.slice(head.lastIndexOf('ON CONFLICT'));
const valuesBody = head.slice(valuesStart + 9, head.lastIndexOf('ON CONFLICT')).trim();
const rows = valuesBody
  .split('),\n(')
  .map((r, i, a) => (i === 0 ? `${r})` : i === a.length - 1 ? `(${r}` : `(${r})`));

const chunkSize = 100;
for (let i = 0, part = 0; i < rows.length; i += chunkSize, part += 1) {
  const chunk = rows.slice(i, i + chunkSize);
  writeFileSync(join(dir, `0167a${part}_items.sql`), `${prefix}\n${chunk.join(',\n')}\n${suffix};\n`);
}
writeFileSync(join(dir, '0167b_entries.sql'), `INSERT INTO public.catalog_entries${entriesBlock}`);
console.log(JSON.stringify({ parts: Math.ceil(rows.length / chunkSize), rows: rows.length }));
