import { describe, expect, it } from 'vitest';
import { buildVisitOccurrenceId } from '@/lib/assist/visitRecurrenceExpansion';
import type { VisitDispositionListItem } from '@/lib/assist/visitTypes';

const VISIT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function mapVisitToPortalItem(item: VisitDispositionListItem) {
  return {
    id: item.id,
    title: item.title,
    startsAt: item.scheduledStart,
    endsAt: item.scheduledEnd,
    status: item.status,
    location: item.location || null,
    clientId: item.clientId ?? '',
    employeeId: item.employeeId,
    clientName: item.clientName,
  };
}

describe('portal recurrence expansion', () => {
  it('liefert jeden Serientermin als separaten Portal-Eintrag', () => {
    const expanded: VisitDispositionListItem[] = [
      {
        id: VISIT_ID,
        tenantId: 'tenant-1',
        clientId: 'client-1',
        title: 'Alltagsbegleitung',
        serviceName: 'Alltagsbegleitung',
        scheduledStart: '2026-07-07T07:00:00.000Z',
        scheduledEnd: '2026-07-07T09:00:00.000Z',
        durationMinutes: 120,
        status: 'aktiv',
        planningStatus: 'scheduled',
        proofStatus: 'none',
        billingStatus: 'preview',
        location: 'Musterstraße 1',
        clientName: 'Frau Müller',
        employeeId: 'employee-1',
        employeeName: 'Anna Pflege',
        isAtRisk: false,
        isIncomplete: false,
        updatedAt: '2026-07-01T10:00:00.000Z',
      },
      {
        id: buildVisitOccurrenceId(VISIT_ID, '2026-07-14'),
        tenantId: 'tenant-1',
        clientId: 'client-1',
        title: 'Alltagsbegleitung',
        serviceName: 'Alltagsbegleitung',
        scheduledStart: '2026-07-14T07:00:00.000Z',
        scheduledEnd: '2026-07-14T09:00:00.000Z',
        durationMinutes: 120,
        status: 'aktiv',
        planningStatus: 'scheduled',
        proofStatus: 'none',
        billingStatus: 'preview',
        location: 'Musterstraße 1',
        clientName: 'Frau Müller',
        employeeId: 'employee-1',
        employeeName: 'Anna Pflege',
        isAtRisk: false,
        isIncomplete: false,
        updatedAt: '2026-07-01T10:00:00.000Z',
      },
    ];

    const portalItems = expanded.map(mapVisitToPortalItem);

    expect(portalItems).toHaveLength(2);
    expect(portalItems[0]?.id).toBe(VISIT_ID);
    expect(portalItems[1]?.id).toBe(buildVisitOccurrenceId(VISIT_ID, '2026-07-14'));
    expect(portalItems[1]?.startsAt.slice(0, 10)).toBe('2026-07-14');
  });
});
