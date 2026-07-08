#!/usr/bin/env node
/**
 * Split platform migration SQL into executable chunks for MCP execute_sql.
 * Usage: node scripts/audit/split-platform-migration.mjs 0246
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const file = process.argv[2] ?? '0246_platform_console_foundation_live.sql';
const sql = fs.readFileSync(path.join(root, 'supabase/migrations', file), 'utf8');

const chunks = sql
  .split(/(?=-- --------------------------------------------------------------------------)/g)
  .map((c) => c.trim())
  .filter(Boolean);

const outDir = path.join(root, 'scripts/audit/.platform-chunks');
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) {
  if (f.endsWith('.sql')) fs.unlinkSync(path.join(outDir, f));
}

chunks.forEach((chunk, i) => {
  const name = `${String(i + 1).padStart(2, '0')}.sql`;
  fs.writeFileSync(path.join(outDir, name), chunk);
});

console.log(JSON.stringify({ file, chunks: chunks.length, outDir }));
