import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('HealthOS Fahrtenbuch R13', () => {
  it('stellt das Fahrtenbuch als eigenständige Office-Route bereit', () => {
    expect(read('app/business/office/fahrtenbuch/index.tsx')).toContain('EmployeeLogbookHubScreen');
    const screen = read('src/screens/office/EmployeeLogbookHubScreen.tsx');
    expect(screen).toContain('testID="employee-logbook-hub-screen"');
    expect(screen).toContain('EmployeeLogbookOfficePanel');
    expect(screen).toContain('MITARBEITENDENAUSWAHL');
  });

  it('führt Fahrtenbuch als App, Widget und Navigationseintrag', () => {
    const desktop = read('src/liquid-command/screens/CommandCenterScreen.tsx');
    expect(desktop).toContain('id: "logbook", label: "Fahrtenbuch"');
    expect(desktop).toContain('route: "/business/office/fahrtenbuch"');
    expect(desktop).toContain('22-fahrtenbuch.png');
    expect(desktop).toContain('["Fahrtenbuch", "⌖", "logbook"]');
    expect(desktop).toContain('"salary", "logbook", "documents", "billing"');
    expect(desktop).toContain('caresuite.healthos.desktop-widgets.v3');
    expect(desktop).toContain('migrateDesktopIdsToR13');
  });
});
