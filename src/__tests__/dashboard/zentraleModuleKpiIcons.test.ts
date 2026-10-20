import { describe, expect, it } from 'vitest';
import { ZENTRALE_MODULE_KPI_ICONS } from '@/lib/dashboard/zentraleModuleKpiIcons';
import { ZENTRALE_MODULE_OVERVIEW_MODULES } from '@/lib/dashboard/zentraleModuleOverview';

describe('zentraleModuleKpiIcons', () => {
  it('ordnet jedes der 30 KPIs einem eigenen mkpi-Glyph zu', () => {
    const assigned = ZENTRALE_MODULE_OVERVIEW_MODULES.flatMap((moduleKey) =>
      Object.values(ZENTRALE_MODULE_KPI_ICONS[moduleKey]),
    );

    expect(assigned).toHaveLength(30);
    expect(new Set(assigned).size).toBe(30);
  });

  it('verwendet pro Modul-Spalte fünf unterschiedliche Icon-Kinds', () => {
    for (const moduleKey of ZENTRALE_MODULE_OVERVIEW_MODULES) {
      const icons = Object.values(ZENTRALE_MODULE_KPI_ICONS[moduleKey]);
      expect(new Set(icons).size).toBe(5);
    }
  });

  it('nutzt modulspezifische mkpi-Prefixe je Modul', () => {
    expect(Object.values(ZENTRALE_MODULE_KPI_ICONS.office).every((icon) => icon.startsWith('mkpiOffice'))).toBe(
      true,
    );
    expect(Object.values(ZENTRALE_MODULE_KPI_ICONS.pflege).every((icon) => icon.startsWith('mkpiPflege'))).toBe(
      true,
    );
    expect(Object.values(ZENTRALE_MODULE_KPI_ICONS.akademie).every((icon) => icon.startsWith('mkpiAkademie'))).toBe(
      true,
    );
  });
});
