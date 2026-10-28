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

function migrateReactNativeGradleCallbacks(contents) {
  const hash = createHash('sha256').update(contents).digest('hex');
  if (hash === '40ce11c7e23f3dacdc9c1f3b55beb2c3d038dc42395e777f38fc11ddd3102836') return contents;
  if (hash !== '3db99fbea567e6a582c8d88f64642e1a0be24a51b74f6acfece047ba72b9e23c') throw new Error('AGP 9: unbekannter React-Native-Gradle-Helfer; Migration erneut prüfen.');
  // RN 0.86 sweeps all libraries both from the app and from each RN library.
  // AGP 9 rejects duplicate finalizeDsl registrations after a library was
  // finalized. Register each existing root-wide sweep exactly once.
  for (const [name, key] of [
    ['configureBuildConfigFieldsForLibraries', 'caresuiteAgp9BuildConfigConfigured'],
    ['configureNamespaceForLibraries', 'caresuiteAgp9NamespaceConfigured'],
  ]) {
    const before = `  fun ${name}(appProject: Project) {\n`;
    const after = before + `    val registrationKey = "${key}"\n    if (appProject.rootProject.extensions.extraProperties.has(registrationKey)) return\n    appProject.rootProject.extensions.extraProperties.set(registrationKey, true)\n`;
    contents = contents.replace(before, after);
  }
  if (createHash('sha256').update(contents).digest('hex') !== '40ce11c7e23f3dacdc9c1f3b55beb2c3d038dc42395e777f38fc11ddd3102836') throw new Error('AGP 9: React-Native-Callback-Migration stimmt nicht mit der geprüften Quelle überein.');
  return contents;
}

function patchReactNativeGradleCallbacks(projectRoot) {
  const packageFile = require.resolve('@react-native/gradle-plugin/package.json', { paths: [projectRoot] });
  if (JSON.parse(readFileSync(packageFile, 'utf8')).version !== '0.86.3') throw new Error('AGP 9: React-Native-Gradle-Version wurde verändert; Migration erneut prüfen.');
  const file = join(dirname(packageFile), 'react-native-gradle-plugin/src/main/kotlin/com/facebook/react/utils/AgpConfiguratorUtils.kt');
  const original = readFileSync(file, 'utf8');
  const migrated = migrateReactNativeGradleCallbacks(original);
  if (migrated !== original) writeFileSync(file, migrated);
}

function migrateExpoGeneratedDirectories(contents) {
  const hash = createHash('sha256').update(contents).digest('hex');
  if (hash === '317b4220d2d664e377ada35e64fd50b839ede1240214c280e68923a33ff64049') return contents;
  if (hash !== '8f56cafd0c2e6927e02b4f4596af94f752bc8c9b9268cdf2cf562212bed02cdf') throw new Error('AGP 9: unbekannter Expo-Autolinking-Helfer; Migration erneut prüfen.');
  // These providers contain build-directory paths, not task outputs. The
  // existing preBuild.dependsOn(generatePackagesList) retains generation order.
  const result = contents.replace('.srcDirs(getPackageListDir(project), getInlineModulesDir(project))', '.srcDirs(getPackageListDir(project).get().asFile, getInlineModulesDir(project).get().asFile)');
  if (createHash('sha256').update(result).digest('hex') !== '317b4220d2d664e377ada35e64fd50b839ede1240214c280e68923a33ff64049') throw new Error('AGP 9: Expo-Quellenmigration stimmt nicht mit der geprüften Quelle überein.');
  return result;
}

function patchExpoGeneratedDirectories(projectRoot) {
  const packageFile = require.resolve('expo-modules-autolinking/package.json', { paths: [projectRoot] });
  if (JSON.parse(readFileSync(packageFile, 'utf8')).version !== '57.0.12') throw new Error('AGP 9: Expo-Autolinking-Version wurde verändert; Migration erneut prüfen.');
  const file = join(dirname(packageFile), 'android/expo-gradle-plugin/expo-autolinking-plugin/src/main/kotlin/expo/modules/plugin/ExpoAutolinkingPlugin.kt');
  const original = readFileSync(file, 'utf8');
  const migrated = migrateExpoGeneratedDirectories(original);
  if (migrated !== original) writeFileSync(file, migrated);
}

module.exports = { migrateExpoLibrarySdk, patchExpoLibrarySdk, migrateReactNativeGradleCallbacks, patchReactNativeGradleCallbacks, migrateExpoGeneratedDirectories, patchExpoGeneratedDirectories };
