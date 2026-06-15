#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'src/lib/documents');

const FIXES = {
  'business.dashboard.view': 'dashboard.view',
  'office.view': 'office.access',
  'portal.employee.view': 'portal.employee.profile.view',
  'portal.client.view': 'portal.client.profile.view',
  'pflege.view': 'pflege.access',
  'stationaer.view': 'stationaer.access',
  'beratung.view': 'beratung.access',
  'akademie.view': 'akademie.access',
  'business.platform.view': 'platform.ocr.view',
  'business.integrations.view': 'integrations.view',
  'assist.care_records.view': 'assist.records.view',
};

for (const file of readdirSync(dir)) {
  if (!file.endsWith('DocumentService.ts')) continue;
  const path = join(dir, file);
  let content = readFileSync(path, 'utf8');
  for (const [from, to] of Object.entries(FIXES)) {
    content = content.replaceAll(`'${from}'`, `'${to}'`);
  }
  writeFileSync(path, content, 'utf8');
}
console.log('Document service permissions fixed.');
