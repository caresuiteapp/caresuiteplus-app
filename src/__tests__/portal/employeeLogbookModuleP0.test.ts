import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

describe('employee logbook standalone module P0', () => {
  it('keeps the module reachable in both portal navigation systems', () => {
    const canonicalNavigation = read('src/lib/navigation/employeePortalNavigation.ts');
    const liquidNavigation = read('src/liquid-command/navigation/portalCatalog.ts');
    const liquidShell = read('src/liquid-command/shell/LiquidPortalRouteLayout.tsx');

    expect(canonicalNavigation).toContain("key: 'logbook'");
    expect(canonicalNavigation).toContain("href: '/portal/employee/fahrtenbuch'");
    expect(liquidNavigation).toContain("id: 'logbook'");
    expect(liquidShell).not.toContain("item.id !== 'logbook'");
  });

  it('provides one dedicated dashboard widget that opens the complete module', () => {
    const widget = read('src/liquid-command/components/EmployeeLogbookWidget.tsx');
    const home = read('src/liquid-command/screens/PortalHomeScreen.tsx');

    expect(home).toContain('<EmployeeLogbookWidget />');
    expect(widget).toContain('EIGENES MODUL · FAHRTENBUCH');
    expect(widget).toContain("router.push('/portal/employee/fahrtenbuch'");
    expect(widget).toContain('Kilometer');
    expect(widget).toContain('Vergütung');
  });

  it('uses a standalone detailed page with overview, recording, trips, receipts and profile', () => {
    const screen = read('src/screens/portal/EmployeeLogbookScreen.tsx');

    expect(screen).toContain("useState<Tab>('overview')");
    expect(screen).toContain("['overview','Übersicht']");
    expect(screen).toContain("['record','Aufzeichnen']");
    expect(screen).toContain("['trips','Meine Fahrten']");
    expect(screen).toContain("['receipts','Belege']");
    expect(screen).toContain("['profile','Führerschein']");
    expect(screen).toContain('testID="employee-logbook-overview"');
  });
});
