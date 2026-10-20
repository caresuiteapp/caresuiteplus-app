#!/usr/bin/env node
/**
 * One-shot migration: move shared constants/stats out of src/data/demo/
 * and rewrite imports across the codebase.
 */
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const demoDir = path.join(root, 'src/data/demo');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function write(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function copyDemoFile(srcName, destRel) {
  write(destRel, read(`src/data/demo/${srcName}`));
}

// --- Create constant files ---
const rolesSrc = read('src/data/demo/roles.ts');
const roleLabelsMatch = rolesSrc.match(/export const ROLE_LABELS[\s\S]*?};/);
write(
  'src/data/constants/roleLabels.ts',
  `import type { RoleKey } from '@/types';\n\n${roleLabelsMatch?.[0] ?? ''}\n`,
);

write('src/lib/permissions/staticRolePermissions.ts', read('src/data/demo/permissions.ts'));

const navSrc = read('src/data/demo/navigation.ts');
write(
  'src/data/navigation/moduleNavConfig.ts',
  navSrc
    .replace(
      '/** @deprecated Use APP_START_ENTRIES for public landing; DEV_TOOL_ENTRIES for internal nav. */\nexport const PUBLIC_ENTRIES: NavigationEntry[] = DEV_TOOL_ENTRIES;\n\nexport const DEMO_LOGIN_ROLES',
      '/** @deprecated Use APP_START_ENTRIES for public landing; DEV_TOOL_ENTRIES for internal nav. */\nexport const PUBLIC_ENTRIES: NavigationEntry[] = DEV_TOOL_ENTRIES;\n\n/** @deprecated Demo login removed — kept for legacy test references only. */\nexport const DEMO_LOGIN_ROLES',
    ),
);

const productLabelsMatch = read('src/data/demo/products.ts').match(
  /export const PRODUCT_LABELS[\s\S]*?};/,
);
write(
  'src/data/constants/productLabels.ts',
  `import type { ProductKey } from '@/types';\n\n${productLabelsMatch?.[0] ?? ''}\n`,
);

write(
  'src/data/constants/testTenant.ts',
  `/** Legacy demo tenant id — tests and dev-tool previews only, never a live fallback. */\nexport const TEST_TENANT_ID = 'tenant-demo-001';\n\n/** @deprecated Use TEST_TENANT_ID */\nexport const DEMO_TENANT_ID = TEST_TENANT_ID;\n`,
);

write(
  'src/data/constants/index.ts',
  `export { ROLE_LABELS } from './roleLabels';\nexport { PRODUCT_LABELS } from './productLabels';\nexport { TEST_TENANT_ID, DEMO_TENANT_ID } from './testTenant';\n`,
);

// --- Copy list stats to domain libs ---
const statsMap = {
  'clientListStats.ts': 'src/lib/office/clientListStats.ts',
  'invoiceListStats.ts': 'src/lib/office/invoiceListStats.ts',
  'employeeListStats.ts': 'src/lib/office/employeeListStats.ts',
  'appointmentListStats.ts': 'src/lib/office/appointmentListStats.ts',
  'officeMessageListStats.ts': 'src/lib/office/officeMessageListStats.ts',
  'officeDocumentListStats.ts': 'src/lib/office/officeDocumentListStats.ts',
  'executionListStats.ts': 'src/lib/assist/executionListStats.ts',
  'assignmentListStats.ts': 'src/lib/assist/assignmentListStats.ts',
  'tripListStats.ts': 'src/lib/assist/tripListStats.ts',
  'carePlanListStats.ts': 'src/lib/pflege/carePlanListStats.ts',
  'vitalListStats.ts': 'src/lib/pflege/vitalListStats.ts',
  'courseListStats.ts': 'src/lib/akademie/courseListStats.ts',
  'caseListStats.ts': 'src/lib/beratung/caseListStats.ts',
  'residentListStats.ts': 'src/lib/stationaer/residentListStats.ts',
  'communicationListStats.ts': 'src/lib/communication/communicationListStats.ts',
  'reportListStats.ts': 'src/lib/reporting/reportListStats.ts',
};

for (const [src, dest] of Object.entries(statsMap)) {
  copyDemoFile(src, dest);
}

// --- Import rewrite rules (order matters — specific before general) ---
const replacements = [
  ["from '@/data/demo/permissions'", "from '@/lib/permissions/staticRolePermissions'"],
  ["from '@/data/demo/navigation'", "from '@/data/navigation/moduleNavConfig'"],
  ["from '@/data/demo/roles'", "from '@/data/constants/roleLabels'"],
  ["from '@/data/demo/products'", "from '@/data/constants/productLabels'"],
  ["from '@/data/demo/tenant'", "from '@/data/constants/testTenant'"],
  ...Object.entries(statsMap).map(([src, dest]) => [
    `from '@/data/demo/${src.replace('.ts', '')}'`,
    `from '@/${dest.replace(/^src\//, '').replace('.ts', '')}'`,
  ]),
  ["from '@/data/demo'", "from '@/data/constants'"],
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'demo') continue;
      walk(full, files);
    } else if (/\.(ts|tsx|mjs)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

let changed = 0;
for (const file of walk(path.join(root, 'src'))) {
  let src = fs.readFileSync(file, 'utf8');
  const original = src;
  for (const [from, to] of replacements) {
    src = src.split(from).join(to);
  }
  if (src !== original) {
    fs.writeFileSync(file, src);
    changed++;
  }
}

console.log(`Migrated constants; updated imports in ${changed} files.`);
