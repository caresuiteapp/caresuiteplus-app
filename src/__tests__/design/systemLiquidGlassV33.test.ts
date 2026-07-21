import { describe, expect, it } from 'vitest';
import { careSuiteColors } from '@/design/tokens/colors';
import { popupShellColors } from '@/design/tokens/popupShellTokens';
import {
  SYSTEM_LIQUID_COLORS,
  systemLiquidGlass,
} from '@/design/tokens/systemLiquidGlass';
import { spatialModuleAccents } from '@/design/tokens/spatialCareSuite';

describe('System Liquid Glass V33', () => {
  it('besitzt genau drei verbindliche Markenfarben', () => {
    expect(Object.keys(SYSTEM_LIQUID_COLORS)).toEqual(['navy', 'electricBlue', 'white']);
    expect(Object.values(SYSTEM_LIQUID_COLORS)).toEqual(['#17182D', '#69E8FF', '#FFFFFF']);
  });

  it('liefert für alte light- und dark-Pfade dieselbe Designwelt', () => {
    expect(careSuiteColors.light).toBe(careSuiteColors.dark);
    expect(popupShellColors.light).toBe(popupShellColors.dark);
  });

  it('wurde in V34 durch individuelle Modulakzente innerhalb einer Struktur erweitert', () => {
    expect(careSuiteColors.dark.module).toEqual(spatialModuleAccents);
    expect(new Set(Object.values(careSuiteColors.dark.module)).size).toBe(8);
  });

  it('stellt lesbare dunkle räumliche Glasschichten bereit', () => {
    expect(systemLiquidGlass.page).toBe('#17182D');
    expect(systemLiquidGlass.text.primary).toBe('#F8F6FF');
    expect(systemLiquidGlass.borderActive).toContain('105, 232, 255');
    expect(systemLiquidGlass.blur.desktop).toBeGreaterThanOrEqual(24);
  });
});
