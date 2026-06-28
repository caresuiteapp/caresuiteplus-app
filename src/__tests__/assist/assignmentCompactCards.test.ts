import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildAssignmentFooterChips,
  resolveAssignmentCardAccent,
  resolveSgbReference,
} from '@/lib/assist/assignmentCardPresentation';
import {
  isAssignmentTomorrow,
  matchesDateRangeFilter,
} from '@/lib/assist/assignmentListFilters';
import type { AssignmentListItem } from '@/types/modules/assist';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

const sampleAssignment: AssignmentListItem = {
  id: 'assign-test-001',
  tenantId: 'tenant-1',
  employeeId: 'employee-001',
  title: 'Entlastungsleistung § 45b SGB XI',
  serviceName: 'Entlastungsleistung § 45b SGB XI',
  scheduledStart: new Date().toISOString(),
  scheduledEnd: new Date(Date.now() + 3_600_000).toISOString(),
  status: 'aktiv',
  location: 'Berlin',
  clientName: 'Helga Schneider',
  employeeName: 'Anna Pflege',
  updatedAt: new Date().toISOString(),
  durationMinutes: 60,
  proofStatus: 'signed',
  billingStatus: 'ready',
};

describe('Assignment compact cards UI', () => {
  it('resolveAssignmentCardAccent maps workflow status to accent colors', () => {
    expect(resolveAssignmentCardAccent('abgeschlossen').color).toBe('#22C55E');
    expect(resolveAssignmentCardAccent('entwurf').color).toBe('#F97316');
    expect(resolveAssignmentCardAccent('aktiv').color).toBe('#3B82F6');
    expect(resolveAssignmentCardAccent('fehlerhaft').color).toBe('#EF4444');
    expect(resolveAssignmentCardAccent('archiviert').color).toBe('#64748B');
  });

  it('resolveSgbReference extracts SGB reference from service name', () => {
    expect(resolveSgbReference(sampleAssignment)).toContain('SGB XI');
  });

  it('buildAssignmentFooterChips includes budget, docs, signature, attachments', () => {
    const chips = buildAssignmentFooterChips(sampleAssignment);
    expect(chips.some((chip) => chip.id === 'budget')).toBe(true);
    expect(chips.some((chip) => chip.id === 'docs')).toBe(true);
    expect(chips.some((chip) => chip.id === 'signature')).toBe(true);
    expect(chips.some((chip) => chip.id === 'attachments')).toBe(true);
  });

  it('matchesDateRangeFilter supports tomorrow filter', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    expect(matchesDateRangeFilter(tomorrow.toISOString(), 'tomorrow')).toBe(true);
    expect(isAssignmentTomorrow(tomorrow.toISOString())).toBe(true);
  });

  it('AssignmentCompactCard renders status accent bar and footer chips', () => {
    const source = readSrc('src/components/assist/AssignmentCompactCard.tsx');
    expect(source).toContain('accentBar');
    expect(source).toContain('buildAssignmentFooterChips');
    expect(source).toContain('resolveAssignmentCardAccent');
  });

  it('AssignmentsCardGrid provides responsive card layout', () => {
    const source = readSrc('src/components/assist/AssignmentsCardGrid.tsx');
    expect(source).toContain('AssignmentCompactCard');
    expect(source).toContain('useResponsiveValue');
    expect(source).toContain('columns === 1');
  });

  it('AssignmentsListView uses card grid and view toggle with table fallback', () => {
    const source = readSrc('src/components/assist/AssignmentsListView.tsx');
    expect(source).toContain('AssignmentsCardGrid');
    expect(source).toContain('AssignmentsListTable');
    expect(source).toContain("useDesktopListViewPreference('assist.assignments', 'cards')");
    expect(source).toContain('AssignmentMobileActionSheet');
    expect(source).toContain('AssignmentsFilterSidebar');
  });

  it('AssignmentMobileActionSheet uses bottom sheet variant', () => {
    const source = readSrc('src/components/assist/AssignmentMobileActionSheet.tsx');
    expect(source).toContain('variant="bottomSheet"');
  });

  it('useAssignmentList extends search to assignment id and service name', () => {
    const source = readSrc('src/hooks/useAssignmentList.ts');
    expect(source).toContain("'id'");
    expect(source).toContain("'serviceName'");
    expect(source).toContain('dateRange');
    expect(source).toContain('employeeFilter');
  });
});
