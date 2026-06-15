#!/usr/bin/env node
/** Extrahiert Types aus Supabase MCP JSON-Antwort und schreibt types.ts + database.types.ts */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/write-generated-types.mjs <mcp-types-json-file>');
  process.exit(1);
}

const raw = fs.readFileSync(inputPath, 'utf8');
const parsed = JSON.parse(raw);
const types = parsed.types ?? parsed;
if (typeof types !== 'string') {
  console.error('No types string in input');
  process.exit(1);
}

const banner = '/** Auto-generated — do not edit. Run: npm run fetch-remote-types */\n';
const content = banner + types;
const targets = [path.join(root, 'src/lib/supabase/database.types.ts')];

for (const target of targets) {
  fs.writeFileSync(target, content);
  console.log(`Wrote ${target}`);
}
