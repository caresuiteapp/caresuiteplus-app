import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const { optimizeAppBuildGradle } = require('../../../plugins/withAndroidReleaseOptimization.cjs');
describe('R8 optimized release generation', () => {
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
