// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFeaturesForModules } from '@/lib/portal/engine/portalFeatureMatrix';
import type { PortalContext, PortalDashboardWidget } from '@/lib/portal/types';

const f = vi.hoisted(() => ({ context: null as PortalContext | null, params: { module: 'assist', section: 'begleitungen' }, refresh: vi.fn() }));
vi.mock('expo-router', () => ({ useLocalSearchParams: () => f.params, useRouter: () => ({}), Redirect: ({ href }: { href: string }) => <div>{href}</div> }));
vi.mock('@/hooks/usePortalContext', () => ({ usePortalContext: () => ({ context: f.context, loading: false, error: null, refreshWithResult: f.refresh }) }));
vi.mock('@/hooks/useDeviceClass', () => ({ useDeviceClass: () => ({ width: 390, isPhone: true }) }));
vi.mock('@/components/portal/assist', () => ({
  AssistPortalOverview: () => <div>Overview</div>,
  AssistPortalSectionBlocked: ({ section }: { section: string }) => <div>Blocked:{section}</div>,
  AssistPortalSectionView: ({ section }: { section: string }) => <div>Live:{section}</div>,
}));
vi.mock('@/components/ui', () => ({ EmptyState: () => null, ErrorState: () => null, LoadingState: () => null, PremiumButton: ({ title, onPress }: { title: string; onPress: () => void }) => <button onClick={onPress}>{title}</button>, SuccessState: () => null }));
vi.mock('@/components/portal/AdaptivePortalDashboard', () => ({ AdaptivePortalDashboard: ({ widgets }: { widgets: PortalDashboardWidget[] }) => <div>{widgets.map(widget => <span data-widget={widget.widgetKey} key={widget.widgetKey}>{widget.title}</span>)}</div> }));
vi.mock('@/components/portal/assist/MobilePortalKpiCard', () => ({ MobilePortalKpiCard: () => null }));
vi.mock('@/components/portal/assist/PortalGlassHero', () => ({ PortalGlassHero: () => null }));
vi.mock('@/design/components/GlassCard', () => ({ GlassCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/design/tokens/auroraGlass', () => ({ useAuroraAdaptiveText: () => ({ primary: '#000', muted: '#333', secondary: '#333' }) }));
import { AdaptivePortalOverview } from '@/components/portal/AdaptivePortalOverview';

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  f.params = { module: 'assist', section: 'begleitungen' }; f.refresh.mockReset().mockResolvedValue(true);
  f.context = {
    displayName: 'Anna Test', tenantName: 'Testorganisation',
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
  it('shows released contents together without a chooser, retaining feature gates and refresh confirmation', async () => {
    f.params = { module: 'pflege', section: 'legacy-overview' };
    const onRefresh = vi.fn();
    await act(async () => root.render(<AdaptivePortalOverview onRefresh={onRefresh} />));
    expect(host.querySelector('[data-widget="pflege_care_plan"]')).not.toBeNull();
    expect(host.querySelector('[data-widget="assist_next_visit"]')).not.toBeNull();
    expect(host.textContent).not.toContain('Alle Module');
    expect(host.querySelectorAll('button')).toHaveLength(1);
    f.context = { ...f.context!, visibleFeatures: f.context!.visibleFeatures.filter(feature => feature.featureKey !== 'care_plan') };
    await act(async () => root.render(<AdaptivePortalOverview onRefresh={onRefresh} />));
    expect(host.querySelector('[data-widget="pflege_care_plan"]')).toBeNull();
    expect(host.querySelector('[data-widget="assist_next_visit"]')).not.toBeNull();
    f.refresh.mockResolvedValueOnce(false);
    await act(async () => host.querySelector('button')!.click());
    expect(onRefresh).not.toHaveBeenCalled();
    await act(async () => host.querySelector('button')!.click());
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
