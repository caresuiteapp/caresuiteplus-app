// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePortalVisualViewport } from '@/hooks/usePortalVisualViewport';

const keyboard = vi.hoisted(() => ({ visible: false, listeners: new Map<string, () => void>(), remove: vi.fn() }));
vi.mock('react-native', () => ({ Keyboard: {
  isVisible: () => keyboard.visible,
  addListener: (event: string, listener: () => void) => {
    keyboard.listeners.set(event, listener);
    return { remove: () => { keyboard.listeners.delete(event); keyboard.remove(); } };
  },
} }));

afterEach(() => { keyboard.visible = false; keyboard.listeners.clear(); vi.clearAllMocks(); });
describe('Native portal viewport', () => {
  it('follows the keyboard without applying browser fixed-position geometry', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');
    const root = createRoot(host);
    let viewport: ReturnType<typeof usePortalVisualViewport> | undefined;
    function Probe() { viewport = usePortalVisualViewport(); return null; }
    try {
      await act(async () => root.render(<Probe />));
      expect(viewport).toEqual({ height: null, width: null, offsetTop: 0, offsetLeft: 0, keyboardVisible: false });
      await act(async () => keyboard.listeners.get('keyboardDidShow')?.());
      expect(viewport?.keyboardVisible).toBe(true);
      await act(async () => keyboard.listeners.get('keyboardDidHide')?.());
      expect(viewport?.keyboardVisible).toBe(false);
    } finally { await act(async () => root.unmount()); }
    expect(keyboard.remove).toHaveBeenCalledTimes(2);
    expect(keyboard.listeners.size).toBe(0);
  });
});
