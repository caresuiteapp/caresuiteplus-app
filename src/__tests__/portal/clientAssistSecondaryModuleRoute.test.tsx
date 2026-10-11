// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFeaturesForModules } from '@/lib/portal/engine/portalFeatureMatrix';
import type { PortalContext } from '@/lib/portal/types';

const f = vi.hoisted(() => ({ context: null as PortalContext | null, params: { module: 'assist', section: 'begleitungen' } }));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => f.params, useRouter: () => ({}), Redirect: ({ href }: { href: string }) => <div>{href}</div> }));
vi.mock('@/hooks/usePortalContext', () => ({ usePortalContext: () => ({ context: f.context, loading: false, error: null, refresh: vi.fn() }) }));
vi.mock('@/hooks/useDeviceClass', () => ({ useDeviceClass: () => ({ width: 390, isPhone: true }) }));
vi.mock('@/components/portal/assist', () => ({
  AssistPortalOverview: () => <div>Overview</div>,
  AssistPortalSectionBlocked: ({ section }: { section: string }) => <div>Blocked:{section}</div>,
  AssistPortalSectionView: ({ section }: { section: string }) => <div>Live:{section}</div>,
}));
vi.mock('@/components/ui', () => ({ EmptyState: () => null, ErrorState: () => null, LoadingState: () => null, PremiumButton: () => null, SuccessState: () => null }));
vi.mock('@/components/portal/AdaptivePortalDashboard', () => ({ AdaptivePortalDashboard: () => null }));
vi.mock('@/components/portal/assist/MobilePortalKpiCard', () => ({ MobilePortalKpiCard: () => null }));
vi.mock('@/components/portal/assist/PortalGlassHero', () => ({ PortalGlassHero: () => null }));
vi.mock('@/design/components/GlassCard', () => ({ GlassCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/design/tokens/auroraGlass', () => ({ useAuroraAdaptiveText: () => ({ primary: '#000', muted: '#333', secondary: '#333' }) }));
import { AdaptivePortalOverview } from '@/components/portal/AdaptivePortalOverview';

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  f.context = {
    primaryModule: 'pflege', activeModuleKeys: ['pflege', 'assist'], hasModuleAssignments: true,
    portalRole: 'client', visibleFeatures: getFeaturesForModules(['pflege', 'assist']), visibilityRules: [],
    careProfile: { careContexts: [], configuredBudgetTypes: [], hasBudgetSnapshot: false },
    widgets: [], widgetMetrics: {},
  } as unknown as PortalContext;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe('Assist section routes with another primary module', () => {
  it('opens released live accompaniments when Assist is an active secondary module', async () => {
    await act(async () => root.render(<AdaptivePortalOverview />));
    expect(host.textContent).toBe('Live:begleitungen');
  });
  it('retains the feature release gate for the same deep link', async () => {
    f.context!.visibleFeatures = f.context!.visibleFeatures.filter((feature) => feature.featureKey !== 'trips');
    await act(async () => root.render(<AdaptivePortalOverview />));
    expect(host.textContent).toBe('Blocked:begleitungen');
  });
});
