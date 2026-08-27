import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const readJson = (fileName: string) =>
  JSON.parse(readFileSync(join(root, fileName), 'utf8')) as Record<string, any>;

describe('R14-B Android API 36 and Expo SDK 54 baseline', () => {
  it('uses the supported Expo SDK 54 dependency set', () => {
    const packageJson = readJson('package.json');

    expect(packageJson.engines.node).toBe('>=20.19.4');
    expect(packageJson.dependencies.expo).toMatch(/^~54\./);
    expect(packageJson.dependencies['expo-router']).toMatch(/^~6\./);
    expect(packageJson.dependencies.react).toBe('19.1.0');
    expect(packageJson.dependencies['react-native']).toBe('0.81.5');
    expect(packageJson.dependencies['react-native-worklets']).toBeTruthy();
    expect(packageJson.dependencies['expo-system-ui']).toMatch(/^~6\./);
  });

  it('targets Android 16/API 36 with a monotonic app version', () => {
    const config = readFileSync(join(root, 'app.config.ts'), 'utf8');
    const staticConfig = readJson('app.json').expo;

    expect(config).toContain("version: '0.2.0'");
    expect(config).toContain('versionCode: 14');
    expect(config).toContain('compileSdkVersion: 36');
    expect(config).toContain('targetSdkVersion: 36');
    expect(config).toContain('minSdkVersion: 24');
    expect(config).toContain('predictiveBackGestureEnabled: false');
    expect(config).not.toContain('edgeToEdgeEnabled: false');

    expect(staticConfig.version).toBe('0.2.0');
    expect(staticConfig.android.versionCode).toBe(14);
    expect(staticConfig.android.predictiveBackGestureEnabled).toBe(false);
  });

  it('pins the EAS workers and keeps the release AAB portal-only', () => {
    const eas = readJson('eas.json');

    expect(eas.cli.appVersionSource).toBe('remote');
    expect(eas.build.production.node).toBe('20.19.4');
    expect(eas.build.production.autoIncrement).toBe(true);
    expect(eas.build['portal-only-aab'].extends).toBe('production');
    expect(eas.build['portal-only-aab'].android.buildType).toBe('app-bundle');
    expect(eas.build['portal-only-aab'].env.EXPO_PUBLIC_APP_EDITION).toBe('portal-only');
    expect(eas.build['portal-only-aab'].env.EXPO_PUBLIC_FOLDER).toBe('public-portal');
  });

  it('uses the SDK 54 single pending-camera-result contract', () => {
    const picker = readFileSync(
      join(root, 'src/lib/portal/employeePortalMediaPicker.ts'),
      'utf8',
    );

    expect(picker).toContain('const pending = await ImagePicker.getPendingResultAsync()');
    expect(picker).not.toContain('pendingResults.at(-1)');
  });

  it('runs the resolved-config audit without Windows npx.cmd spawning', () => {
    const audit = readFileSync(join(root, 'scripts/audit-android-api36.mjs'), 'utf8');

    expect(audit).toContain("require.resolve('expo/bin/cli')");
    expect(audit).toContain('process.execPath');
    expect(audit).not.toContain('npx.cmd');
  });
});
