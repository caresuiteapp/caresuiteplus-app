// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const device = vi.hoisted(() => ({ phone: true }));
vi.mock('@/hooks/useDeviceClass', () => ({ useDeviceClass: () => ({
  deviceClass: device.phone ? 'phone' : 'tablet', isPhone: device.phone, width: device.phone ? 390 : 900,
}) }));
vi.mock('react-native', () => {
  const flatten = (style: any): any => Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flatten)) : style;
  return {
    Platform: { OS: 'web' },
    useWindowDimensions: () => ({width: device.phone ? 390 : 900, fontScale: 1}),
    View: ({ children, style }: any) => <div data-layout={JSON.stringify(flatten(style))}>{children}</div>,
    ScrollView: ({ children, horizontal }: any) => <div data-horizontal={String(horizontal)}>{children}</div>,
    StyleSheet: { create: (styles: any) => styles },
  };
});
import { AdaptiveKpiGrid } from '@/components/adaptive/AdaptiveKpiGrid';

let host: HTMLDivElement; let root: Root;
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  device.phone = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const items = Array.from({ length: 5 }, (_, index) => ({ id: String(index), node: <button>Widget {index + 1}</button> }));

describe('employee phone widget arrangement', () => {
  it('shows two equal-width cells per row with all widgets available vertically', async () => {
    await act(async () => root.render(<AdaptiveKpiGrid items={items} columns={{ phone: 2 }} phoneLayout="grid" />));
    expect(host.querySelector('[data-horizontal]')).toBeNull();
    const rows = Array.from(host.firstElementChild!.children);
    expect(rows.map(row => row.querySelectorAll('button').length)).toEqual([2, 2, 1]);
    for (const row of rows) {
      expect(JSON.parse(row.getAttribute('data-layout')!)).toMatchObject({ width: '100%', flexDirection: 'row' });
      expect(row.children).toHaveLength(2);
      for (const cell of row.children) {
        expect(JSON.parse(cell.getAttribute('data-layout')!)).toMatchObject({ flex: 1, minWidth: 0 });
      }
    }
    expect(host.textContent).toContain('Widget 5');
  });
  it('preserves horizontal presentation for callers using the existing default', async () => {
    await act(async () => root.render(<AdaptiveKpiGrid items={items} columns={{ phone: 2 }} />));
    expect(host.querySelector('[data-horizontal="true"]')).not.toBeNull();
    expect(host.querySelectorAll('button')).toHaveLength(5);
  });
  it('returns to the existing tablet layout when the device class changes', async () => {
    await act(async () => root.render(<AdaptiveKpiGrid items={items} columns={{ phone: 2, tablet: 2 }} phoneLayout="grid" />));
    device.phone = false;
    await act(async () => root.render(<AdaptiveKpiGrid items={items} columns={{ phone: 2, tablet: 2 }} phoneLayout="grid" />));
    expect(host.firstElementChild!.children).toHaveLength(5);
    expect(host.querySelector('[data-horizontal]')).toBeNull();
  });
});
