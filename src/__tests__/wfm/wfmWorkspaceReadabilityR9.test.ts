import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(file, 'utf8');

// Check declared opaque colours independently of selector spelling. This is a
// token contract; it does not prove a browser's rendered pixels or overlays.
const luminance = (hex: string) => {
  const channels = [1, 3, 5].map((index) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
};
const contrast = (a: string, b: string) => {
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

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
    expect(table).toContain('const minimumTableWidth = REVIEW_MIN_TABLE_WIDTH + (approval ? 110 : 0)');
    expect(table).toContain('reviewWidth < minimumTableWidth + 32');
    expect(table).toContain('minTableWidth={minimumTableWidth}');
    expect(table).not.toContain('width < 1760');
    expect(dataTable).toContain('width: fixedLayout ? "100%" : undefined');
  });

  it('uses centralized dark ink directly in bright workspace table cells and headers', () => {
    const table = read('src/components/wfm/WfmOfficeTimeEntryTable.tsx');
    const palette = read('src/components/wfm/WfmOfficeTimekeepingLayout.tsx');
    const sharedTable = read('src/components/ui/PremiumDataTable.tsx');
    const glass = read('src/design/tokens/auroraGlass.ts');
    const page = read('src/components/layout/HealthOSPageSurface.tsx');
    expect(read('src/components/layout/HealthOSPageSurface.web.tsx')).toContain("from './HealthOSPageSurface.tsx'");
    const css = read('src/design/web/centralHealthOSPopupContractCss.ts');

    expect(table).toContain('const TABLE_TEXT = WORKTIME_TEXT');
    expect(table).toContain('...typography.body, color: TABLE_TEXT.primary');
    expect(table).toContain('...typography.body, color: TABLE_TEXT.secondary');
    expect(palette).toContain("primary: '#0B2342'");
    expect(palette).toContain("secondary: '#31597F'");
    expect(sharedTable).toContain('useAuroraGlassTableStyles({ solidSurface })');
    expect(glass).toContain('const text = useAuroraAdaptiveText()');
    expect(glass).toContain("if (surfaceTone === 'light' || (active && surfaceIsLight))");
    expect(glass).toContain('primary: lightLiquidGlass.text.primary');
    expect(page).toContain('SurfaceContrastProvider tone="light"');
    expect(page).toContain("csDesktopSurface: 'light'");
    expect(css).toContain('[data-cs-healthos-component="table"]');
    expect(css).toContain('color: #102B49; background: #FFFFFF !important');
    const textBlock = palette.slice(palette.indexOf('export const WORKTIME_TEXT'), palette.indexOf('export const WORKTIME_SURFACE'));
    const surfaceBlock = palette.slice(palette.indexOf('export const WORKTIME_SURFACE'), palette.indexOf('export type WfmCompactKpi'));
    const inks = [...textBlock.matchAll(/(?:primary|secondary|muted): '(#[0-9A-F]{6})'/g)].map((match) => match[1]!);
    const surfaces = [...surfaceBlock.matchAll(/(?:panel|card|input): '(#[0-9A-F]{6})'/g)].map((match) => match[1]!);
    expect(inks).toHaveLength(3); expect(surfaces).toHaveLength(3);
    for (const ink of inks) for (const background of surfaces) expect(contrast(ink, background)).toBeGreaterThanOrEqual(4.5);
  });
});
