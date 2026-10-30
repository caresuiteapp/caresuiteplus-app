// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePortalVisualViewport } from '@/hooks/usePortalVisualViewport';
import { EmployeePortalVisitBottomBar } from '@/components/portal/EmployeePortalVisitBottomBar.native';
import { EmployeePortalVisitStickyHeader } from '@/components/portal/EmployeePortalVisitStickyHeader.native';
import { PortalViewportContext } from '@/lib/portal/portalViewportContext';

const keyboard = vi.hoisted(() => ({ visible: false, listeners: new Map<string, () => void>(), remove: vi.fn() }));
const styles = vi.hoisted(() => new WeakMap<HTMLElement, Record<string, any>>());
vi.mock('react-native', async () => {
  const React = await import('react');
  const flatten = (value: any): Record<string, any> => Array.isArray(value) ? Object.assign({}, ...value.map(flatten)) : value || {};
  const Box = ({ children, style, testID }: any) => <div data-testid={testID} ref={node => { if (node) styles.set(node, flatten(style)); }}>{children}</div>;
  return { View: Box, Text: Box, TextInput: Box, ScrollView: Box, Image: () => null,
    Pressable: ({ children, onPress, accessibilityLabel }: any) => <button aria-label={accessibilityLabel} onClick={onPress}>{children}</button>,
    Modal: ({ children, visible }: any) => visible ? <div>{children}</div> : null,
    StyleSheet: { create: (value: any) => value, flatten }, Platform: { OS: 'android', select: (value: any) => value.android ?? value.default },
    Keyboard: {
  isVisible: () => keyboard.visible,
  addListener: (event: string, listener: () => void) => {
    keyboard.listeners.set(event, listener);
    return { remove: () => { keyboard.listeners.delete(event); keyboard.remove(); } };
  },
} };
});
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 32, bottom: 56, left: 0, right: 0 }) }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
vi.mock('@/components/ui', () => ({ PremiumBadge: ({ label }: any) => <span>{label}</span>, PremiumButton: () => null }));

afterEach(() => { keyboard.visible = false; keyboard.listeners.clear(); vi.clearAllMocks(); });
describe('Native portal viewport', () => {
  it.each([[false, 56], [true, 6]] as const)('uses numeric action-bar padding with an existing shell footer=%s', async (footerInFlow, paddingBottom) => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div'), root = createRoot(host), onPress = vi.fn();
    try {
      await act(async () => root.render(<PortalViewportContext.Provider value={{ footerInFlow }}><EmployeePortalVisitBottomBar actions={[{ key: 'save', label: 'Speichern', onPress }]} /></PortalViewportContext.Provider>));
      expect(styles.get(host.querySelector<HTMLElement>('[data-testid="employee-visit-action-bar"]')!)?.paddingBottom).toBe(paddingBottom);
      await act(async () => host.querySelector('button')!.click());
      expect(onPress).toHaveBeenCalledOnce();
    } finally { await act(async () => root.unmount()); }
  });
  it('uses the actual status-bar inset for the generated execution header', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div'), root = createRoot(host);
    try {
      await act(async () => root.render(<EmployeePortalVisitStickyHeader clientName="Helene Musterfrau" plannedStartAt="2026-10-30T12:00:00Z" plannedEndAt="2026-10-30T14:00:00Z" effectiveStatus="geplant" timers={null} showProgress={false} />));
      expect(styles.get(host.firstElementChild as HTMLElement)?.paddingTop).toBe(32);
    } finally { await act(async () => root.unmount()); }
  });
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
