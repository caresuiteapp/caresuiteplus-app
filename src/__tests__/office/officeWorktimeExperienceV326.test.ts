import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('Office Arbeitszeit V32.7 Design, Struktur und Funktionen', () => {
  it('uses one bright CareSuite workspace across all ten worktime routes', () => {
    const shell = read('src/components/wfm/OfficeTimeTrackingShell.tsx');
    expect(shell).toContain('OFFICE · WORKFORCE MANAGEMENT');
    expect(shell).toContain('tab.icon');
    expect(shell).toContain('styles.navigationSurface');
    expect(shell).toContain('styles.workspace');
    expect(shell).toContain('horizontal');
    expect(shell).toContain('contentContainerStyle={styles.tabRow}');
    expect(shell).not.toContain('contentContainerStyle={styles.contentContainer}');
    expect(shell).not.toContain('styles.tabRowDesktop');
    expect(shell).not.toContain("overflow: 'hidden',\n  },\n});");
    expect(shell).toContain("backgroundColor: 'rgba(255,255,255,0.94)'");
    expect(shell).not.toContain('DarkLiquidGlassBackground');
  });

  it('makes KPIs, filters, tables and the review pane readable', () => {
    const shell = read('src/components/wfm/OfficeTimeTrackingShell.tsx');
    const layout = read('src/components/wfm/WfmOfficeTimekeepingLayout.tsx');
    const table = read('src/components/wfm/WfmOfficeTimeEntryTable.tsx');
    const detail = read('src/components/wfm/WfmOfficeTimeReviewDetailPanel.tsx');
    const dataTable = read('src/design/tokens/auroraGlass.ts');
    const button = read('src/components/ui/PremiumButton.tsx');
    expect(shell).toContain('lightSurfaceText.primary');
    expect(layout).toContain('minWidth: 138');
    expect(layout).toContain('width: 480');
    expect(layout).toContain('width >= 1760');
    expect(layout).toContain('styles.stackedDetail');
    expect(layout).toContain('onLightSurface');
    expect(table).toContain("fontSize: 13");
    expect(table).toContain("backgroundColor: 'rgba(255,255,255,0.94)'");
    expect(table).toContain('lightSurfaceText.secondary');
    expect(detail).toContain("backgroundColor: '#FFFFFF'");
    expect(detail).not.toContain('maxHeight: 760');
    expect(detail).toContain('onLightSurface');
    expect(detail).toContain('onDarkSurface={false}');
    expect(dataTable).toContain('solidSurface ? lightSurfaceText.primary : text.primary');
    expect(button).toContain("variant === 'primary' || !onDarkSurface");
  });

  it('loads only the valid live employee enum and hides the form on load errors', () => {
    const planning = read('src/lib/wfm/wfmPlanningService.ts');
    const additions = read('src/components/wfm/WfmNachtraegeOfficeScreen.tsx');
    expect(planning).toContain(".eq('status', 'active')");
    expect(planning).not.toContain("['aktiv', 'active']");
    expect(additions).toContain('!teamQuery.loading && !teamQuery.error');
  });

  it('validates additions and meetings before converting dates or writing data', () => {
    const manual = read('src/components/wfm/WfmOfficeManualEntryPanel.tsx');
    const meetings = read('src/components/wfm/WfmTeamMeetingsScreen.tsx');
    expect(manual).toContain('Das Ende muss nach dem Beginn liegen.');
    expect(manual).toContain('Eine Begründung für den Nachtrag ist erforderlich.');
    expect(meetings).toContain('Bitte mindestens eine teilnehmende Person auswählen.');
    expect(meetings.indexOf('Number.isNaN(starts.getTime())')).toBeLessThan(meetings.indexOf('starts.toISOString()'));
  });
});
