// @vitest-environment happy-dom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({ intent: vi.fn() }));
vi.mock('react-native', async importOriginal => {
  const actual = await importOriginal<typeof import('react-native')>();
  return {
    ...actual,
    Platform: { ...actual.Platform, OS: 'android' },
    Linking: { ...actual.Linking, sendIntent: native.intent },
    useWindowDimensions: () => ({ width: 360, height: 800, scale: 1, fontScale: 1.6 }),
    Modal: ({ visible, children }: { visible: boolean; children: ReactNode }) => visible ? <div>{children}</div> : null,
  };
});
vi.mock('@/liquid-command/components/LiquidPrimitives', () => ({ useLiquidVisualMode: () => 'orbit' }));

import { PortalTextSizeControls } from '@/components/portal/accessibility/PortalTextSizeControls.native';
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); native.intent.mockResolvedValue(undefined);
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
async function press(label: string) {
  const button = host.querySelector<HTMLElement>(`[aria-label="${label}"]`);
  expect(button, label).not.toBeNull();
  await act(async () => button!.click());
}

describe('selected native text-size control', () => {
  it('opens its guide without a Web font provider and changes device settings only after the explicit action', async () => {
    await act(async () => root.render(<PortalTextSizeControls compact appearance="desktop-header" />));
    expect(native.intent).not.toHaveBeenCalled();
    await press('Textgröße ändern');
    expect(host.textContent).toContain('CareSuite übernimmt automatisch die Textgröße Ihres Geräts');
    expect(host.textContent).toContain('160');
    expect(native.intent).not.toHaveBeenCalled();
    await press('Anzeige & Textgröße öffnen');
    expect(native.intent).toHaveBeenCalledExactlyOnceWith('android.settings.DISPLAY_SETTINGS');
    await press('Schließen');
    expect(host.textContent).not.toContain('Aktuell werden etwa');
  });

  it('keeps instructions and a close action available if Android cannot open display settings', async () => {
    native.intent.mockRejectedValueOnce(new Error('not available'));
    await act(async () => root.render(<PortalTextSizeControls dense />));
    await press('Textgröße ändern');
    await press('Anzeige & Textgröße öffnen');
    expect(host.textContent).toContain('Die Anzeige-Einstellungen konnten nicht geöffnet werden');
    expect(host.textContent).toContain('Einstellungen > Anzeige > Schriftgröße');
    await press('Schließen');
    expect(host.querySelector('[aria-label="Textgröße ändern"]')).not.toBeNull();
  });
});
