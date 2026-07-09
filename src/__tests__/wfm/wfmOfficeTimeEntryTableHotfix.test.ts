import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  formatWfmReviewQueueBuchungLabel,
  formatWfmReviewQueueIstStack,
} from '@/lib/wfm/wfmDisplayHelpers';
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';

const tableSrc = readFileSync(
  join(process.cwd(), 'src/components/wfm/WfmOfficeTimeEntryTable.tsx'),
  'utf8',
);
const dataTableSrc = readFileSync(
  join(process.cwd(), 'src/components/ui/PremiumDataTable.tsx'),
  'utf8',
);

function entry(overrides: Partial<WfmOfficeTimeEntry> = {}): WfmOfficeTimeEntry {
  return {
    id: 'e-1',
    tenantId: 't-1',
    employeeId: 'emp-1',
    employeeName: 'MA Test',
    workDate: '2026-07-07',
    assignmentId: null,
    visitId: null,
    clientLabel: null,
    plannedStartAt: null,
    plannedEndAt: null,
    actualStartAt: null,
    actualEndAt: null,
    startDeviationMinutes: null,
    endDeviationMinutes: null,
    startAmpel: null,
    endAmpel: null,
    overallAmpel: null,
    startJustification: null,
    endJustification: null,
    startJustificationAt: null,
    endJustificationAt: null,
    pauseMinutes: 0,
    grossMinutes: 0,
    netMinutes: 0,
    travelMinutes: null,
    workKind: 'einsatz',
    status: 'open',
    source: 'portal',
    reviewStatus: 'open',
    exportStatus: 'not_exported',
    sessionId: 's-1',
    officeComment: null,
    hasOpenOfficeMessage: false,
    flags: ['missing_booking'],
    rowKind: 'planned_missing_actual',
    ...overrides,
  };
}

describe('WFM Offene Prüfungen table hotfix contract', () => {
  it('uses fixed review-queue column widths and separated status/action', () => {
    expect(tableSrc).toContain('date: 110');
    expect(tableSrc).toContain('employee: 150');
    expect(tableSrc).toContain('client: 160');
    expect(tableSrc).toContain('plan: 150');
    expect(tableSrc).toContain('einsatz: 180');
    expect(tableSrc).toContain('buchung: 160');
    expect(tableSrc).toContain('status: 170');
    expect(tableSrc).toContain('action: 130');
    expect(tableSrc).toContain('fixedLayout');
    expect(tableSrc).toContain('solidSurface');
    expect(tableSrc).toContain('statusBadgeWrap');
    expect(tableSrc).toContain('actionCell');
    expect(tableSrc).toContain('COMPACT_ACTION_BUTTON');
  });

  it('PremiumDataTable supports fixed layout overflow guard', () => {
    expect(dataTableSrc).toContain('fixedLayout');
    expect(dataTableSrc).toContain('solidSurface');
    expect(dataTableSrc).toContain('flexShrink: 0');
    expect(dataTableSrc).toContain('overflow: \'hidden\'');
  });

  it('stacked Einsatz-Ist lines avoid truncated Dauer Einsat labels', () => {
    const stack = formatWfmReviewQueueIstStack(
      entry({
        assignmentActualStartAt: '2026-07-07T08:00:00.000Z',
        assignmentActualEndAt: '2026-07-07T09:30:00.000Z',
        flags: ['missing_booking'],
      }),
    );
    expect(stack).not.toBeNull();
    expect(stack!.quelle).toBe('Einsatz-Ist');
    expect(stack!.zeit).not.toContain('Dauer Einsat');
  });

  it('buchung label shows Keine Buchung instead of truncated text', () => {
    const label = formatWfmReviewQueueBuchungLabel(entry());
    expect(label).toBe('Keine Buchung');
    expect(label).not.toContain('Dauer Einsat');
  });

  it('buchung label honors missing_booking flag', () => {
    expect(formatWfmReviewQueueBuchungLabel(entry())).toBe('Keine Buchung');
    expect(formatWfmReviewQueueBuchungLabel(entry({ flags: [] }))).not.toBe('Keine Buchung');
  });
});
