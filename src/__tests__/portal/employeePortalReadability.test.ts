import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('employee portal readability (contrast + text layout)', () => {
  it('assignment preview sheet uses opaque light surface text', () => {
    const sheet = readSrc('src/components/portal/EmployeePortalAssignmentPreviewSheet.tsx');
    expect(sheet).toContain('lightSurfaceText');
    expect(sheet).toContain('lightLiquidGlass.elevated');
    expect(sheet).not.toContain('useAuroraAdaptiveText');
    expect(sheet).not.toContain("backgroundColor: '#F8FAFC'");
  });

  it('assignment cards use light surface ink on milchglas card fill', () => {
    const card = readSrc('src/components/portal/EmployeePortalAssignmentCard.tsx');
    expect(card).toContain('lightSurfaceText');
    expect(card).toContain('lightLiquidGlass.card');
    expect(card).not.toContain('useAuroraAdaptiveText');
    expect(card).not.toMatch(/notes[\s\S]*numberOfLines/);
  });

  it('portal navigation drawer picks ink from drawer surface brightness', () => {
    const drawer = readSrc('src/components/layout/portal/PortalNavigationDrawer.tsx');
    expect(drawer).toContain('drawerText');
    expect(drawer).toContain('lightSurfaceText');
    expect(drawer).toContain('darkGlassSurfaceText');
    expect(drawer).toContain('lightLiquidGlass.elevated');
  });

  it('mobile bottom nav allows two-line labels for five tabs', () => {
    const nav = readSrc('src/components/layout/PortalMobileNav.tsx');
    expect(nav).toContain('compactLabels');
    expect(nav).toContain('mobileTabs.length >= 5');
    expect(nav).toContain('numberOfLines={compactLabels ? 2 : 1}');
    expect(nav).toContain('adjustsFontSizeToFit={compactLabels}');
  });

  it('calendar toolbar wraps long titles and uses active glass chips', () => {
    const toolbar = readSrc('src/components/calendar/CalendarToolbar.tsx');
    expect(toolbar).toContain('useActiveGlassTokens');
    expect(toolbar).toContain('numberOfLines={2}');
    expect(toolbar).toContain('minWidth: 0');
    expect(toolbar).not.toContain('auroraGlass.border');
  });

  it('employee portal list rows allow multiline names and subtitles', () => {
    expect(readSrc('src/components/portal/EmployeePortalClientRecordsScreen.tsx')).toContain('multiline');
    expect(readSrc('src/components/portal/EmployeePortalUploadScreen.tsx')).toContain('multiline');
    expect(readSrc('src/components/healthos/employee/HealthOSEmployeePortalTodayView.tsx')).toContain('multiline');
    expect(readSrc('src/components/ui/PremiumListRow.tsx')).toContain('multiline?: boolean');
  });
});
