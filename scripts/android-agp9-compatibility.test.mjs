import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { migrateExpoLibrarySdk, migrateReactNativeGradleCallbacks, migrateExpoGeneratedDirectories } = require('../plugins/androidAgp9Compatibility.cjs');

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

test('the locked RN Gradle plugin registers each root-wide library sweep once without dropping library configuration', () => {
  const root = dirname(require.resolve('@react-native/gradle-plugin/package.json'));
  const source = readFileSync(join(root, 'react-native-gradle-plugin/src/main/kotlin/com/facebook/react/utils/AgpConfiguratorUtils.kt'), 'utf8');
  const result = migrateReactNativeGradleCallbacks(source);
  for (const key of ['caresuiteAgp9BuildConfigConfigured', 'caresuiteAgp9NamespaceConfigured']) assert.match(result, new RegExp(key));
  assert.match(result, /finalizeDsl \{ ext -> ext\.buildFeatures\.buildConfig = true \}/);
  assert.match(result, /fun configureNamespaceForLibraries\(appProject: Project\)/);
  assert.equal(migrateReactNativeGradleCallbacks(result), result);
  assert.throws(() => migrateReactNativeGradleCallbacks(source + '\n// different SDK'), /unbekannter React-Native/);
});

test('Expo generated source directories use concrete paths while retaining the explicit generation dependency', () => {
  const root = dirname(require.resolve('expo-modules-autolinking/package.json'));
  const source = readFileSync(join(root, 'android/expo-gradle-plugin/expo-autolinking-plugin/src/main/kotlin/expo/modules/plugin/ExpoAutolinkingPlugin.kt'), 'utf8');
  const result = migrateExpoGeneratedDirectories(source);
  assert.match(result, /srcDirs\(getPackageListDir\(project\)\.get\(\)\.asFile, getInlineModulesDir\(project\)\.get\(\)\.asFile\)/);
  assert.match(result, /named\("preBuild", Task::class\.java\)\s*\.dependsOn\(generatePackagesList\)/);
  assert.equal(migrateExpoGeneratedDirectories(result), result);
  assert.throws(() => migrateExpoGeneratedDirectories(source + '\n// different SDK'), /unbekannter Expo-Autolinking/);
});
