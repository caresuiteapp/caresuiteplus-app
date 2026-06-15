#!/usr/bin/env node
/**
 * Regenerates Expo Router typed routes (.expo/types/router.d.ts).
 * Ensures EXPO_ROUTER_APP_ROOT points at app/ so src/ paths are not included.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

process.env.EXPO_ROUTER_APP_ROOT = join(root, 'app');

const { EXPO_ROUTER_CTX_IGNORE } = require('expo-router/_ctx-shared');
const requireContext = require('expo-router/build/testing-library/require-context-ponyfill').default;
const { getTypedRoutesDeclarationFile } = require('expo-router/build/typed-routes/generate');

const ctx = requireContext(process.env.EXPO_ROUTER_APP_ROOT, true, EXPO_ROUTER_CTX_IGNORE);
const invalidKeys = ctx.keys().filter((key) => key.includes('../'));

if (invalidKeys.length > 0) {
  console.error('Expo Router context enthält ungültige Pfade außerhalb von app/:');
  invalidKeys.slice(0, 10).forEach((key) => console.error(`  - ${key}`));
  process.exit(1);
}

const declaration = getTypedRoutesDeclarationFile(ctx, {});
if (!declaration?.includes('hrefInputParams')) {
  console.error('Generierte router.d.ts ist unvollständig.');
  process.exit(1);
}

const typesDir = resolve(root, '.expo', 'types');
mkdirSync(typesDir, { recursive: true });
writeFileSync(join(typesDir, 'router.d.ts'), declaration, 'utf8');

console.log(`✓ Expo Router types regenerated (${ctx.keys().length} routes)`);
