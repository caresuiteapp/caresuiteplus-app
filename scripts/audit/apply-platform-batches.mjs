#!/usr/bin/env node
/**
 * Apply platform statement batches via Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN (or logged-in supabase CLI session).
 *
 * Usage:
 *   node scripts/audit/apply-platform-batches.mjs --confirm --project-ref=shwpweerzsfkqaivmaoc
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const batchDir = path.join(root, 'scripts/audit/.platform-statement-batches');

function parseArgs(argv) {
  const confirm = argv.includes('--confirm');
  const projectRefArg = argv.find((a) => a.startsWith('--project-ref='));
  const projectRef = projectRefArg?.split('=')[1] ?? 'shwpweerzsfkqaivmaoc';
  return { confirm, projectRef };
}

async function executeSql(projectRef, query) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error('SUPABASE_ACCESS_TOKEN fehlt');
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return text;
}

async function main() {
  const { confirm, projectRef } = parseArgs(process.argv.slice(2));
  const files = fs.readdirSync(batchDir).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    console.error('Keine Batches in', batchDir);
    process.exit(1);
  }

  console.log(`Project: ${projectRef}`);
  console.log(`Batches: ${files.length}`);
  if (!confirm) {
    console.log('\nDry-run. Anwenden mit --confirm');
    return;
  }

  for (const file of files) {
    const sql = fs.readFileSync(path.join(batchDir, file), 'utf8');
    console.log(`→ ${file} (${sql.length} bytes)`);
    await executeSql(projectRef, sql);
    console.log('  OK');
  }
  console.log('\nFertig.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
