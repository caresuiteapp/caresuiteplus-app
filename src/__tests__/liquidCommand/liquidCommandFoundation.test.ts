import { describe, expect, it } from 'vitest';
import { liquidColors } from '@/liquid-command/foundation/tokens';
import { resolveLiquidFormFactor } from '@/liquid-command/foundation/useLiquidLayout';
import {
  liquidModules,
  liquidWorkAreas,
} from '@/liquid-command/navigation/moduleCatalog';

describe('Liquid Command foundation', () => {
  it('uses the binding master-specification colors', () => {
    expect(liquidColors.navy950).toBe('#06152B');
    expect(liquidColors.navy800).toBe('#0A2342');
    expect(liquidColors.blue500).toBe('#1478FF');
    expect(liquidColors.blue200).toBe('#8BC1FF');
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
});
