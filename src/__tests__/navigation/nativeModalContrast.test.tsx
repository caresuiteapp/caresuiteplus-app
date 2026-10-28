// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformModal } from '@/components/layout/platform/platformmodal';
import { GradientModalHeader } from '@/components/layout/platform/gradientmodalheader';
import { useSurfaceContrastTone } from '@/design/tokens/surfaceContrast';

const theme = vi.hoisted(() => ({ isLight: false, portalActive: false }));
vi.mock('react-native', () => {
  const flatten = (value: any): any => Array.isArray(value)
    ? Object.assign({}, ...value.map(flatten))
    : typeof value === 'function' ? flatten(value({ pressed: false })) : value || {};
  const View = ({ children, style }: any) => <div style={flatten(style)}>{children}</div>;
  const Text = ({ children, style }: any) => <span style={flatten(style)}>{children}</span>;
  const Pressable = ({ children, style, onPress, accessibilityLabel }: any) => <button style={flatten(style)} onClick={onPress} aria-label={accessibilityLabel}>{children}</button>;
  return {
    View, Text, Pressable,
    Modal: ({ children, visible }: any) => visible ? <div role="dialog">{children}</div> : null,
    Platform: { OS: 'android', select: (styles: any) => styles.android ?? styles.default },
    StyleSheet: { create: (styles: unknown) => styles, flatten, absoluteFill: {}, hairlineWidth: 1 },
    useWindowDimensions: () => ({ width: 1280, height: 800 }),
  };
});
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) }));
vi.mock('expo-linear-gradient', () => ({ LinearGradient: () => <div data-native-gradient /> }));
vi.mock('@/components/keyboard/PortalKeyboard', () => ({
  PortalKeyboardScrollView: ({ children, contentContainerStyle }: any) => <div data-modal-body style={Object.assign({}, ...contentContainerStyle)}>{children}</div>,
}));
vi.mock('@/components/ui/effects', () => ({ GlassSurface: ({ children, style }: any) => <div data-modal-surface style={style}>{children}</div> }));
vi.mock('@/lib/platform/confirmAction', () => ({ confirmAction: async () => true }));
vi.mock('@/theme', () => ({ spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } }));
vi.mock('@/design/tokens/carelightadaptive', () => ({ useCareLightPalette: () => ({ isDark: !theme.isLight, c: { violet: '#6246EA' } }) }));
vi.mock('@/design/tokens/themeBridge', () => ({ useLegacyTheme: () => ({ isLight: theme.isLight }) }));
vi.mock('@/design/tokens/auroraGlass', () => ({
  useAuroraGlassActive: () => true,
  useAuroraAdaptiveText: () => ({ primary: '#FFFFFF', secondary: '#DDEBFF' }),
  useShellGlassSurfaceStyle: () => ({ backgroundColor: '#031127' }),
}));
vi.mock('@/hooks/useshellhostsaurora', () => ({ useShellHostsAurora: () => true }));
vi.mock('@/design/tokens/portalPremium', () => ({
  usePortalPremiumRuntimeTheme: () => ({ active: theme.portalActive }),
  portalPremium: { surfaceRaised: '#EFE9FF', surfaceSoft: '#E5DFFF', text: { primary: '#112233', secondary: '#334455' }, borderSoft: '#CCDDEE' },
}));
vi.mock('@/components/layout/platform/gradientmodalactionbutton', () => ({
  GradientModalActionButton: ({ title, onPress }: any) => <button onClick={onPress}>{title}</button>,
}));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  theme.isLight = false; theme.portalActive = false;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const text = (value: string) => Array.from(host.querySelectorAll('span')).find(node => node.textContent === value)!;
function ToneProbe() { return <span data-modal-tone>{useSurfaceContrastTone()}</span>; }

describe('native company dialog surface', () => {
  it.each([false, true])('keeps the original light company surface under a dark shell (portal=%s)', async portalActive => {
    theme.portalActive = portalActive;
    const close = vi.fn();
    await act(async () => root.render(<PlatformModal visible surfaceScope="company" title="Office · Apps" subtitle="Apps und Widgets" onClose={close} footerActions={[{ title: 'Fertig' }]}><ToneProbe /></PlatformModal>));
    expect((host.querySelector('[data-modal-surface]') as HTMLElement).style.backgroundColor.toLowerCase()).toBe('#ffffff');
    expect((host.querySelector('[data-modal-body]') as HTMLElement).style.backgroundColor.toLowerCase()).toBe('#f4f8fd');
    expect(host.querySelector('[data-modal-tone]')?.textContent).toBe('light');
    expect(text('Office · Apps').style.color.toLowerCase()).toBe('#15304e');
    expect(text('Apps und Widgets').style.color.toLowerCase()).toBe('#59708c');
    expect(host.querySelector('[data-native-gradient]')).toBeNull();
    const footer = Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Fertig')!.parentElement!;
    expect(footer.style.backgroundColor.toLowerCase()).toBe('#ffffff');
    await act(async () => (host.querySelector('[aria-label="Schließen"]') as HTMLButtonElement).click());
    expect(close).toHaveBeenCalledOnce();
  });
  it('also honors an explicit dark header tone in a light portal', async () => {
    theme.isLight = true; theme.portalActive = true;
    await act(async () => root.render(<GradientModalHeader title="Dokument" tone="dark" onClose={() => {}} />));
    expect(host.querySelectorAll('[data-native-gradient]')).toHaveLength(2);
  });
});
