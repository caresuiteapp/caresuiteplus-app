import { describe, expect, it } from 'vitest';
import { OFFICE_AREA_SHORTCUTS } from '@/data/demo/officeDashboard';
import {
  OFFICE_AREA_TABS,
  OFFICE_NAV_AREAS,
  OFFICE_QUICK_ACCESS_LABELS,
  OFFICE_QUICK_ACCESS_ROUTES,
} from '@/lib/navigation/officeNavigation';
import { OFFICE_TABS } from '@/lib/navigation/shellConfig';

describe('Office navigation parity', () => {
  it('sidebar area tabs match Schnellzugriff labels 1:1', () => {
    const sidebarAreaLabels = OFFICE_AREA_TABS.map((tab) => tab.label);
    const quickAccessLabels = OFFICE_AREA_SHORTCUTS.map((area) => area.label);

    expect(sidebarAreaLabels).toEqual(OFFICE_QUICK_ACCESS_LABELS);
    expect(quickAccessLabels).toEqual(OFFICE_QUICK_ACCESS_LABELS);
    expect(sidebarAreaLabels).toEqual(quickAccessLabels);
  });

  it('sidebar area tabs match Schnellzugriff routes 1:1', () => {
    const sidebarRoutes = OFFICE_AREA_TABS.map((tab) => tab.href);
    const quickAccessRoutes = OFFICE_AREA_SHORTCUTS.map((area) => area.href);

    expect(sidebarRoutes).toEqual(OFFICE_QUICK_ACCESS_ROUTES);
    expect(quickAccessRoutes).toEqual(OFFICE_QUICK_ACCESS_ROUTES);
  });

  it('OFFICE_TABS includes dashboard home plus all navigable areas', () => {
    expect(OFFICE_TABS[0]).toMatchObject({ key: 'index', label: 'Office', href: '/office' });
    expect(OFFICE_TABS.slice(1)).toEqual(OFFICE_AREA_TABS);
    expect(OFFICE_TABS.length).toBe(OFFICE_NAV_AREAS.length + 1);
  });

  it('uses consistent Mitarbeitende and Modulzuordnungen labels', () => {
    const labels = OFFICE_NAV_AREAS.map((area) => area.label);
    expect(labels).toContain('Mitarbeitende');
    expect(labels).toContain('Modulzuordnungen');
    expect(labels).not.toContain('Team');
    expect(labels).not.toContain('Module');
  });

  it('includes admin areas missing from previous sidebar', () => {
    const routes = OFFICE_NAV_AREAS.map((area) => area.href);
    expect(routes).toContain('/business/office/qm');
    expect(routes).toContain('/business/office/access');
    expect(routes).toContain('/business/office/audit-log');
  });

  it('all routes are absolute paths without placeholders', () => {
    for (const area of OFFICE_NAV_AREAS) {
      expect(area.href.startsWith('/')).toBe(true);
      expect(area.href).not.toContain('coming-soon');
      expect(area.label.length).toBeGreaterThan(2);
    }
  });
});
