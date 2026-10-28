// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', async () => await vi.importActual<typeof import('react-native')>('react-native-web'));
vi.mock('@/components/layout/platform/platformmodal', () => ({ PlatformModal: () => null }));
vi.mock('@/design/tokens/auroraGlass', () => ({
  useAuroraGlassSelectStyles: () => ({
    wrap: { flex: 1, minWidth: 0, gap: 4 },
    trigger: { minHeight: 44, flexDirection: 'row' },
    triggerText: { flex: 1 },
  }),
}));

import { ListFilterSelect } from '@/components/ui/ListFilterSelect';

describe('select field CSS used by the real Web host', () => {
  let host: HTMLDivElement, root: Root;
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

  async function render(grow?: boolean) {
    await act(async () => root.render(<ListFilterSelect label="Wochentag" value="mo" options={[{ key: 'mo', label: 'Montag' }]} onChange={() => {}} grow={grow} />));
    const field = host.querySelector<HTMLElement>('[data-cs-healthos-component="filter-select"]')!;
    expect(field).not.toBeNull();
    return getComputedStyle(field);
  }

  it('keeps intrinsic field height without a zero flex basis or shrink', async () => {
    const style = await render(false);
    expect(style.flexGrow).toBe('0');
    expect(style.flexShrink).toBe('0');
    expect(style.flexBasis).toBe('auto');
    expect(host.querySelector('[aria-label="Wochentag: Montag"]')).not.toBeNull();
  });

  it('retains the original flexible layout for filter bars', async () => {
    expect((await render()).flexGrow).toBe('1');
  });
});
