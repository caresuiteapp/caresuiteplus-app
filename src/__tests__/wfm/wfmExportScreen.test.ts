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
    expect(exportScreen).toContain('listReviewedTimeExports');
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

describe('WfmExportScreen P2.3 UI contract', () => {
  const exportScreen = readSrc('src/components/wfm/WfmExportScreen.tsx');

  it('renders P2.3 correction section', () => {
    expect(exportScreen).toContain('testID="wfm-p23-section"');
    expect(exportScreen).toContain('Korrektur & Re-Export (P2.3)');
    expect(exportScreen).toContain('wfmTimeCorrectionExportService');
  });

  it('imports WfmTimeExportItem from export service', () => {
    expect(exportScreen).toContain('type WfmTimeExportItem');
    expect(exportScreen).toMatch(
      /type WfmTimeExportItem[\s\S]*from '@\/lib\/wfm\/wfmTimeExportService'/,
    );
  });

  it('lists correction candidates and shows export metadata', () => {
    expect(exportScreen).toContain('listReviewedTimeCorrectionCandidates');
    expect(exportScreen).toContain('reviewExportBadgeLabel');
    expect(exportScreen).toContain('export_version');
    expect(exportScreen).toContain('changed_after_export');
    expect(exportScreen).toContain('logical_reference_key');
    expect(exportScreen).toContain('item_status');
  });

  it('requires correction reason before draft and finalize', () => {
    expect(exportScreen).toContain('WFM_CORRECTION_REASON_MIN_LENGTH');
    expect(exportScreen).toContain('testID="wfm-p23-correction-reason"');
    expect(exportScreen).toContain('correctionReasonValid');
    expect(exportScreen).toContain('!correctionReasonValid');
    expect(exportScreen).toContain('Korrekturgrund erforderlich');
  });

  it('runs draft preview validate finalize via correction facade', () => {
    expect(exportScreen).toContain('draftReviewedTimeCorrectionExport');
    expect(exportScreen).toContain('validateCorrectionExportDraft');
    expect(exportScreen).toContain('finalizeReviewedTimeCorrectionExport');
    expect(exportScreen).toContain('testID="wfm-p23-draft-correction"');
    expect(exportScreen).toContain('testID="wfm-p23-validate-correction"');
    expect(exportScreen).toContain('testID="wfm-p23-finalize-correction"');
    expect(exportScreen).toContain('wfm-p23-correction-preview');
  });

  it('blocks finalize without validate and preview', () => {
    expect(exportScreen).toContain('correctionValidated');
    expect(exportScreen).toContain('correctionPreviewItems.length === 0');
    expect(exportScreen).toContain('Finalize nur nach Preview und Validate');
  });

  it('gates entire screen for users without export permission', () => {
    expect(exportScreen).toContain("can('time.tracking.admin.export')");
    expect(exportScreen).toContain('LockedActionBanner');
  });

  it('does not auto-finalize on mount', () => {
    const mountEffect =
      exportScreen.match(
        /useEffect\(\(\) => \{\s*void loadHistory\(\);\s*void loadCorrectionCandidates\(\);[\s\S]*?\}, \[loadHistory, loadCorrectionCandidates\]\)/,
      )?.[0] ?? '';
    expect(mountEffect).toContain('loadCorrectionCandidates');
    expect(mountEffect).not.toContain('handleFinalizeCorrection');
  });

  it('shows item timeline and action history when data available', () => {
    expect(exportScreen).toContain('getExportItemTimeline');
    expect(exportScreen).toContain('listReviewActionsForReviews');
    expect(exportScreen).toContain('Export-Item Timeline');
    expect(exportScreen).toContain('Action-Historie');
  });
});
