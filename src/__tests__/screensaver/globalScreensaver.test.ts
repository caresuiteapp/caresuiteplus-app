import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCREENSAVER_SETTINGS,
  normalizeScreensaverSettings,
  screensaverIsActive,
  validateScreensaverSettingsPatch,
} from '@/lib/screensaver/screensaverTypes';
import {
  formatGermanDateLong,
  formatGermanWeekday,
  formatScreensaverClock,
} from '@/lib/screensaver/screensaverFormat';

describe('screensaverTypes', () => {
  it('Default-Timeout ist 10 Minuten', () => {
    expect(DEFAULT_SCREENSAVER_SETTINGS.timeoutMinutes).toBe(10);
    expect(DEFAULT_SCREENSAVER_SETTINGS.mode).toBe('logo_bounce');
  });

  it('normalizeScreensaverSettings ist deterministisch', () => {
    const a = normalizeScreensaverSettings({ timeoutMinutes: 5 });
    const b = normalizeScreensaverSettings({ timeoutMinutes: 5 });
    expect(a.timeoutMinutes).toBe(5);
    expect(b.timeoutMinutes).toBe(5);
  });

  it('validateScreensaverSettingsPatch lehnt ungültige Werte ab', () => {
    expect(validateScreensaverSettingsPatch({ timeoutMinutes: 99 as never })).toBeNull();
    expect(validateScreensaverSettingsPatch({ mode: 'invalid' as never })).toBeNull();
    expect(validateScreensaverSettingsPatch({ enabled: true })).toEqual({ enabled: true });
  });

  it('screensaverIsActive prüft enabled und mode', () => {
    expect(screensaverIsActive({ ...DEFAULT_SCREENSAVER_SETTINGS, enabled: true })).toBe(true);
    expect(screensaverIsActive({ ...DEFAULT_SCREENSAVER_SETTINGS, mode: 'off' })).toBe(false);
  });
});

describe('screensaverFormat', () => {
  it('formatiert Uhrzeit mit Sekunden', () => {
    const d = new Date('2026-06-23T14:32:09');
    const label = formatScreensaverClock(d, true, true);
    expect(label).toMatch(/14/);
    expect(label).toMatch(/32/);
    expect(label).toMatch(/09/);
  });

  it('formatiert deutschen Wochentag und Datum', () => {
    const d = new Date('2026-06-23T14:32:09');
    expect(formatGermanWeekday(d)).toMatch(/Dienstag/i);
    expect(formatGermanDateLong(d)).toMatch(/Juni/);
    expect(formatGermanDateLong(d)).toMatch(/2026/);
  });
});

describe('useInactivityTimer', () => {
  it('nutzt setTimeout und cleanup', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'hooks', 'useInactivityTimer.ts'),
      'utf8',
    );
    expect(source).toContain('setTimeout');
    expect(source).toContain('clearTimeout');
    expect(source).not.toMatch(/useState\([^)]*frame/i);
  });
});

describe('useScreensaverActivityEvents', () => {
  it('throttled mousemove und cleanup', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'hooks', 'useScreensaverActivityEvents.ts'),
      'utf8',
    );
    expect(source).toContain('mousemove');
    expect(source).toContain('pointermove');
    expect(source).toContain('removeEventListener');
    expect(source).toContain('THROTTLE_MS');
  });
});

describe('GlobalScreensaver mount', () => {
  it('ist in app/_layout.tsx global gemountet', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', '..', 'app', '_layout.tsx'),
      'utf8',
    );
    expect(source).toContain('GlobalScreensaver');
    expect(source).toContain('ScreensaverSettingsProvider');
    expect(source).not.toMatch(/key=\{.*route/i);
  });
});

describe('ScreensaverOverlay', () => {
  const overlayPath = ['..', '..', 'components', 'screensaver', 'ScreensaverOverlay.tsx'];

  it('fängt ersten Klick ab und blockiert Pointer', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(path.join(__dirname, ...overlayPath), 'utf8');
    expect(source).toContain('global-screensaver-overlay');
    expect(source).toContain('backdropFilter');
    expect(source).toContain('onPress');
  });

  it('rendert alle Modi', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(path.join(__dirname, ...overlayPath), 'utf8');
    expect(source).toContain('ScreensaverLogoStatic');
    expect(source).toContain('ScreensaverLogoBounce');
    expect(source).toContain('ScreensaverClock');
    expect(source).toContain('ScreensaverClockDate');
  });
});

describe('Screensaver modes', () => {
  it('logo_static nutzt ScreensaverLogo', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'screensaver', 'modes', 'ScreensaverLogoStatic.tsx'),
      'utf8',
    );
    expect(source).toContain('ScreensaverLogo');
  });

  it('logo_bounce nutzt requestAnimationFrame ohne useState pro Frame', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'screensaver', 'modes', 'ScreensaverLogoBounce.tsx'),
      'utf8',
    );
    expect(source).toContain('requestAnimationFrame');
    expect(source).toContain('cancelAnimationFrame');
    expect(source).not.toMatch(/useState\([^)]*x/i);
  });

  it('clock nutzt Sekunden-Intervall', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'screensaver', 'modes', 'ScreensaverClock.tsx'),
      'utf8',
    );
    expect(source).toContain('setInterval');
    expect(source).toContain('showSeconds');
  });

  it('clock_date nutzt deutsche Datumsformatierung', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'screensaver', 'modes', 'ScreensaverClockDate.tsx'),
      'utf8',
    );
    expect(source).toContain('formatGermanWeekday');
    expect(source).toContain('formatGermanDateLong');
  });
});

describe('ScreensaverLogo fallback', () => {
  it('nutzt CareSuiteLogo bei fehlendem Mandantenlogo', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'screensaver', 'ScreensaverLogo.tsx'),
      'utf8',
    );
    expect(source).toContain('CareSuiteLogo');
    expect(source).toContain('onError');
    expect(source).toContain('useTenantBranding');
  });
});

describe('Settings UI', () => {
  it('ScreensaverSettingsSection existiert mit Vorschau und Speichern', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'settings', 'ScreensaverSettingsSection.tsx'),
      'utf8',
    );
    expect(source).toContain('Bildschirmschoner');
    expect(source).toContain('Bildschirmschoner testen');
    expect(source).toContain('requestPreview');
    expect(source).toContain('saveSettings');
    expect(source).toContain('Mobilgeräten');
  });

  it('Appearance-Route ist registriert und in Navigation verlinkt', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const appearance = readFileSync(
      path.join(__dirname, '..', '..', '..', 'app', 'settings', 'appearance.tsx'),
      'utf8',
    );
    expect(appearance).toContain('AppearanceSettingsScreen');
    const profile = readFileSync(
      path.join(__dirname, '..', '..', 'screens', 'settings', 'userprofilescreen.tsx'),
      'utf8',
    );
    expect(profile).toContain('APPEARANCE_SETTINGS_ROUTE');
    const tenant = readFileSync(
      path.join(__dirname, '..', '..', 'screens', 'settings', 'TenantSettingsScreen.tsx'),
      'utf8',
    );
    expect(tenant).toContain('APPEARANCE_SETTINGS_ROUTE');
    expect(tenant).toContain('Darstellung & Oberfläche');
    const profileMenu = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'layout', 'platform', 'PlatformProfileMenu.tsx'),
      'utf8',
    );
    expect(profileMenu).toContain('APPEARANCE_SETTINGS_ROUTE');
  });
});

describe('screensaverSettingsService', () => {
  it('definiert AsyncStorage Keys', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'screensaver', 'screensaverSettingsService.ts'),
      'utf8',
    );
    expect(source).toContain('caresuite:screensaver:user:');
    expect(source).toContain('AsyncStorage');
    expect(source).toContain('validateScreensaverSettingsPatch');
  });
});

describe('GlobalScreensaver device gate', () => {
  it('deaktiviert auf Phone via useDeviceClass', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const source = readFileSync(
      path.join(__dirname, '..', '..', 'components', 'screensaver', 'GlobalScreensaver.tsx'),
      'utf8',
    );
    expect(source).toContain('isPhone');
    expect(source).toContain('allowedOnDevice');
  });
});

describe('Screensaver security', () => {
  it('Overlay enthält keine sensiblen Datenstrings', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: path } = await import('node:path');
    const files = [
      'ScreensaverOverlay.tsx',
      'modes/ScreensaverClock.tsx',
      'modes/ScreensaverClockDate.tsx',
      'modes/ScreensaverLogoStatic.tsx',
    ];
    for (const file of files) {
      const source = readFileSync(
        path.join(__dirname, '..', '..', 'components', 'screensaver', file),
        'utf8',
      );
      expect(source).not.toMatch(/Klient/i);
      expect(source).not.toMatch(/Rechnung/i);
      expect(source).not.toMatch(/Mitarbeiterdaten/i);
    }
  });
});
