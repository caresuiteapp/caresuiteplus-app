import { describe, expect, it } from 'vitest';
import { kpiGridColumnCount } from '@/design/tokens/breakpoints';
import { kpiColumnsForDeviceClass } from '@/design/tokens/breakpoints';

describe('AdaptiveKpiGrid column logic', () => {
  it('liefert 2 Spalten auf Phone', () => {
    expect(kpiGridColumnCount(375)).toBe(2);
    expect(kpiColumnsForDeviceClass('phone')).toBe(2);
  });

  it('liefert 4 Spalten auf Tablet', () => {
    expect(kpiGridColumnCount(800)).toBe(4);
    expect(kpiColumnsForDeviceClass('tablet')).toBe(4);
  });

  it('liefert 4 Spalten auf Desktop', () => {
    expect(kpiGridColumnCount(1280)).toBe(4);
    expect(kpiColumnsForDeviceClass('desktop')).toBe(4);
  });

  it('liefert 6 Spalten auf Wide', () => {
    expect(kpiGridColumnCount(1600)).toBe(6);
    expect(kpiColumnsForDeviceClass('wide')).toBe(6);
  });

  it('respektiert Spalten-Overrides', () => {
    expect(kpiGridColumnCount(375, { phone: 1 })).toBe(1);
    expect(kpiGridColumnCount(1280, { desktop: 5 })).toBe(5);
  });
});
