import { describe, expect, it } from 'vitest';
import { spatialCare, spatialCareColors, spatialModuleAccents } from '@/design/tokens/spatialCareSuite';

describe('System Spatial Reference V36', () => {
  it('trennt dunkle Bühne und helle Pearl-Arbeitsfläche klar', () => {
    expect(spatialCare.page).toBe(spatialCareColors.night);
    expect(spatialCare.textOnNight).toBe('#FFFFFF');
    expect(spatialCare.textOnPearl).toBe(spatialCareColors.inkDark);
    expect(spatialCare.textOnNight).not.toBe(spatialCare.textOnPearl);
  });

  it('behält unterschiedliche Modulakzente statt alles blau zu färben', () => {
    const accents = new Set(Object.values(spatialModuleAccents));
    expect(accents.size).toBeGreaterThanOrEqual(6);
    expect(spatialModuleAccents.office).not.toBe(spatialModuleAccents.assist);
  });

  it('verwendet großzügige räumliche Rundungen', () => {
    expect(spatialCare.radius.shell).toBeGreaterThan(spatialCare.radius.card);
    expect(spatialCare.radius.capsule).toBe(999);
  });
});
