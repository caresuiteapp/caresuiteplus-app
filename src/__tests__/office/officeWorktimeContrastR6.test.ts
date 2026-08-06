import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

describe('Office Arbeitszeit Kontrast R6', () => {
  it('erzwingt für den vollständigen Arbeitszeit-Router eine helle Arbeitsfläche', () => {
    const shell = read('src/components/wfm/OfficeTimeTrackingShell.tsx');
    const surface = read('src/design/tokens/surfaceContrast.tsx');

    expect(shell).toContain("from '@/design/tokens/surfaceContrast'");
    expect(shell).toContain('<SurfaceContrastProvider tone="light">');
    expect(surface).toContain("'adaptive' | 'light' | 'dark'");
    expect(surface).toContain('useSurfaceContrastTone');
  });

  it('richtet adaptive Glasflächen und Texte nach der tatsächlichen Oberfläche aus', () => {
    const glass = read('src/design/tokens/auroraGlass.ts');

    expect(glass).toContain('resolveSurfaceIsLight(surfaceTone, isLight)');
    expect(glass).toContain("surfaceTone === 'light'");
    expect(glass).toContain('portal.active || surfaceIsLight ? false : isDark');
  });

  it('macht gemeinsame Karten, Eingaben, Filter, Tabs und Buttons auf hellen Flächen lesbar', () => {
    const section = read('src/components/ui/SectionPanel.tsx');
    const input = read('src/components/ui/PremiumInput.tsx');
    const filter = read('src/components/ui/FilterChip.tsx');
    const tabs = read('src/components/ui/SegmentedTabs.tsx');
    const button = read('src/components/ui/PremiumButton.tsx');

    expect(section).toContain("const forceLightSurface = surfaceTone === 'light'");
    expect(section).toContain('lightSurfaceText.primary');
    expect(input).toContain("surfaceTone === 'light'");
    expect(filter).toContain("surfaceTone === 'light'");
    expect(tabs).toContain("surfaceTone === 'light'");
    expect(button).toContain("surfaceTone === 'light' || !onDarkSurface");
  });

  it('verwendet für Zeit-, Prüf- und Detailtabellen ausschließlich die lesbare Office-Palette', () => {
    const layout = read('src/components/wfm/WfmOfficeTimekeepingLayout.tsx');
    const table = read('src/components/wfm/WfmOfficeTimeEntryTable.tsx');
    const review = read('src/components/wfm/WfmOfficeTimeReviewDetailPanel.tsx');
    const history = read('src/components/wfm/WfmOfficeTimeHistoryPanel.tsx');

    expect(layout).toContain("primary: '#0B2342'");
    expect(layout).toContain("secondary: '#31597F'");
    expect(layout).toContain("panel: '#F4F9FF'");
    expect(table).toContain('const TABLE_TEXT = WORKTIME_TEXT');
    expect(table).toContain('backgroundColor: WORKTIME_SURFACE.card');
    expect(review).toContain('const REVIEW_TEXT = WORKTIME_TEXT');
    expect(review).toContain('backgroundColor: WORKTIME_SURFACE.panel');
    expect(history).toContain('backgroundColor: WORKTIME_SURFACE.panel');
  });
});
