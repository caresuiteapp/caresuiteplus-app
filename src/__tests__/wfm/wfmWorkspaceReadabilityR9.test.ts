import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

describe('WFM workspace navigation, readability and width use R9', () => {
  it('routes the visible Einstellungen tab only to WFM settings', () => {
    const shell = read('src/components/wfm/OfficeTimeTrackingShell.tsx');
    const route = read('app/business/office/time-tracking/einstellungen.tsx');

    expect(shell).toContain("tab.key === 'einstellungen'");
    expect(shell).toContain("router.replace('/business/office/time-tracking/einstellungen'");
    expect(shell).toContain('office-time-tab-${tab.key}');
    expect(route).toContain('TimeTrackingSettingsScreen');
    expect(route).not.toContain('Client');
  });

  it('keeps every navigation tab visible and readable in the desktop strip', () => {
    const shell = read('src/components/wfm/OfficeTimeTrackingShell.tsx');

    expect(shell).toContain("width: '100%'");
    expect(shell).toContain('flexGrow: 1');
    expect(shell).toContain("justifyContent: 'center'");
  });

  it('uses actual workspace width and does not force desktop reviews into mobile cards', () => {
    const table = read('src/components/wfm/WfmOfficeTimeEntryTable.tsx');
    const dataTable = read('src/components/ui/PremiumDataTable.tsx');

    expect(table).toContain('onLayout={(event) => setAvailableWidth');
    expect(table).toContain('reviewWidth < REVIEW_MIN_TABLE_WIDTH + 32');
    expect(table).not.toContain('width < 1760');
    expect(dataTable).toContain('width: fixedLayout ? "100%" : undefined');
  });

  it('corrects legacy white table ink on bright workspace tables', () => {
    const css = read('src/design/web/healthOSPageContractCss.ts');

    expect(css).toContain('[data-cs-healthos-component="table"] [style*="color: rgb(255, 255, 255)"]');
    expect(css).toContain('[data-cs-healthos-component="table"] [style*="color: rgb(248, 246, 255)"]');
  });
});
