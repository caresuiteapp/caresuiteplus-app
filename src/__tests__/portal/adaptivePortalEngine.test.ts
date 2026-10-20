import { describe, expect, it } from 'vitest';
import { buildPortalDashboard } from '@/lib/portal/engine/buildPortalDashboard';
import { buildPortalNavigation } from '@/lib/portal/engine/buildPortalNavigation';
import { resolvePortalContextFromData } from '@/lib/portal/engine/resolvePortalContext';
import { resolvePortalTerminology } from '@/lib/portal/engine/portalTerminology';

describe('resolvePortalContextFromData', () => {
  it('marks empty assignments as onboarding state', () => {
    const context = resolvePortalContextFromData({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      roleKey: 'client_portal',
      displayName: 'Maria',
      tenantName: 'Care Demo',
      assignments: [],
    });

    expect(context.hasModuleAssignments).toBe(false);
    expect(context.activeModuleKeys).toEqual([]);
    expect(context.primaryModule).toBeNull();
  });

  it('resolves primary module with pflege priority', () => {
    const context = resolvePortalContextFromData({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      roleKey: 'client_portal',
      displayName: 'Maria',
      tenantName: 'Care Demo',
      assignments: [
        { moduleKey: 'assist', isPrimary: true, isActive: true, assignedAt: '2026-01-01' },
        { moduleKey: 'pflege', isPrimary: false, isActive: true, assignedAt: '2026-01-02' },
      ],
    });

    expect(context.activeModuleKeys).toEqual(['pflege', 'assist']);
    expect(context.primaryModule).toBe('assist');
    expect(context.hasModuleAssignments).toBe(true);
  });
});

describe('buildPortalNavigation', () => {
  it('includes overview, module tabs, and global items', () => {
    const nav = buildPortalNavigation({
      activeModuleKeys: ['pflege', 'assist'],
      hasModuleAssignments: true,
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

  it('shows only overview and global tabs without assignments', () => {
    const nav = buildPortalNavigation({
      activeModuleKeys: [],
      hasModuleAssignments: false,
    });

    expect(nav.map((item) => item.key)).toEqual(['overview', 'documents', 'messages', 'profile']);
  });
});

describe('buildPortalDashboard', () => {
  it('orders pflege widgets before assist widgets', () => {
    const context = resolvePortalContextFromData({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      roleKey: 'client_portal',
      displayName: 'Maria',
      tenantName: 'Care Demo',
      assignments: [
        { moduleKey: 'assist', isPrimary: false, isActive: true, assignedAt: '2026-01-01' },
        { moduleKey: 'pflege', isPrimary: true, isActive: true, assignedAt: '2026-01-02' },
      ],
      metrics: { upcomingAppointments: 2, documents: 0, openMessages: 1 },
      widgetMetrics: {
        messages_kpi: 1,
        documents_kpi: 0,
        appointments_kpi: 2,
        pflege_care_plan: 1,
        assist_next_visit: 2,
      },
    });

    const widgets = buildPortalDashboard(context);
    const pflegeIndex = widgets.findIndex((w) => w.widgetKey === 'pflege_care_plan');
    const assistIndex = widgets.findIndex((w) => w.widgetKey === 'assist_next_visit');

    expect(pflegeIndex).toBeGreaterThan(-1);
    expect(assistIndex).toBeGreaterThan(-1);
    expect(pflegeIndex).toBeLessThan(assistIndex);
  });

  it('maps live KPI metrics to global widgets', () => {
    const context = resolvePortalContextFromData({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      roleKey: 'client_portal',
      displayName: 'Maria',
      tenantName: 'Care Demo',
      assignments: [{ moduleKey: 'assist', isPrimary: true, isActive: true, assignedAt: '2026-01-01' }],
      metrics: { upcomingAppointments: 3, documents: 2, openMessages: 5 },
      widgetMetrics: {
        messages_kpi: 5,
        documents_kpi: 2,
        appointments_kpi: 3,
        assist_next_visit: 1,
      },
    });

    const widgets = buildPortalDashboard(context);
    const messages = widgets.find((w) => w.widgetKey === 'messages_kpi');
    const appointments = widgets.find((w) => w.widgetKey === 'appointments_kpi');

    expect(messages?.metricValue).toBe(5);
    expect(appointments?.metricValue).toBe(3);
  });

  it('maps module widget metrics from widgetMetrics', () => {
    const context = resolvePortalContextFromData({
      tenantId: 'tenant-1',
      clientId: 'client-1',
      roleKey: 'client_portal',
      displayName: 'Maria',
      tenantName: 'Care Demo',
      assignments: [
        { moduleKey: 'pflege', isPrimary: true, isActive: true, assignedAt: '2026-01-01' },
      ],
      widgetMetrics: {
        messages_kpi: 0,
        documents_kpi: 0,
        appointments_kpi: 0,
        pflege_care_plan: 2,
        pflege_vitals: 4,
        pflege_medications: 3,
      },
    });

    const widgets = buildPortalDashboard(context);
    expect(widgets.find((w) => w.widgetKey === 'pflege_care_plan')?.metricValue).toBe(2);
    expect(widgets.find((w) => w.widgetKey === 'pflege_vitals')?.metricValue).toBe(4);
    expect(widgets.find((w) => w.widgetKey === 'pflege_medications')?.metricValue).toBe(3);
  });
});

describe('portalTerminology', () => {
  it('uses Einsatz labels for assist primary module', () => {
    const terms = resolvePortalTerminology('assist');
    expect(terms.appointmentLabel).toBe('Einsatz');
    expect(terms.appointmentLabelPlural).toBe('Einsätze');
  });

  it('uses Einsatz labels for pflege primary module', () => {
    const terms = resolvePortalTerminology('pflege');
    expect(terms.appointmentLabel).toBe('Einsatz');
    expect(terms.appointmentLabelPlural).toBe('Einsätze');
  });

  it('uses Bewohnertermin labels for stationaer', () => {
    const terms = resolvePortalTerminology('stationaer');
    expect(terms.appointmentLabel).toBe('Bewohnertermin');
  });
});
