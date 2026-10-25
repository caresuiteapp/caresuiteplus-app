const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

const originalSha256 = 'a8a1a82a46c1d47d4201827d1fc1cdbcc4ca2e4a62f38973dc8a45267337663a';
const migratedSha256 = '0b7f9ec76122f4a8b56cb4983c5e64332450b6c0915d84f28ad7285dbf9b4578';

function migrateExpoLibrarySdk(contents) {
  const hash = createHash('sha256').update(contents).digest('hex');
  if (hash === migratedSha256) return contents;
  if (hash !== originalSha256) throw new Error('AGP 9: unbekannter Expo-Bibliotheks-SDK-Helfer; Migration erneut prüfen.');
  // LibraryDefaultConfig.targetSdk was removed in AGP 9. Lint.targetSdk has
  // existed since AGP 8.2. App targetSdk remains in android/app/build.gradle.
  const before = '  defaultConfig {\n    this@defaultConfig.minSdk = minSdk\n    this@defaultConfig.targetSdk = targetSdk\n  }';
  const after = '  defaultConfig {\n    this@defaultConfig.minSdk = minSdk\n  }\n  lint.targetSdk = targetSdk';
  const result = contents.replace(before, after);
  if (createHash('sha256').update(result).digest('hex') !== migratedSha256) throw new Error('AGP 9: Expo-SDK-Migration stimmt nicht mit der geprüften Quelle überein.');
  return result;
}

function patchExpoLibrarySdk(projectRoot) {
  const packageFile = require.resolve('expo-modules-core/package.json', { paths: [projectRoot] });
  if (JSON.parse(readFileSync(packageFile, 'utf8')).version !== '57.0.16') throw new Error('AGP 9: Expo-Core-Version wurde verändert; SDK-Migration erneut prüfen.');
  const file = join(dirname(packageFile), 'expo-module-gradle-plugin/src/main/kotlin/expo/modules/plugin/android/AndroidLibraryExtension.kt');
  const original = readFileSync(file, 'utf8');
  const migrated = migrateExpoLibrarySdk(original);
  if (migrated !== original) writeFileSync(file, migrated);
}

module.exports = { migrateExpoLibrarySdk, patchExpoLibrarySdk };
