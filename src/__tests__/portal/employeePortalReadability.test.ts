import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('employee portal readability (contrast + text layout)', () => {
  it('assignment preview sheet uses opaque white surface', () => {
    const sheet = readSrc('src/components/portal/EmployeePortalAssignmentPreviewSheet.tsx');
    expect(sheet).toContain('lightSurfaceText');
    expect(sheet).toContain('careLightColors.surface');
    expect(sheet).not.toContain('lightLiquidGlass.elevated');
    expect(sheet).not.toContain('useAuroraAdaptiveText');
  });

  it('assignment cards use opaque white card fill', () => {
    const card = readSrc('src/components/portal/EmployeePortalAssignmentCard.tsx');
    expect(card).toContain('lightSurfaceText');
    expect(card).toContain('careLightColors.surface');
    expect(card).not.toContain('lightLiquidGlass.card');
    expect(card).not.toContain('useAuroraAdaptiveText');
    expect(card).not.toMatch(/notes[\s\S]*numberOfLines/);
  });

  it('portal navigation drawer uses opaque white panel on light theme', () => {
    const drawer = readSrc('src/components/layout/portal/PortalNavigationDrawer.tsx');
    expect(drawer).toContain('drawerText');
    expect(drawer).toContain('lightSurfaceText');
    expect(drawer).toContain('careLightColors.surface');
    expect(drawer).not.toContain('lightLiquidGlass.elevated');
  });

  it('mobile bottom nav uses opaque surface without blur', () => {
    const nav = readSrc('src/components/layout/PortalMobileNav.tsx');
    expect(nav).toContain('careLightColors.surface');
    expect(nav).not.toContain('lightLiquidGlassWebFx');
    expect(nav).not.toContain('backdropFilter');
    expect(nav).toContain('compactLabels');
    expect(nav).toContain('numberOfLines={compactLabels ? 2 : 1}');
  });

  it('calendar defaults to agenda view for employee portal', () => {
    expect(readSrc('src/lib/calendar/calendarEventService.ts')).toContain("defaultView: 'agenda'");
    expect(readSrc('src/components/portal/EmployeePortalCalendarScreen.tsx')).toContain(
      "useState<CalendarViewMode>('agenda')",
    );
  });

  it('employee portal list rows allow multiline names and subtitles', () => {
    expect(readSrc('src/components/portal/EmployeePortalClientRecordsScreen.tsx')).not.toContain('numberOfLines');
    expect(readSrc('src/components/portal/EmployeePortalUploadScreen.tsx')).toContain('multiline');
    expect(readSrc('src/components/healthos/employee/HealthOSEmployeePortalTodayView.tsx')).toContain('multiline');
    expect(readSrc('src/components/ui/PremiumListRow.tsx')).toContain('multiline?: boolean');
  });
});
