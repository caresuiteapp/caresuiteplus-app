import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), 'utf8');

describe('System scroll viewport V34.6', () => {
  it('macht Kalender und Assist-Durchführung innerhalb der Seitenschale scrollbar', () => {
    const calendar = read('src/components/calendar/CalendarShell.tsx');
    const executions = read('src/components/assist/ExecutionsListView.tsx');

    expect(calendar).toContain('<AutoScrollView');
    expect(calendar).toContain('fillViewport={false}');
    expect(executions).toContain('showsVerticalScrollIndicator');
    expect(executions).toContain('nestedScrollEnabled');
    expect(executions).toContain('minHeight: 0');
  });

  it('gibt Rechnungsdashboard und Office-Slot einen begrenzten Inhalts-Viewport', () => {
    const billing = read('src/screens/office/OfficeBillingScreen.tsx');
    const layout = read('app/office/_layout.tsx');

    expect(billing).toContain('style={styles.dashboardScroll}');
    expect(billing).toContain('showsVerticalScrollIndicator');
    expect(billing).toContain("color: '#111827'");
    expect(layout).toContain('minHeight: 0');
    expect(layout).toContain('minWidth: 0');
  });

  it('scrollt Klient:innen- und Mitarbeitendenakten unabhängig vom Hintergrund', () => {
    const client = read('src/components/office/clientdetailmodal.tsx');
    const employee = read('src/components/office/employeedetailmodal.tsx');

    for (const modal of [client, employee]) {
      expect(modal).toContain('<AutoScrollView');
      expect(modal).toContain('fillViewport={false}');
      expect(modal).toContain('minHeight: 0');
      expect(modal).toContain('minWidth: 0');
    }
  });

  it('aktiviert auf Web Mausrad, Trackpad und stabile Scrollleisten', () => {
    const autoScroll = read('src/components/layout/AutoScrollView.tsx');

    expect(autoScroll).toContain("overflowY: 'auto'");
    expect(autoScroll).toContain("overscrollBehavior: 'contain'");
    expect(autoScroll).toContain("scrollbarGutter: 'stable'");
  });
});
