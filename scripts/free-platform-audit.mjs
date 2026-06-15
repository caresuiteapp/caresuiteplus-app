#!/usr/bin/env node
/**
 * CareSuite+ Free Platform Strategy audit
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_FILES = [
  'supabase/migrations/0038_free_platform_strategy.sql',
  'src/lib/billing/freePlatformService.ts',
  'src/lib/billing/moduleActivationService.ts',
  'src/lib/billing/productAccessService.ts',
  'src/components/billing/PremiumPreparedNotice.tsx',
  'scripts/free-platform-audit.mjs',
  'docs/audit/free-platform-strategy-report.md',
];

const FORBIDDEN_PATTERNS = [
  { pattern: /Modul kaufen/gi, context: 'main flows' },
  { pattern: /Kaufen(?!los)/gi, context: 'purchase buttons' },
  { pattern: /checkout/i, context: 'checkout flows in registration' },
];

const REQUIRED_PATTERNS = [
  { file: 'src/lib/billing/freePlatformService.ts', pattern: 'isFreePlatformEnabled' },
  { file: 'src/lib/billing/moduleActivationService.ts', pattern: 'activateFreeModuleForTenant' },
  { file: 'src/lib/billing/productAccessService.ts', pattern: 'canAccessModule' },
  { file: 'src/screens/auth/BusinessRegisterScreen.tsx', pattern: 'Kostenlos registrieren' },
  { file: 'src/components/modules/ModuleCard.tsx', pattern: 'Kostenlos aktivieren' },
  { file: 'src/screens/business/SubscriptionScreen.tsx', pattern: 'Free Platform' },
  { file: 'src/screens/AppStartScreen.tsx', pattern: 'kostenlos' },
  { file: 'package.json', pattern: 'free-platform:audit' },
];

function fail(message) {
  console.error(`\n✗ free-platform:audit fehlgeschlagen: ${message}\n`);
  process.exit(1);
}

function walk(dir, exts, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      walk(full, exts, files);
    } else if (entry.isFile() && exts.some((ext) => entry.name.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

console.log('CareSuite+ free-platform:audit\n');

const missing = REQUIRED_FILES.filter((rel) => !existsSync(join(root, rel)));
if (missing.length > 0) {
  fail(`Fehlende Dateien:\n  - ${missing.join('\n  - ')}`);
}

for (const { file, pattern } of REQUIRED_PATTERNS) {
  const content = readFileSync(join(root, file), 'utf8');
  if (!content.includes(pattern)) {
    fail(`${file}: erwartetes Muster „${pattern}" fehlt`);
  }
}

const migration = readFileSync(join(root, 'supabase/migrations/0038_free_platform_strategy.sql'), 'utf8');
for (const term of ['free_platform_enabled', 'free_active', 'free_available', 'premium_prepared', 'price_cents']) {
  if (!migration.includes(term)) {
    fail(`Migration 0038: Spalte/Status „${term}" fehlt`);
  }
}

const mainFlowFiles = [
  'src/screens/auth/BusinessRegisterScreen.tsx',
  'src/screens/ModuleOverviewScreen.tsx',
  'src/screens/business/SubscriptionScreen.tsx',
  'src/components/modules/ModuleCard.tsx',
  'src/screens/AppStartScreen.tsx',
].map((f) => join(root, f));

for (const file of mainFlowFiles) {
  const content = readFileSync(file, 'utf8');
  if (/Modul kaufen/i.test(content)) {
    fail(`${file}: verbotener Text „Modul kaufen"`);
  }
}

const registerScreen = readFileSync(join(root, 'src/screens/auth/BusinessRegisterScreen.tsx'), 'utf8');
if (registerScreen.includes('trialOrPurchase') || registerScreen.includes('Zahlung')) {
  fail('BusinessRegisterScreen: Payment/Trial-Schritte noch vorhanden');
}

console.log(`✓ ${REQUIRED_FILES.length} Free-Platform-Dateien vorhanden`);
console.log('✓ Migration 0038 Spalten/Status geprüft');
console.log('✓ Hauptflows ohne „Modul kaufen" / Payment-Schritte');
console.log('✓ Kern-Services und UI-Muster vorhanden\n');
