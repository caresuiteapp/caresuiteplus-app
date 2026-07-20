import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildAssignmentFooterChips,
  enrichAssignmentListItem,
  isAssignmentListItemDeletable,
  resolveAssignmentCardAccent,
  resolveAssignmentCardBadge,
  resolveAssignmentExecutionBadge,
  resolveAssignmentListItemStatus,
  resolveAttachmentCount,
  resolveSgbReference,
} from '@/lib/assist/assignmentCardPresentation';
import { formatAssignmentWeekdayDate } from '@/lib/formatters/dateTimeFormatters';
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
  assignmentStatus: 'bestaetigt',
  location: 'Berlin',
  clientName: 'Helga Schneider',
  employeeName: 'Anna Pflege',
  updatedAt: new Date().toISOString(),
  durationMinutes: 60,
  proofStatus: 'signed',
  billingStatus: 'ready',
};

describe('Assignment compact cards UI', () => {
  it('resolveAssignmentListItemStatus prefers canonical assignmentStatus', () => {
    expect(resolveAssignmentListItemStatus(sampleAssignment)).toBe('bestaetigt');
    expect(resolveAssignmentListItemStatus({ ...sampleAssignment, assignmentStatus: undefined, status: 'aktiv' })).toBe(
      'bestaetigt',
    );
  });

  it('resolveAssignmentCardBadge shows Bestätigt for confirmed assignments', () => {
    expect(resolveAssignmentCardBadge(sampleAssignment).label).toBe('Bestätigt');
    expect(resolveAssignmentCardBadge(sampleAssignment).variant).toBe('cyan');
  });

  it('zeigt eindeutig, ob ein Einsatz läuft oder noch nicht gestartet ist', () => {
    expect(resolveAssignmentExecutionBadge({ ...sampleAssignment, executionStatus: 'pending' })).toMatchObject({
      label: 'Nicht gestartet',
      running: false,
    });
    expect(resolveAssignmentExecutionBadge({ ...sampleAssignment, executionStatus: 'in_progress' })).toMatchObject({
      label: 'Einsatz läuft',
      running: true,
    });
  });

  it('erlaubt Löschen nur vor Ausführungsbeginn und vor Abrechnung', () => {
    expect(isAssignmentListItemDeletable({ ...sampleAssignment, executionStatus: 'pending', billingStatus: 'preview' })).toBe(true);
    expect(isAssignmentListItemDeletable({ ...sampleAssignment, executionStatus: 'in_progress' })).toBe(false);
    expect(isAssignmentListItemDeletable({ ...sampleAssignment, executionStatus: 'pending', billingStatus: 'invoiced' })).toBe(false);
  });

  it('resolveAssignmentCardAccent maps assignment status to accent colors', () => {
    expect(resolveAssignmentCardAccent({ ...sampleAssignment, assignmentStatus: 'abgeschlossen' }).color).toBe(
      '#22C55E',
    );
    expect(resolveAssignmentCardAccent({ ...sampleAssignment, assignmentStatus: 'geplant', status: 'entwurf' }).color).toBe(
      '#F97316',
    );
    expect(resolveAssignmentCardAccent(sampleAssignment).color).toBe('#3B82F6');
    expect(
      resolveAssignmentCardAccent({ ...sampleAssignment, assignmentStatus: 'dokumentation_offen', status: 'in_bearbeitung' })
        .color,
    ).toBe('#F97316');
    expect(
      resolveAssignmentCardAccent({ ...sampleAssignment, assignmentStatus: 'storniert', status: 'fehlerhaft' }).color,
    ).toBe('#EF4444');
  });

  it('resolveSgbReference extracts SGB reference from service name', () => {
    expect(resolveSgbReference(sampleAssignment)).toContain('SGB XI');
  });

  it('buildAssignmentFooterChips includes budget, docs, signature, attachments', () => {
    const chips = buildAssignmentFooterChips(sampleAssignment);
    expect(chips.some((chip) => chip.id === 'budget' && chip.label === 'Budget OK')).toBe(true);
    expect(chips.some((chip) => chip.id === 'docs')).toBe(true);
    expect(chips.some((chip) => chip.id === 'signature')).toBe(true);
    expect(chips.some((chip) => chip.id === 'attachments')).toBe(true);
  });

  it('resolveAttachmentCount uses internalPhotoReferences from visit documentation', () => {
    expect(resolveAttachmentCount(sampleAssignment)).toBe(0);
    expect(
      resolveAttachmentCount({
        ...sampleAssignment,
        internalPhotoReferences: [
          'tenant/t1/assist/visits/v1/attachments/a.jpg',
          'tenant/t1/assist/visits/v1/attachments/b.pdf',
        ],
      }),
    ).toBe(2);
    const chips = buildAssignmentFooterChips({
      ...sampleAssignment,
      internalPhotoReferences: ['tenant/t1/assist/visits/v1/attachments/a.jpg'],
    });
    expect(chips.find((chip) => chip.id === 'attachments')?.label).toBe('Anhänge 1');
  });

  it('buildAssignmentFooterChips shows open documentation and signature pills', () => {
    const incomplete = enrichAssignmentListItem({
      ...sampleAssignment,
      assignmentStatus: 'unterschrift_offen',
      status: 'in_bearbeitung',
      proofStatus: 'pending',
    });
    const chips = buildAssignmentFooterChips(incomplete);
    expect(chips.find((chip) => chip.id === 'docs')?.label).toBe('Dokumentation');
    expect(chips.find((chip) => chip.id === 'docs')?.variant).toBe('green');
    expect(chips.find((chip) => chip.id === 'signature')?.label).toBe('Unterschrift offen');
    expect(chips.find((chip) => chip.id === 'signature')?.variant).toBe('orange');
  });

  it('zeigt vor Einsatzbeginn Dokumentation und Unterschrift nicht als offen', () => {
    const chips = buildAssignmentFooterChips({
      ...sampleAssignment,
      executionStatus: 'pending',
      documentationStatus: 'none',
      proofStatus: 'none',
      isIncomplete: false,
    });
    expect(chips.find((chip) => chip.id === 'docs')?.label).toBe('Dokumentation später');
    expect(chips.find((chip) => chip.id === 'signature')?.label).toBe('Unterschrift später');
  });

  it('buildAssignmentFooterChips shows Dokumentation offen for documentation_open status', () => {
    const chips = buildAssignmentFooterChips({
      ...sampleAssignment,
      assignmentStatus: 'dokumentation_offen',
      status: 'in_bearbeitung',
      proofStatus: 'pending',
    });
    expect(chips.find((chip) => chip.id === 'docs')?.label).toBe('Dokumentation offen');
    expect(chips.find((chip) => chip.id === 'docs')?.variant).toBe('orange');
  });

  it('matchesDateRangeFilter supports tomorrow filter', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    expect(matchesDateRangeFilter(tomorrow.toISOString(), 'tomorrow')).toBe(true);
    expect(isAssignmentTomorrow(tomorrow.toISOString())).toBe(true);
  });

  it('formatAssignmentWeekdayDate includes weekday and German calendar date', () => {
    expect(formatAssignmentWeekdayDate('2026-07-03')).toMatch(/Freitag, 03\.07\.2026/);
  });

  it('AssignmentCompactCard renders status accent bar and footer chips', () => {
    const source = readSrc('src/components/assist/AssignmentCompactCard.tsx');
    expect(source).toContain('accentBar');
    expect(source).toContain('buildAssignmentFooterChips');
    expect(source).toContain('resolveAssignmentCardAccent');
    expect(source).toContain('HealthOSStatusBadge');
    expect(source).toContain('resolveAssignmentCardBadge');
    expect(source).toContain('resolveAssignmentExecutionBadge');
    expect(source).toContain('OfficeRecordDeleteButton');
    expect(source).toContain('useAssignmentTravelTime');
    expect(source).toContain('displayText');
    expect(source).toContain('formatAssignmentWeekdayDate');
    expect(source).toContain("{ label: 'Anfahrt', value: assignment.onTheWayAt }");
    expect(source).toContain("{ label: 'Angekommen', value: assignment.arrivedAt }");
    expect(source).toContain("{ label: 'Einsatzstart', value: assignment.actualStartAt }");
    expect(source).toContain("{ label: 'Einsatzende', value: assignment.actualEndAt }");
    expect(source).not.toContain('AssignmentCardHoverDetails');
  });

  it('assignment list service enriches items with assignmentStatus for cards', () => {
    const listService = readSrc('src/lib/assist/assignmentListService.ts');
    expect(listService).toContain('assignmentStatus: item.assignmentStatus');
    expect(listService).toContain('internalPhotoReferences: item.internalPhotoReferences');
    expect(listService).toContain('enrichAssignmentListItem');
  });

  it('assist visit client nested select uses postal_code not legacy zip column', () => {
    const visitRepo = readSrc('src/lib/assist/repositories/visitRepository.supabase.ts');
    expect(visitRepo).toContain('VISIT_CLIENT_NESTED_SELECT');
    expect(visitRepo).toContain('house_number, postal_code, city');
    expect(visitRepo).not.toMatch(/clients\([^)]*\bzip\b/);
    expect(visitRepo).toContain('shouldFallbackVisitEmbeddedSelect');
  });

  it('AssignmentsCardGrid uses single-column card layout on all breakpoints', () => {
    const source = readSrc('src/components/assist/AssignmentsCardGrid.tsx');
    expect(source).toContain('AssignmentCompactCard');
    expect(source).toContain("flexDirection: 'column'");
    expect(source).toContain('width: \'100%\'');
    expect(source).not.toContain('useResponsiveValue');
    expect(source).not.toContain('flexWrap: \'wrap\'');
  });

  it('AssignmentCompactCard does not truncate client or employee names', () => {
    const source = readSrc('src/components/assist/AssignmentCompactCard.tsx');
    expect(source).toContain('<Text style={styles.clientName}>{assignment.clientName}</Text>');
    expect(source).toContain('<Text style={styles.metaRow}>{assignment.employeeName}</Text>');
  });

  it('AssignmentsListView uses card grid and top filter rows with table fallback', () => {
    const source = readSrc('src/components/assist/AssignmentsListView.tsx');
    expect(source).toContain('AssignmentsCardGrid');
    expect(source).toContain('AssignmentsListTable');
    expect(source).toContain("useDesktopListViewPreference('assist.assignments.v2', 'cards')");
    expect(source).toContain('AssignmentMobileActionSheet');
    expect(source).toContain('ASSIGNMENT_DATE_RANGE_FILTERS');
    expect(source).toContain('employeeFilter');
    expect(source).toContain('serviceFilter');
    expect(source).not.toContain('AssignmentsFilterSidebar');
    expect(source).not.toContain('layoutRow');
    expect(source).toContain('filtersExpanded');
    expect(source).toContain('Filter anzeigen');
    expect(source).toContain('Filter ausblenden');
    expect(source).toMatch(/onChange=.*setDateRange/s);
    expect((source.match(/\bwrap\b/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });

  it('AssignmentMobileActionSheet uses bottom sheet on mobile only', () => {
    const source = readSrc('src/components/assist/AssignmentMobileActionSheet.tsx');
    expect(source).toContain("'bottomSheet'");
    expect(source).toContain('isDesktopClass');
  });

  it('useAssignmentList extends search to assignment id and service name', () => {
    const source = readSrc('src/hooks/useAssignmentList.ts');
    expect(source).toContain("'id'");
    expect(source).toContain("'serviceName'");
    expect(source).toContain('dateRange');
    expect(source).toContain('employeeFilter');
  });
});
