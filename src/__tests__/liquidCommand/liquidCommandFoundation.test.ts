import { describe, expect, it } from 'vitest';
import { liquidColors } from '@/liquid-command/foundation/tokens';
import { resolveLiquidFormFactor } from '@/liquid-command/foundation/useLiquidLayout';
import {
  liquidGlobalShortcuts,
  liquidModules,
  liquidWorkAreas,
} from '@/liquid-command/navigation/moduleCatalog';
import { isLiquidCommandRoutePath } from '@/liquid-command/navigation/isLiquidCommandRoute';
import {
  getLiquidPrimaryWorkflowRoute,
  getLiquidRecordRoute,
} from '@/liquid-command/navigation/workflowRoutes';

describe('Liquid Command foundation', () => {
  it('uses the binding master-specification colors', () => {
    expect(liquidColors.navy950).toBe('#010817');
    expect(liquidColors.navy800).toBe('#061B35');
    expect(liquidColors.blue500).toBe('#1683FF');
    expect(liquidColors.blue200).toBe('#9ACBFF');
    expect(liquidColors.white).toBe('#FFFFFF');
  });

  it.each([
    [390, 844, 'web', 'phone-portrait'],
    [844, 390, 'android', 'phone-landscape-blocked'],
    [820, 1180, 'android', 'tablet-portrait'],
    [1180, 820, 'android', 'tablet-landscape'],
    [1200, 800, 'web', 'compact-web'],
    [1440, 900, 'web', 'desktop'],
  ] as const)('resolves %sx%s %s as %s', (width, height, platform, expected) => {
    expect(resolveLiquidFormFactor(width, height, platform)).toBe(expected);
  });

  it('contains the complete module dock and every universal page type', () => {
    expect(liquidModules.map((module) => module.key)).toEqual([
      'home',
      'office',
      'assist',
      'pflege',
      'stationaer',
      'beratung',
      'akademie',
      'robotics',
      'platform',
      'settings',
    ]);

    const pageTypes = new Set(
      Object.values(liquidWorkAreas)
        .flat()
        .map((area) => area.pageType),
    );
    expect(pageTypes).toEqual(
      new Set([
        'command-center',
        'work-list',
        'record',
        'planning',
        'editor',
        'review',
        'analytics',
        'settings',
      ]),
    );
  });

  it('defines a real work surface for every module', () => {
    for (const module of liquidModules) {
      expect(liquidWorkAreas[module.key].length).toBeGreaterThan(0);
    }
  });

  it('uses the canonical application routes instead of a parallel demo namespace', () => {
    expect(liquidModules.map((module) => module.route)).toEqual([
      '/',
      '/office',
      '/assist',
      '/pflege',
      '/stationaer',
      '/beratung',
      '/akademie',
      '/robotics',
      '/platform',
      '/settings',
    ]);
    expect(
      Object.values(liquidWorkAreas)
        .flat()
        .some((area) => area.route.startsWith('/liquid-command')),
    ).toBe(false);
  });

  it('cuts migrated authentication, portal and module routes out of the legacy shell', () => {
    for (const route of [
      '/',
      '/auth/business-login',
      '/portal/employee',
      '/office/invoices/create',
      '/assist/live-status',
      '/pflege/bodymap',
      '/stationaer/bodymap',
      '/beratung/faelle',
      '/akademie/kurse',
      '/robotics',
      '/platform/tenants',
      '/settings/tenant',
      '/business/office/payroll',
      '/communication',
      '/insight',
      '/medical',
      '/zentrale',
      '/admin',
    ]) {
      expect(isLiquidCommandRoutePath(route)).toBe(true);
    }
  });

  it('keeps the missing operational workflows permanently reachable', () => {
    expect(liquidGlobalShortcuts.map((shortcut) => shortcut.label)).toEqual(
      expect.arrayContaining([
        'Einsätze',
        'Klient:innen',
        'Nachrichten',
        'Gehaltsstatistik',
        'Arbeitszeit',
        'Dokumente',
        'Portale & Zugänge',
        'BodyMap',
        'Profil',
      ]),
    );
    expect(liquidGlobalShortcuts.find((shortcut) => shortcut.label === 'Gehaltsstatistik')?.route)
      .toBe('/business/office/payroll');
    expect(liquidGlobalShortcuts.find((shortcut) => shortcut.label === 'Profil')?.route)
      .toBe('/settings/profile');
  });

  it('connects Liquid workspaces with productive record and creation workflows', () => {
    expect(getLiquidRecordRoute('office', 'people', 'employee-1')).toBe(
      '/business/office/employees/employee-1',
    );
    expect(getLiquidPrimaryWorkflowRoute('assist', 'assignments')).toBe(
      '/assist/einsaetze/new',
    );
    expect(getLiquidPrimaryWorkflowRoute('pflege', 'wounds')).toBe('/pflege/bodymap');
    expect(getLiquidPrimaryWorkflowRoute('stationaer', 'services')).toBe(
      '/stationaer/bodymap',
    );
  });
});
