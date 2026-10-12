#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const config = JSON.parse(execFileSync(process.execPath, [require.resolve('expo/bin/cli'), 'config', '--type', 'introspect', '--json'], {
  encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
  env: { ...process.env, EXPO_PUBLIC_APP_EDITION: 'full', EXPO_PUBLIC_FOLDER: 'public-portal' },
}));
const properties = new Map(config._internal.modResults.android.gradleProperties.filter(x => x.type === 'property').map(x => [x.key, x.value]));
const rules = readFileSync('android-proguard-rules.pro', 'utf8').replace(/^\s*#.*$/gm, '');
const { optimizeAppBuildGradle } = require('../plugins/withAndroidReleaseOptimization.cjs');
const template = execFileSync('tar', ['-xOf', require.resolve('expo/template.tgz'), 'package/android/app/build.gradle'], { encoding: 'utf8' });
const optimized = optimizeAppBuildGradle(template);
const dependencies = JSON.parse(readFileSync('package.json', 'utf8')).dependencies;
const image = readFileSync('src/components/images/CareSuiteImage.native.tsx', 'utf8');
const checks = {
  fullEdition: config.extra.router.root === 'app' && config.extra.runtime.appEdition === 'full',
  minimumCode41: config.android.versionCode >= 41,
  minify: properties.get('android.enableMinifyInReleaseBuilds') === 'true',
  shrinkResources: properties.get('android.enableShrinkResourcesInReleaseBuilds') === 'true',
  fullMode: properties.get('android.enableR8.fullMode') === 'true',
  optimizedResourceShrinking: properties.get('android.r8.optimizedResourceShrinking') === 'true',
  optimizedStandardRules: optimized.includes('getDefaultProguardFile("proguard-android-optimize.txt")') && !optimized.includes('getDefaultProguardFile("proguard-android.txt")'),
  noAppBlanketKeeps: !/^-keep(?:,[\w]+)*\s+(?:public\s+)?class\s+\S*\*\*/m.test(rules),
  noDisabledOptimizations: !/^-(?:dontoptimize|dontshrink|dontobfuscate)\b/m.test(rules),
  managedImageDependency: /^~?57\./.test(dependencies['expo-image'] ?? ''),
  imageDownscaling: image.includes('allowDownscaling') && image.includes("from 'expo-image'"),
  privateImagesNotDiskCached: image.includes('cachePolicy="memory"'),
};
const failed = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key);
console.log(JSON.stringify({ status: failed.length ? 'failed' : 'ok', checks, scope: 'native release configuration; device heap and final R8 artifact must also be checked' }, null, 2));
if (failed.length) throw new Error(`Android-Leistungsprüfung fehlgeschlagen: ${failed.join(', ')}`);
