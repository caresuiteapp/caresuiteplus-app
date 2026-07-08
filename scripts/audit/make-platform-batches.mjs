import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const out = path.join(root, 'scripts/audit/.platform-batches');
fs.mkdirSync(out, { recursive: true });

const sql246 = fs.readFileSync(
  path.join(root, 'supabase/migrations/0246_platform_console_foundation_live.sql'),
  'utf8',
);
const parts = 4;
const len = Math.ceil(sql246.length / parts);
for (let i = 0; i < parts; i += 1) {
  const part = sql246.slice(i * len, (i + 1) * len);
  fs.writeFileSync(path.join(out, `batch-246-${i + 1}.sql`), part);
  console.log(`batch-246-${i + 1}`, part.length);
}

const sql247 = fs.readFileSync(
  path.join(root, 'supabase/migrations/0247_platform_tenant_module_access_live.sql'),
  'utf8',
);
fs.writeFileSync(path.join(out, 'batch-247.sql'), sql247);
console.log('batch-247', sql247.length);
