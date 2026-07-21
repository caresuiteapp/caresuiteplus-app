import { describe, expect, it } from 'vitest';
import { spatialCare, spatialCareColors, spatialModuleAccents } from '@/design/tokens/spatialCareSuite';
import { careSuiteColors } from '@/design/tokens/colors';

describe('System Spatial Experience V34', () => {
  it('übersetzt die Referenz in Nachtbühne und helle Arbeitsflächen', () => {
    expect(spatialCare.page).toBe(spatialCareColors.night);
    expect(spatialCare.stage).toContain('247, 242, 248');
    expect(spatialCare.radius.shell).toBeGreaterThan(spatialCare.radius.card);
  });

  it('verwendet Cyan ausschließlich als Lichtakzent', () => {
    expect(spatialCareColors.cyanLight).not.toBe(spatialModuleAccents.office);
    expect(spatialCareColors.cyanLight).not.toBe(spatialModuleAccents.pflege);
  });

  it('behält individuelle Modulidentitäten in einer gemeinsamen Struktur', () => {
    expect(new Set(Object.values(spatialModuleAccents)).size).toBe(8);
    expect(careSuiteColors.light.module.office).toBe(spatialModuleAccents.office);
    expect(careSuiteColors.light.module.assist).toBe(spatialModuleAccents.assist);
  });
});
