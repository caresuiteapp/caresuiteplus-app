import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { migrateExpoLibrarySdk } = require('../plugins/androidAgp9Compatibility.cjs');

test('the locked Expo library helper retains SDK bounds and migrates its removed library-only target setter', () => {
  const root = dirname(require.resolve('expo-modules-core/package.json'));
  const source = readFileSync(join(root, 'expo-module-gradle-plugin/src/main/kotlin/expo/modules/plugin/android/AndroidLibraryExtension.kt'), 'utf8');
  const result = migrateExpoLibrarySdk(source);
  assert.match(result, /this\.compileSdk = compileSdk/);
  assert.match(result, /this@defaultConfig\.minSdk = minSdk/);
  assert.match(result, /lint\.targetSdk = targetSdk/);
  assert.doesNotMatch(result, /this@defaultConfig\.targetSdk/);
  assert.equal(migrateExpoLibrarySdk(result), result);
  assert.throws(() => migrateExpoLibrarySdk(source + '\n// changed upstream'), /unbekannter Expo/);
});
