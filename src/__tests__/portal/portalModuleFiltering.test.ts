import { describe, expect, it } from 'vitest';
import { buildPortalDashboard } from '@/lib/portal/engine/buildPortalDashboard';
import { buildPortalNavigation } from '@/lib/portal/engine/buildPortalNavigation';
import {
  applyPortalFeatureGates,
  canAccessPortalFeature,
  isPortalBudgetFeatureEnabled,
} from '@/lib/portal/engine/portalFeatureAccess';
import { getFeaturesForModules } from '@/lib/portal/engine/portalFeatureMatrix';
import { filterPortalMobileTabs, buildDynamicTabPriority } from '@/lib/navigation/portalMobileTabs';
import { resolvePortalContextFromData } from '@/lib/portal/engine/resolvePortalContext';
import type { ShellTabConfig } from '@/types/navigation/shell';

const assistOnlyAssignment = [
  { moduleKey: 'assist' as const, isPrimary: true, isActive: true, assignedAt: '2026-01-01' },
];

function assistVisibleFeatures() {
  return getFeaturesForModules(['assist']);
}

describe('portal module → feature filtering', () => {
  it('hides budget for assist-only client without §45b data (Ellen Zacharias profile)', () => {
    const context = resolvePortalContextFromData({
      tenantId: 'tenant-1',
      clientId: 'ellen-zacharias',
      roleKey: 'client_portal',
      displayName: 'Frau Ellen Zacharias',
      tenantName: 'Helferhasen+ UG',
      assignments: assistOnlyAssignment,
      careProfile: {
        careContexts: ['daily_assistance', 'companionship'],
        configuredBudgetTypes: [],
        hasBudgetSnapshot: false,
      },
    });

    expect(context.activeModuleKeys).toEqual(['assist']);
    expect(context.visibleFeatures.some((f) => f.featureKey === 'budget')).toBe(false);
    expect(canAccessPortalFeature(context, 'assist', 'budget')).toBe(false);
    expect(canAccessPortalFeature(context, 'assist', 'trips')).toBe(true);
    expect(canAccessPortalFeature(context, 'assist', 'nachweise')).toBe(true);

    const nav = buildPortalNavigation({
      activeModuleKeys: context.activeModuleKeys,
      hasModuleAssignments: true,
      primaryModule: 'assist',
      visibleFeatures: context.visibleFeatures,
    });

    expect(nav.some((item) => item.key === 'assist-budget')).toBe(false);
    expect(nav.some((item) => item.key === 'assist-appointments')).toBe(true);
    expect(nav.some((item) => item.key === 'assist-nachweise')).toBe(false);
    expect(nav.some((item) => item.key === 'assist-aktivitaeten')).toBe(false);
    expect(canAccessPortalFeature(context, 'assist', 'nachweise')).toBe(true);
    expect(canAccessPortalFeature(context, 'assist', 'aktivitaeten')).toBe(true);
    expect(nav.some((item) => item.key === 'documents')).toBe(true);
    expect(nav.some((item) => item.key === 'messages')).toBe(true);
  });

  it('shows budget when client has §45b configured', () => {
    const baseVisible = assistVisibleFeatures();
    const enabled = applyPortalFeatureGates({
      activeModuleKeys: ['assist'],
      portalRole: 'client',
      visibilityRules: [],
      careProfile: {
        careContexts: ['daily_assistance'],
        configuredBudgetTypes: ['paragraph_45b'],
        hasBudgetSnapshot: false,
      },
      baseVisibleFeatures: baseVisible,
    });

    expect(enabled.some((f) => f.featureKey === 'budget')).toBe(true);
    expect(
      isPortalBudgetFeatureEnabled({
        activeModuleKeys: ['assist'],
        portalRole: 'client',
        visibilityRules: [],
        careProfile: {
          careContexts: ['daily_assistance'],
          configuredBudgetTypes: ['paragraph_45b'],
          hasBudgetSnapshot: false,
        },
        baseVisibleFeatures: baseVisible,
      }),
    ).toBe(true);
  });

  it('shows budget when office released visibility rule', () => {
    expect(
      isPortalBudgetFeatureEnabled({
        activeModuleKeys: ['assist'],
        portalRole: 'client',
        visibilityRules: [
          {
            moduleKey: 'assist',
            featureKey: 'budget',
            portalRole: 'client',
            isVisible: true,
            requiresRelease: true,
          },
        ],
        careProfile: {
          careContexts: ['daily_assistance'],
          configuredBudgetTypes: [],
          hasBudgetSnapshot: false,
        },
        baseVisibleFeatures: assistVisibleFeatures(),
      }),
    ).toBe(true);
  });

  it('hides assist budget widgets for pflege-only clients', () => {
    const context = resolvePortalContextFromData({
      tenantId: 'tenant-1',
      clientId: 'client-pflege',
      roleKey: 'client_portal',
      displayName: 'Maria',
      tenantName: 'Care Demo',
      assignments: [
        { moduleKey: 'pflege', isPrimary: true, isActive: true, assignedAt: '2026-01-01' },
      ],
      widgetMetrics: {
        messages_kpi: 1,
        documents_kpi: 0,
        appointments_kpi: 2,
        pflege_care_plan: 1,
      },
    });

    const widgets = buildPortalDashboard(context);
    expect(widgets.some((w) => w.widgetKey === 'assist_budget')).toBe(false);
    expect(widgets.some((w) => w.widgetKey === 'assist_trips')).toBe(false);
    expect(widgets.some((w) => w.widgetKey === 'pflege_care_plan')).toBe(true);

    const nav = buildPortalNavigation({
      activeModuleKeys: context.activeModuleKeys,
      hasModuleAssignments: true,
      primaryModule: 'pflege',
      visibleFeatures: context.visibleFeatures,
    });

    expect(nav.some((item) => item.key === 'assist-budget')).toBe(false);
    expect(nav.some((item) => item.key === 'module-pflege')).toBe(true);
  });

  it('combines assist and pflege nav when pflege is primary', () => {
    const context = resolvePortalContextFromData({
      tenantId: 'tenant-1',
      clientId: 'client-combo',
      roleKey: 'client_portal',
      displayName: 'Maria',
      tenantName: 'Care Demo',
      assignments: [
        { moduleKey: 'assist', isPrimary: false, isActive: true, assignedAt: '2026-01-01' },
        { moduleKey: 'pflege', isPrimary: true, isActive: true, assignedAt: '2026-01-02' },
      ],
    });

    const nav = buildPortalNavigation({
      activeModuleKeys: context.activeModuleKeys,
      hasModuleAssignments: true,
      primaryModule: context.primaryModule,
      visibleFeatures: context.visibleFeatures,
    });

    expect(nav.map((item) => item.key)).toEqual([
      'overview',
      'module-pflege',
      'module-assist',
      'documents',
      'messages',
      'profile',
    ]);
  });

  it('filters mobile overflow tabs by active modules', () => {
    const tabs: ShellTabConfig[] = [
      { key: 'overview', label: 'Übersicht', icon: '🏠', href: '/portal/client' },
      { key: 'assist-budget', label: 'Budget', icon: '💶', href: '/portal/client/budget' },
      { key: 'module-pflege', label: 'Pflege', icon: '🩺', href: '/portal/client?module=pflege' },
      { key: 'messages', label: 'Nachrichten', icon: '💬', href: '/portal/client/messages' },
    ];

    const pflegeOnly = filterPortalMobileTabs(tabs, ['pflege']);
    expect(pflegeOnly.some((tab) => tab.key === 'assist-budget')).toBe(false);
    expect(pflegeOnly.some((tab) => tab.key === 'module-pflege')).toBe(true);
  });

  it('excludes Nachweise and Aktivitäten from assist mobile tab priority', () => {
    const priority = buildDynamicTabPriority(['assist']);
    expect(priority).not.toContain('assist-nachweise');
    expect(priority).not.toContain('assist-aktivitaeten');
    expect(priority).toContain('assist-anfragen');
  });
});
