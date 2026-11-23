// @vitest-environment happy-dom
// Actual ClientFrame/HealthOSPageSurface/Home composition with native host
// boundaries. This verifies color composition; CI owns real text/layout bounds.
import React, { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PortalContext } from '@/lib/portal/types';
import type { AssistDashboardData } from '@/types/portal/assist';

vi.mock('react-native', () => {
  const flat = (value: unknown) => Object.assign({}, ...[value].flat(Infinity).filter(Boolean));
  const View = ({ children, style, testID }: any) => <div data-testid={testID} style={{ backgroundColor: flat(style).backgroundColor }}>{children}</div>;
  return {
    View, Text: ({ children, style, testID }: any) => <span data-testid={testID} style={{ color: flat(style).color }}>{children}</span>,
    Pressable: ({ children }: { children?: ReactNode }) => <button>{children}</button>,
    StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} }, Platform: { OS: 'android' },
    useWindowDimensions: () => ({ width: 360, height: 800, fontScale: 1 }),
  };
});
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/portal/client' }));
vi.mock('@/components/ui', () => ({ PremiumButton: ({ title }: any) => <button>{title}</button> }));
vi.mock('expo-linear-gradient', async () => ({ LinearGradient: (await import('react-native')).View }));
vi.mock('@expo/vector-icons/Ionicons', () => ({ default: () => null }));
vi.mock('@/components/portal/client/ClientPortalArtwork', () => ({ ClientPortalArtwork: () => null }));
vi.mock('@/design/web/WebFontScaleProvider', () => ({ useWebFontScaleValue: () => 1 }));
vi.mock('@/design/withCareSuiteTypography', () => ({ withCareSuiteTypography: (styles: unknown) => styles }));
vi.mock('@/hooks/useDeviceClass', () => ({ useDeviceClass: () => ({ width: 360, isPhone: true }) }));
vi.mock('@/components/portal/PortalPremiumPageHero', () => ({ PortalPremiumPageHero: () => null }));
vi.mock('@/components/portal/ClientSignatureAttentionBanner', () => ({ ClientSignatureAttentionBanner: () => null }));
vi.mock('@/components/portal/PortalInfoButton', () => ({ PortalInfoButton: () => null }));
vi.mock('@/components/portal/assist/PortalNextAppointmentHero', () => ({ PortalNextAppointmentHero: () => null }));
vi.mock('@/components/office/ClientBudgetVisualCards', () => ({ ClientBudgetVisualCards: () => null }));

import { ClientPortalPageFrame } from '@/components/portal/ClientPortalPageFrame';
import { ClientPortalHomeDashboard } from '@/components/portal/assist/ClientPortalHomeDashboard';
import { PortalPremiumProvider } from '@/design/tokens/portalPremium';

let host: HTMLDivElement, root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const rgb = (css: string) => /^#[\da-f]{6}$/i.test(css)
  ? [1, 3, 5].map(offset => Number.parseInt(css.slice(offset, offset + 2), 16))
  : (css.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
const luminance = (values: number[]) => values.map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
function actualColorContrast(element: Element) {
  const foreground = rgb(getComputedStyle(element).color);
  const layers: { color: number[]; alpha: number }[] = [];
  for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
    const css = getComputedStyle(ancestor).backgroundColor;
    if (!css || css === 'transparent') continue;
    const parts = (css.match(/[\d.]+/g) ?? []).map(Number);
    const alpha = parts.length > 3 ? parts[3]! : 1;
    if (alpha === 0) continue;
    layers.push({ color: rgb(css), alpha });
    if (alpha === 1) break;
  }
  expect(layers.length).toBeGreaterThan(0);
  const background = layers.reverse().reduce((under, layer) => layer.color.map((v, i) => v * layer.alpha + under[i]! * (1 - layer.alpha)), [255, 255, 255]);
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

describe('client content surface contrast', () => {
  it.each(['#071C38', '#F4F8FD'])('keeps all actual home section text readable over outside background %s', async backgroundColor => {
    const context = { displayName: 'Helene Musterfrau', tenantName: 'Pflege & Alltag Nord' } as PortalContext;
    const data = { kpis: { appointments: 0, messages: 0, documents: 0, signatures: 0, proofs: 0, openRequests: 0, activities: 0 }, nextAppointment: null, budget: null, budgetVisuals: [] } as unknown as AssistDashboardData;
    const noop = () => undefined;
    await act(async () => root.render(<div style={{ backgroundColor }}><PortalPremiumProvider kind="client">
      <ClientPortalPageFrame title="Klient:innenportal" showHero={false} scrollable>
        <ClientPortalHomeDashboard context={context} data={data} tripsReleased={false} budgetReleased={true} proofsReleased={false} requestsReleased={false} activitiesReleased={false} onRequestChange={noop} onRequestExtra={noop} onUpload={noop} onProofs={noop} onOpenRequests={noop} onOpenActivities={noop} onRequestCallback={noop} />
      </ClientPortalPageFrame>
    </PortalPremiumProvider></div>));
    for (const id of ['client-portal-budget-heading', 'client-portal-budget-explanation', 'client-portal-sections-heading', 'client-portal-sections-explanation']) {
      const element = host.querySelector(`[data-testid="${id}"]`);
      expect(element, id).not.toBeNull(); expect(actualColorContrast(element!), id).toBeGreaterThanOrEqual(4.5);
    }
    expect(host.querySelector('[data-testid="client-portal-sections-explanation"]')?.textContent).toBe('Direkt und ohne Umwege zum gewünschten Inhalt.');
  });
});
