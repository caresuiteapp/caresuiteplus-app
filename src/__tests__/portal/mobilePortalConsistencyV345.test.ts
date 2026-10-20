import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Mobile Portal Consistency V34.5', () => {
  it('erzwingt eine gemeinsame Mitarbeiterportal-Seitenarchitektur', () => {
    const screen = read('src/screens/portal/PortalTabScreen.tsx');
    expect(screen).toContain("pathname.startsWith('/portal/employee')");
    expect(screen).toContain('<EmployeePortalPageFrame');
    expect(read('src/components/portal/EmployeePortalPageFrame.tsx')).toContain('employee-portal-page-frame');
  });

  it('verwendet für Mitarbeitenden-Tabs den räumlichen statt hellen Hero', () => {
    const hero = read('src/components/portal/PortalTabHero.tsx');
    expect(hero).toContain('PortalTabHeroSpatial');
    expect(hero).toContain("props.scope === 'portal_employee'");
    expect(hero).toContain('SpatialPortalSection');
  });

  it('führt Nachrichten und Arbeitszeitbereiche über PortalTabScreen', () => {
    const files = [
      'src/screens/communication/PortalMessagesScreens.tsx',
      'src/components/wfm/EmployeePortalTimesScreen.tsx',
      'src/components/timeTracking/TimeTrackingEmployeeScreen.tsx',
      'src/components/wfm/WfmAbsencePortalScreen.tsx',
      'src/screens/portal/EmployeePortalAnnouncementsScreen.tsx',
    ];
    for (const file of files) expect(read(file)).toContain('PortalTabScreen');
  });

  it('entfernt helle Legacy-Textpaletten aus dunklen Portalflächen', () => {
    const upload = read('src/components/portal/EmployeePortalUploadScreen.tsx');
    const document = read('src/components/portal/PortalDocumentListCard.tsx');
    expect(upload).not.toContain('useAuroraAdaptiveText');
    expect(document).not.toContain('lightSurfaceText');
    expect(document).not.toContain('careLightColors');
  });

  it('führt auch Detailseiten und Einsatzdurchführung durch dieselbe Architektur', () => {
    const subpage = read('src/components/layout/C14vSubpageShell.tsx');
    const execution = read('src/screens/portal/EmployeePortalVisitExecutionScreen.tsx');
    expect(subpage).toContain("pathname.startsWith('/portal/employee')");
    expect(subpage).toContain('<PortalTabScreen');
    expect(execution).toContain('<PortalTabScreen');
    expect(execution).not.toContain('<ScreenShell');
  });
});
