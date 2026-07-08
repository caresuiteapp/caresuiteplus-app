import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('WfmExportScreen P2.2 UI contract', () => {
  const exportScreen = readSrc('src/components/wfm/WfmExportScreen.tsx');
  const route = readSrc('app/business/office/time-tracking/export.tsx');
  const shell = readSrc('src/components/wfm/OfficeTimeTrackingShell.tsx');

  it('export route renders WfmExportScreen', () => {
    expect(route).toContain('WfmExportScreen');
    expect(exportScreen).toContain('testID="wfm-export-screen"');
  });

  it('office shell wires export tab navigation', () => {
    expect(shell).toContain('OFFICE_TIME_TRACKING_TABS.map');
    const nav = readSrc('src/lib/navigation/officeTimeTrackingNav.ts');
    expect(nav).toContain("key: 'export'");
    expect(nav).toContain('export');
  });

  it('renders empty state before draft is prepared', () => {
    expect(exportScreen).toContain('Kein Export-Entwurf');
    expect(exportScreen).toContain('EmptyState');
    expect(exportScreen).toContain('Keine Export-Batches');
  });

  it('shows blocked entries with reason labels from validation', () => {
    expect(exportScreen).toContain('blockedReviews.map');
    expect(exportScreen).toContain('reasonLabel');
    expect(exportScreen).toContain('Blockierte Einträge');
  });

  it('exposes prepare and finalize actions with stable test ids', () => {
    expect(exportScreen).toContain('testID="wfm-p22-prepare-export"');
    expect(exportScreen).toContain('testID="wfm-p22-finalize-export"');
    expect(exportScreen).toContain('handlePrepareExport');
    expect(exportScreen).toContain('handleFinalizeExport');
    expect(exportScreen).toContain('validation?.valid');
  });

  it('loads history and supports internal csv download', () => {
    expect(exportScreen).toContain('listExportBatches');
    expect(exportScreen).toContain('Export-Historie');
    expect(exportScreen).toContain('buildInternalCsv');
    expect(exportScreen).toContain('testID="wfm-p22-download-csv"');
    expect(exportScreen).toContain('handleDownloadInternalCsv');
  });

  it('keeps legacy csv pdf datev export section visible', () => {
    expect(exportScreen).toContain('Legacy-Export');
    expect(exportScreen).toContain('createWfmExportJob');
    expect(exportScreen).toContain('testID="wfm-export-csv"');
    expect(exportScreen).toContain('PDF exportieren');
    expect(exportScreen).toContain('DATEV LOHN exportieren');
  });

  it('handles errors without white screens', () => {
    expect(exportScreen).toContain('ErrorState');
    expect(exportScreen).toContain('LoadingState');
    expect(exportScreen).toContain('LockedActionBanner');
    expect(exportScreen).toContain('p22Error');
    expect(exportScreen).toContain('!canExport');
  });
});
