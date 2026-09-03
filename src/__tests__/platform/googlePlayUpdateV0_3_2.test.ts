import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const readJson = (path: string) => JSON.parse(read(path)) as Record<string, any>;

describe('Google Play portal-only update 0.3.2', () => {
  it('preserves the existing Android identity and raises the release baseline', () => {
    const app = readJson('app.json').expo;
    expect(app.android.package).toBe('app.caresuitehealthos');
    expect(app.version).toBe('0.3.2');
    expect(app.android.versionCode).toBeGreaterThanOrEqual(25);
  });

  it('targets API 36 and declares only the productive portal permissions', () => {
    const config = read('app.config.ts');
    expect(config).toContain('compileSdkVersion: 36');
    expect(config).toContain('targetSdkVersion: 36');
    expect(config).toContain('isAndroidBackgroundLocationEnabled: true');
    expect(config).toContain('isAndroidForegroundServiceEnabled: true');

    const permissions = readJson('app.json').expo.android.permissions;
    expect(permissions).toEqual([
      'INTERNET',
      'POST_NOTIFICATIONS',
      'CAMERA',
      'RECORD_AUDIO',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
    ]);
  });

  it('builds and submits the isolated portal bundle to the internal track', () => {
    const eas = readJson('eas.json');
    expect(eas.cli.appVersionSource).toBe('remote');
    expect(eas.build['portal-only-aab']).toMatchObject({
      extends: 'production',
      autoIncrement: true,
      android: { buildType: 'app-bundle' },
      env: {
        APP_ENV: 'production',
        EXPO_PUBLIC_APP_EDITION: 'portal-only',
        EXPO_PUBLIC_FOLDER: 'public-portal',
      },
    });
    expect(eas.submit['portal-only-internal'].android).toEqual({
      applicationId: 'app.caresuitehealthos',
      track: 'internal',
      releaseStatus: 'completed',
    });
  });

  it('keeps Office, Business and administration outside the store edition', () => {
    expect(read('app.config.ts')).toContain("root: isPortalOnlyEdition ? 'app-portal' : 'app'");
    const notes = read('docs/store/reviewer-notes.md');
    expect(notes).toContain('Portal-only');
    expect(notes).toContain('keine Business-/Office-/Admin-Oberfläche');
  });

  it('documents every sensitive Android data path for Play review', () => {
    const privacy = read('docs/store/privacy-data-map.md');
    for (const marker of [
      'Präziser Standort',
      'Fotos und Videos',
      'Audiodaten',
      'Push-Token',
      'Hintergrundstandort',
      'app.caresuitehealthos',
    ]) {
      expect(privacy).toContain(marker);
    }
  });

  it('shows a prominent in-app disclosure before the Android location request', () => {
    const disclosure = read(
      'src/components/portal/EmployeePortalLocationConsentBanner.tsx',
    );
    const execution = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(disclosure).toContain('auch wenn die App im Hintergrund');
    expect(disclosure).toContain('keine dienstliche Hintergrundaufzeichnung');
    expect(disclosure).toContain('employee-background-location-disclosure');
    expect(execution).toContain('<EmployeePortalLocationConsentBanner');
    expect(execution).toMatch(
      /const handleAcceptLocationDisclosure[\s\S]*await grantConsent\(\)[\s\S]*await executeStartDrive\(\)/,
    );
  });

  it('keeps the short description inside the Play limit', () => {
    const listing = read('docs/store/store-listing-texts.md');
    const shortDescription = listing
      .split('## Kurzbeschreibung')[1]
      .split('## Vollständige Beschreibung')[0]
      .trim();
    expect(shortDescription.length).toBeLessThanOrEqual(80);
  });
});
