#!/usr/bin/env node
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const SNAP = '{ wp: number; domain: string; recordCount: number; labels: string[] }';

function patchFile(path, generic) {
  let src = readFileSync(path, 'utf8');
  if (src.includes('enforcePermission<')) return false;
  const next = src.replace(
    /const denied = enforcePermission\(([\s\S]*?)\);/,
    `const denied = enforcePermission<${generic}>($1);`,
  );
  if (next === src) return false;
  writeFileSync(path, next, 'utf8');
  return true;
}

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

let n = 0;
for (const file of walk(join(root, 'src/lib'))) {
  if (file.endsWith('ModuleService.ts') && patchFile(file, SNAP)) n++;
  if (file.endsWith('DashboardService.ts')) {
    const src = readFileSync(file, 'utf8');
    const m = src.match(/export type (\w+DashboardSnapshot)/);
    if (m && patchFile(file, m[1])) n++;
  }
  if (file.endsWith('officeDocumentsService.ts') && patchFile(file, '{ total: number; byCategory: Record<string, number>; items: OfficeDocumentItem[] }')) n++;
  if (file.endsWith('employeePortalService.ts') && patchFile(file, '{ openItems: number; announcements: string[] }')) n++;
  if (file.endsWith('clientPortalService.ts') && patchFile(file, '{ messages: number; requests: string[] }')) n++;
  if (file.endsWith('platformHubService.ts') && patchFile(file, '{ ocrJobs: number; aiCapabilities: string[] }')) n++;
  if (file.endsWith('integrationHubService.ts') && patchFile(file, '{ providers: number; outboxPending: number }')) n++;
}

for (const file of walk(join(root, 'src/hooks'))) {
  if (!file.endsWith('Module.ts')) continue;
  let src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  let changed = false;
  const out = lines.map((line) => {
    if (!line.includes("useState<Awaited<ReturnType<typeof fetch")) return line;
    changed = true;
    return `  const [data, setData] = useState<${SNAP} | null>(null);`;
  });
  if (changed) {
    writeFileSync(file, out.join('\n'), 'utf8');
    n++;
  }
}

console.log(`Patched ${n} files`);
