import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd());
const STABLE_BUNDLE_ID = 'de.caresuiteplus.app';

const ASSET_FILES = [
  'assets/icon.png',
  'assets/favicon.png',
  'assets/splash-icon.png',
  'assets/android-icon-foreground.png',
  'assets/android-icon-background.png',
  'assets/android-icon-monochrome.png',
];

describe('store config', () => {
  it('definiert konsistente App-Identität in app.json', () => {
    const appJson = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
    expect(appJson.expo.name).toBe('CareSuite+');
    expect(appJson.expo.slug).toBe('caresuite-plus');
    expect(appJson.expo.scheme).toBe('caresuiteplus');
    expect(appJson.expo.ios.bundleIdentifier).toBe(STABLE_BUNDLE_ID);
    expect(appJson.expo.android.package).toBe(STABLE_BUNDLE_ID);
    expect(appJson.expo.ios.supportsTablet).toBe(true);
    expect(appJson.expo.ios.buildNumber).toBeDefined();
    expect(appJson.expo.android.versionCode).toBeGreaterThan(0);
  });

  it('spiegelt Bundle-ID und supportsTablet in app.config.ts', () => {
    const appConfig = readFileSync(join(root, 'app.config.ts'), 'utf8');
    expect(appConfig).toContain(STABLE_BUNDLE_ID);
    expect(appConfig).toContain('supportsTablet: true');
    expect(appConfig).toContain("slug: 'caresuite-plus'");
    expect(appConfig).toContain('SUPPORT_LINKS');
    expect(appConfig).toContain('supportLinks: { ...SUPPORT_LINKS }');
  });

  it('referenziert Icon- und Favicon-Pfade', () => {
    const appJson = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
    expect(appJson.expo.icon).toBe('./assets/icon.png');
    expect(appJson.expo.web.favicon).toBe('./assets/favicon.png');
    expect(appJson.expo.splash?.image).toBe('./assets/splash-icon.png');
    expect(appJson.expo.android?.adaptiveIcon?.foregroundImage).toBe(
      './assets/android-icon-foreground.png',
    );
  });

  it('enthält EAS Build-Profile', () => {
    const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
    expect(eas.build.development).toBeDefined();
    expect(eas.build.preview).toBeDefined();
    expect(eas.build.production).toBeDefined();
    expect(eas.build.production.android.buildType).toBe('app-bundle');
    expect(eas.build.preview.env?.APP_ENV).toBe('preview');
  });

  it('eas-preflight Script vorhanden; GPS bleibt preparedOnly ohne Manifest-Plugin', () => {
    expect(existsSync(join(root, 'scripts/eas-preflight.mjs'))).toBe(true);
    const appConfig = readFileSync(join(root, 'app.config.ts'), 'utf8');
    expect(appConfig).not.toContain('expo-location');
    expect(readFileSync(join(root, 'src/lib/geo/geoModuleConfig.ts'), 'utf8')).toContain(
      'return false',
    );
  });

  it.each(ASSET_FILES)('Asset existiert: %s', (rel) => {
    expect(existsSync(join(root, rel))).toBe(true);
  });

  it('deklariert nur INTERNET als Android-Permission', () => {
    const appJson = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
    expect(appJson.expo.android?.permissions).toEqual(['INTERNET']);
  });
});

describe('privacy & store docs', () => {
  const docs = [
    'docs/store/privacy-data-map.md',
    'docs/store/app-store-checklist.md',
    'docs/store/google-play-checklist.md',
    'docs/store/reviewer-notes.md',
    'docs/store/eas-build-preflight.md',
    'docs/store/build-commands.md',
    'docs/store/assets-readiness.md',
    'docs/store/legal-links-checklist.md',
    'docs/deployment/mobile-env-strategy.md',
    'docs/deployment/eas-preview-builds.md',
    'docs/platform/web-desktop-readiness.md',
    'docs/audit/eas-store-build-readiness-report.md',
    'scripts/store-readiness-check.mjs',
  ];

  it.each(docs)('existiert: %s', (rel) => {
    expect(existsSync(join(root, rel))).toBe(true);
  });
});

describe('responsive shell modules', () => {
  const modules = [
    'src/components/layout/DesktopShell.tsx',
    'src/components/layout/TabletShell.tsx',
    'src/components/layout/MobileShell.tsx',
    'src/components/layout/MasterDetailLayout.tsx',
  ];

  it.each(modules)('existiert: %s', (rel) => {
    expect(existsSync(join(root, rel))).toBe(true);
  });

  it('DesktopShell nutzt keine Bottom-Tab-Bar', () => {
    const source = readFileSync(join(root, 'src/components/layout/DesktopShell.tsx'), 'utf8');
    expect(source.includes('AppTabBar')).toBe(false);
  });

  it('DSGVO Settings-Screens existieren', () => {
    expect(existsSync(join(root, 'src/screens/settings/DataRequestScreen.tsx'))).toBe(true);
    expect(existsSync(join(root, 'src/screens/settings/AccountDeletionRequestScreen.tsx'))).toBe(
      true,
    );
  });
});
