import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('HealthOS system-wide page architecture V38.0', () => {
  it('binds every productive shell family to the same work surface', () => {
    const surface = read('src/components/layout/HealthOSPageSurface.tsx');
    const shell = read('src/components/layout/ScreenShell.tsx');
    const careLight = read('src/components/layout/CareLightScreen.tsx');
    const platform = read('src/components/platformConsole/PlatformShellLayout.tsx');
    const employee = read('src/components/portal/EmployeePortalPageFrame.tsx');

    expect(surface).toContain("csHealthosPage: 'surface'");
    expect(shell).toContain('<HealthOSPageSurface');
    expect(careLight).toContain('<HealthOSPageSurface');
    expect(platform).toContain('<HealthOSPageSurface');
    expect(employee).toContain('<HealthOSPageSurface');
  });

  it('keeps controls in one fixed action-filter-tab-content order', () => {
    const shell = read('src/components/layout/ScreenShell.tsx');
    const employee = read('src/components/portal/EmployeePortalPageFrame.tsx');

    const orderedZones = [
      '<HealthOSPageZone kind="actions">',
      '<HealthOSPageZone kind="filters">',
      '<HealthOSPageZone kind="tabs">',
      '<HealthOSPageZone kind="content">',
    ];

    for (const source of [shell, employee]) {
      const positions = orderedZones.map((marker) => source.indexOf(marker));
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
  });

  it('routes legacy C14 actions through the shared action zone', () => {
    const c14 = read('src/components/layout/C14vSubpageShell.tsx');
    const portal = read('src/screens/portal/PortalTabScreen.tsx');

    expect(c14).toContain('actionsSlot={actionBar}');
    expect(portal).toContain('actionsSlot={actionsSlot}');
  });

  it('keeps the Arbeitszeit review cards and popup readable on dark glass', () => {
    const layout = read('src/components/wfm/WfmOfficeTimekeepingLayout.tsx');
    const table = read('src/components/wfm/WfmOfficeTimeEntryTable.tsx');
    const detail = read('src/components/wfm/WfmOfficeTimeReviewDetailPanel.tsx');
    const history = read('src/components/wfm/WfmOfficeTimeHistoryPanel.tsx');

    for (const source of [layout, table, detail, history]) {
      expect(source).toContain('WORKTIME_');
    }
    expect(layout).not.toContain("backgroundColor: 'rgba(255,255,255,0.96)'");
    expect(table).not.toContain("backgroundColor: '#FAFBFC'");
    expect(detail).not.toContain("backgroundColor: '#FFFFFF'");
    expect(history).not.toContain("backgroundColor: '#F8FAFC'");
  });

  it('provides a web fallback for readable fields inside the shared surface', () => {
    const html = read('app/+html.tsx');
    const css = read('src/design/web/healthOSPageContractCss.ts');

    expect(html).toContain('${HEALTHOS_PAGE_CONTRACT_CSS}');
    expect(css).toContain('[data-cs-healthos-page="surface"] input');
    expect(css).toContain('caret-color: #69E8FF');
  });
});
