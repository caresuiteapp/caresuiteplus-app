import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const { optimizeAppBuildGradle, configureProjectBuildGradle } = require('../../../plugins/withAndroidReleaseOptimization.cjs');
describe('R8 optimized release generation', () => {
  it('migrates the installed Expo project template to AGP 9 without changing repositories or React Native wiring', () => {
    const template = execFileSync('tar', ['-xOf', require.resolve('expo/template.tgz'), 'package/android/build.gradle'], { encoding: 'utf8' });
    const result = configureProjectBuildGradle(template);
    expect(result).toContain("classpath('com.android.tools.build:gradle:9.0.1')");
    expect(result).toContain("classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.10')");
    expect(result.replace(':gradle:9.0.1', ':gradle').replace(':kotlin-gradle-plugin:2.2.10', ':kotlin-gradle-plugin')).toBe(template);
    expect(configureProjectBuildGradle(result)).toBe(result);
  });
  it.each([
    "classpath('com.android.tools.build:gradle')",
    "classpath('com.android.tools.build:gradle') classpath('com.android.tools.build:gradle') classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')",
  ])('rejects missing or ambiguous project classpaths: %s', value => {
    expect(() => configureProjectBuildGradle(value)).toThrow();
  });
  it('uses the actual installed Expo Android template and preserves release minification/signing', () => {
    const template = execFileSync('tar', ['-xOf', require.resolve('expo/template.tgz'), 'package/android/app/build.gradle'], { encoding: 'utf8' });
    const result = optimizeAppBuildGradle(template);
    expect(result).toContain('getDefaultProguardFile("proguard-android-optimize.txt")');
    expect(result).toContain('minifyEnabled enableMinifyInReleaseBuilds');
    expect(result).toContain('shrinkResources enableShrinkResources.toBoolean()');
    expect(result.replace('proguard-android-optimize.txt', 'proguard-android.txt')).toBe(template);
    expect(optimizeAppBuildGradle(result)).toBe(result);
  });
  it.each(['no default rules', 'getDefaultProguardFile("unknown.txt")', 'getDefaultProguardFile("proguard-android.txt") getDefaultProguardFile("proguard-android.txt")'])('fails closed when the native build template changes: %s', value => {
    expect(() => optimizeAppBuildGradle(value)).toThrow();
  });
});
