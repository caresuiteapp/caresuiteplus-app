import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

describe('Globaler Kontrast auf hellen Arbeitsflächen R7', () => {
  it('reicht den tatsächlichen Theme-Modus an Legacy-Komponenten weiter', () => {
    const bridge = read('src/design/tokens/themeBridge.ts');

    expect(bridge).toContain('const { mode: themeMode } = useThemeMode()');
    expect(bridge).toContain("portal.active ? 'light' : themeMode");
    expect(bridge).not.toContain("portal.active ? 'light' : 'dark'");
  });

  it('verwendet standardmäßig dunkle Schrift auf hellen Arbeitsflächen', () => {
    const colors = read('src/theme/colors.ts');
    const typography = read('src/theme/typography.ts');

    expect(colors).toContain("export const colors = legacyColorsFromPalette('light')");
    expect(colors).toContain("export const lightColors = legacyColorsFromPalette('light')");
    expect(colors).toContain("export const darkColors = legacyColorsFromPalette('dark')");
    expect(typography).toContain("export const typography = resolveCareTypography('light')");
    expect(typography).toContain("export const darkTypography = resolveCareTypography('dark')");
  });

  it('behält explizite Dark-Tokens für Navigation und dunkle Shell-Flächen', () => {
    const colors = read('src/theme/colors.ts');
    const glass = read('src/design/tokens/auroraGlass.ts');

    expect(colors).toContain("darkColors = legacyColorsFromPalette('dark')");
    expect(glass).toContain('darkGlassSurfaceText');
    expect(glass).toContain('systemLiquidGlass.text.primary');
  });
});
