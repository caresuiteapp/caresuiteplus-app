import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

describe('Desktop Light-Mode Persistenz R8', () => {
  it('überschreibt alte Dark-Präferenzen auf Desktop dauerhaft mit light', () => {
    const provider = read('src/design/ThemeModeProvider.tsx');

    expect(provider).toContain("@caresuite/theme-pref-migration-v3");
    expect(provider).toContain('if (isDesktopWeb())');
    expect(provider).toContain("stored = 'light'");
    expect(provider).toContain("setModeState('light')");
    expect(provider).toContain("AsyncStorage.setItem(STORAGE_KEY, 'light')");
    expect(provider).toContain("const resolved = isDesktopWeb() ? 'light' : next");
  });

  it('verwendet dunkle Standardfarbe für unformatierte Texte auf hellen Flächen', () => {
    const defaults = read('src/design/installSystemTextDefaults.ts');

    expect(defaults).toContain("from '@/design/tokens/lightLiquidGlassSpace'");
    expect(defaults).toContain('color: llgsTypography.primary');
    expect(defaults).toContain('llgsTypography.muted');
    expect(defaults).not.toContain('systemLiquidGlass.text.primary');
  });

  it('behält die zentrale R7-Theme-Brücke bei', () => {
    const bridge = read('src/design/tokens/themeBridge.ts');
    const colors = read('src/theme/colors.ts');

    expect(bridge).toContain("portal.active ? 'light' : themeMode");
    expect(colors).toContain("colors = legacyColorsFromPalette('light')");
  });
});
