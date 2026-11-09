import { describe, expect, it } from 'vitest';
import { employeePortalActiveId, employeePortalHeaderLayout, employeePortalLayout } from '@/components/portal/employee/employeePortalDesign';

const navigation = [
  { id: 'home', route: '/portal/employee' }, { id: 'time', route: '/portal/employee/arbeitszeit' },
  { id: 'leave', route: '/portal/employee/arbeitszeit/urlaub' }, { id: 'absence', route: '/portal/employee/arbeitszeit/abwesenheiten' },
  { id: 'documents', route: '/portal/employee/documents' }, { id: 'assignments', route: '/portal/employee/assignments' },
  { id: 'messages', route: '/portal/employee/messages' },
].map(item => ({ ...item, label: item.id, glyph: '', group: 'work' as const }));

describe('employee portal responsive navigation', () => {
  it.each([
    ['/portal/employee/times', 'time'], ['/portal/employee/times/2026-11', 'time'],
    ['/portal/employee/arbeitszeit/urlaub/', 'leave'], ['/portal/employee/arbeitszeit/abwesenheiten', 'absence'],
    ['/portal/employee/signatures/document-1', 'documents'], ['/portal/employee/documents/signatures/document-1', 'documents'],
    ['/portal/employee/assignments/visit-1/execute', 'assignments'], ['/portal/employee/messages/thread-1', 'messages'],
  ])('keeps %s on its real function', (route, id) => expect(employeePortalActiveId(route, navigation)).toBe(id));

  it('keeps small-phone metrics readable and adapts to enlarged device or Web text', () => {
    expect(employeePortalLayout(320).metricColumns).toBe(1);
    expect(employeePortalLayout(390).metricColumns).toBe(2);
    expect(employeePortalLayout(390, 1.5).metricColumns).toBe(1);
    expect(employeePortalLayout(390, 1.5).railButtonSize).toBeGreaterThan(employeePortalLayout(390).railButtonSize);
    expect(employeePortalLayout(320, 2).railWidth).toBeLessThan(130);
    expect(employeePortalLayout(768).splitFocus).toBe(false);
    expect(employeePortalLayout(1024).splitFocus).toBe(true);
    expect(employeePortalLayout(1440).groupColumns).toBe(3);
  });

  it('keeps enlarged artwork inside the rail and switches wide tiles to rows as available space shrinks', () => {
    for (const width of [320, 390, 768, 1024, 1440]) {
      const layout = employeePortalLayout(width);
      expect(layout.railArtworkSize).toBeGreaterThanOrEqual(44);
      expect(layout.railArtworkSize).toBeLessThan(layout.railButtonSize);
      expect(layout.railButtonSize).toBeLessThan(layout.railWidth);
    }
    expect(employeePortalLayout(1440).shortcutTiles).toBe(true);
    expect(employeePortalLayout(1440, 1.25).shortcutTiles).toBe(false);
    expect(employeePortalLayout(1024).shortcutTiles).toBe(false);
    expect(employeePortalLayout(390).shortcutTiles).toBe(false);
  });

  it('reserves vertical workspace in landscape and lets large controls wrap', () => {
    expect(employeePortalHeaderLayout(390, 844, 1)).toMatchObject({ phonePortrait: true, inlineStatus: false });
    expect(employeePortalHeaderLayout(844, 390, 1)).toMatchObject({ shortLandscape: true, groupedLandscape: true, inlineStatus: true, compact: true });
    expect(employeePortalHeaderLayout(768, 1024, 1)).toMatchObject({ shortLandscape: false, singleRow: false });
    expect(employeePortalHeaderLayout(1024, 768, 1)).toMatchObject({ shortLandscape: false, singleRow: true, compact: true });
    expect(employeePortalHeaderLayout(1024, 768, 1.5).singleRow).toBe(false);
    expect(employeePortalHeaderLayout(1920, 1080, 1).compact).toBe(false);
  });
});
