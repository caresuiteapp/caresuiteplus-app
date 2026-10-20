#!/usr/bin/env node
/**
 * Platform capability audit — verifies multi-platform foundation files and config.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_FILES = [
  'app.config.ts',
  'eas.json',
  'src/lib/platform/platform.ts',
  'src/lib/platform/breakpoints.ts',
  'src/lib/platform/supportLinks.ts',
  'src/hooks/platform/useDeviceClass.ts',
  'src/hooks/platform/usePlatformLayout.ts',
  'src/components/layout/ResponsiveLayout.tsx',
  'src/components/layout/AdaptiveScreen.tsx',
  'src/components/layout/MasterDetailLayout.tsx',
  'src/components/layout/DesktopShell.tsx',
  'src/components/layout/TabletShell.tsx',
  'src/components/layout/MobileShell.tsx',
  'docs/platform/platform-strategy.md',
  'docs/platform/desktop-app-strategy.md',
  'docs/platform/web-desktop-security.md',
  'docs/platform/web-desktop-readiness.md',
  'docs/deployment/mobile-env-strategy.md',
  'docs/store/eas-build-preflight.md',
  'docs/store/build-commands.md',
  'docs/store/assets-readiness.md',
  'scripts/store-readiness-check.mjs',
];

function fail(message) {
  console.error(`\n✗ platform:audit fehlgeschlagen: ${message}\n`);
  process.exit(1);
}

console.log('CareSuite+ platform:audit\n');

const missing = REQUIRED_FILES.filter((rel) => !existsSync(join(root, rel)));
if (missing.length > 0) {
  fail(`Fehlende Dateien:\n  - ${missing.join('\n  - ')}`);
}

const appConfig = readFileSync(join(root, 'app.config.ts'), 'utf8');
if (!appConfig.includes('supportsTablet: true')) {
  fail('app.config.ts: iOS tablet support fehlt');
}
if (!appConfig.includes('de.caresuiteplus.app')) {
  fail('app.config.ts: Bundle-ID / Package fehlt');
}

const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
for (const profile of ['development', 'preview', 'production']) {
  if (!eas.build?.[profile]) {
    fail(`eas.json: Build-Profil "${profile}" fehlt`);
  }
}

console.log(`✓ ${REQUIRED_FILES.length} Plattform-Dateien vorhanden`);
console.log('✓ app.config.ts Tablet + Bundle-ID geprüft');
console.log('✓ eas.json Build-Profile development/preview/production\n');
