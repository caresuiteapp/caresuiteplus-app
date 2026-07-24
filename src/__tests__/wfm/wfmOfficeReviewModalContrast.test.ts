import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('WFM review popup and contrast contract', () => {
  it('opens review details in a centered modal without changing the list layout', () => {
    const history = read('src/components/wfm/WfmOfficeTimeHistoryPanel.tsx');
    const table = read('src/components/wfm/WfmOfficeTimeEntryTable.tsx');

    expect(history).toContain('<PlatformModal');
    expect(history).toContain('visible={Boolean(selected)}');
    expect(history).toContain('variant="center"');
    expect(history).toContain('maxHeightRatio={0.92}');
    expect(history).toContain('{reviewQueueMode ? (');
    expect(table).toContain('const mobileReview = reviewQueueMode && width < 1760');
    expect(table).not.toContain('width < 1760 || Boolean(selectedId)');
  });

  it('uses explicit high-contrast colors on the light worktime surfaces', () => {
    const table = read('src/components/wfm/WfmOfficeTimeEntryTable.tsx');
    const detail = read('src/components/wfm/WfmOfficeTimeReviewDetailPanel.tsx');
    const layout = read('src/components/wfm/WfmOfficeTimekeepingLayout.tsx');
    const shell = read('src/components/wfm/OfficeTimeTrackingShell.tsx');

    expect(table).toContain("primary: '#0F172A'");
    expect(table).toContain("muted: { text: '#334155'");
    expect(table).toContain('ReadableStatusBadge');
    expect(detail).toContain("secondary: '#334155'");
    expect(detail).toContain("border: '#CBD5E1'");
    expect(layout).toContain('WORKTIME_TEXT');
    expect(shell).toContain('SHELL_TEXT');
  });

  it('keeps the explicit dark input color after the shared typography style', () => {
    const detail = read('src/components/wfm/WfmOfficeTimeReviewDetailPanel.tsx');
    const inputStyleStart = detail.indexOf('  input: {');
    const inputStyleEnd = detail.indexOf('  history:', inputStyleStart);
    const inputStyle = detail.slice(inputStyleStart, inputStyleEnd);

    expect(inputStyleStart).toBeGreaterThan(-1);
    expect(inputStyle).toContain('...typography.body');
    expect(inputStyle).toContain('color: REVIEW_TEXT.primary');
    expect(inputStyle.indexOf('...typography.body')).toBeLessThan(
      inputStyle.indexOf('color: REVIEW_TEXT.primary'),
    );
    expect(detail.match(/selectionColor="#2563EB"/g)).toHaveLength(2);
  });
});
