import { describe, expect, it } from 'vitest';
import {
  EMPTY_ASSIST_DASHBOARD_STATS,
  pickNextAssignment,
  pickRunningAssignment,
} from '@/lib/assist/assistDashboardService';
import {
  applyAssistVisitTransition,
  getAssistVisitAllowedTransitions,
  isAssistVisitBillingHandoffReady,
  mapAssignmentStatusToLifecycle,
  validateAssistVisitTransition,
} from '@/lib/assist/assistVisitStateMachine';
import type { AssignmentListItem } from '@/types/modules/assist';

function assignment(partial: Partial<AssignmentListItem> & Pick<AssignmentListItem, 'id'>): AssignmentListItem {
  return {
    id: partial.id,
    tenantId: partial.tenantId ?? 'tenant-1',
    title: partial.title ?? 'Einsatz',
    scheduledStart: partial.scheduledStart ?? '2026-06-23T10:00:00.000Z',
    scheduledEnd: partial.scheduledEnd ?? '2026-06-23T11:00:00.000Z',
    status: partial.status ?? 'geplant',
    location: partial.location ?? 'Zuhause',
    clientName: partial.clientName ?? 'Max M.',
    employeeName: partial.employeeName ?? 'Anna P.',
    updatedAt: partial.updatedAt ?? '2026-06-23T08:00:00.000Z',
  };
}

describe('assistDashboardService', () => {
  it('EMPTY_ASSIST_DASHBOARD_STATS liefert Null-Werte', () => {
    expect(EMPTY_ASSIST_DASHBOARD_STATS.totalAssignments).toBe(0);
    expect(EMPTY_ASSIST_DASHBOARD_STATS.openTripsCount).toBe(0);
  });

  it('pickRunningAssignment bevorzugt aktive Einsätze', () => {
    const items = [
      assignment({ id: 'a1', status: 'geplant' }),
      assignment({ id: 'a2', status: 'aktiv' }),
    ];
    expect(pickRunningAssignment(items)?.id).toBe('a2');
  });

  it('pickNextAssignment überspringt abgeschlossene Einsätze', () => {
    const items = [
      assignment({ id: 'a1', status: 'abgeschlossen' }),
      assignment({
        id: 'a2',
        status: 'bestaetigt',
        scheduledStart: '2099-01-01T10:00:00.000Z',
      }),
    ];
    expect(pickNextAssignment(items)?.id).toBe('a2');
  });
});

describe('assistVisitStateMachine', () => {
  it('erlaubt linearen Übergang bis billing_handoff_ready', () => {
    const chain: Array<[from: Parameters<typeof applyAssistVisitTransition>[0], to: Parameters<typeof applyAssistVisitTransition>[1]]> = [
      ['planned', 'published'],
      ['published', 'confirmed'],
      ['confirmed', 'on_way'],
      ['on_way', 'arrived'],
      ['arrived', 'in_progress'],
      ['in_progress', 'completed'],
      ['completed', 'documentation_open'],
      ['documentation_open', 'proof_ready'],
      ['proof_ready', 'portal_released'],
      ['portal_released', 'billing_handoff_ready'],
    ];

    let current = chain[0]![0];
    for (const [, target] of chain) {
      const result = applyAssistVisitTransition(current, target);
      expect(result.ok).toBe(true);
      if (result.ok) current = result.status;
    }
    expect(isAssistVisitBillingHandoffReady(current)).toBe(true);
  });

  it('idempotente Transition auf gleichen Status', () => {
    const result = applyAssistVisitTransition('confirmed', 'confirmed');
    expect(result).toEqual({ ok: true, status: 'confirmed' });
  });

  it('blockiert ungültige Sprünge', () => {
    const result = validateAssistVisitTransition('planned', 'billing_handoff_ready');
    expect(result.valid).toBe(false);
  });

  it('mapAssignmentStatusToLifecycle mappt abgeschlossen', () => {
    expect(mapAssignmentStatusToLifecycle('abgeschlossen', true)).toBe('billing_handoff_ready');
    expect(mapAssignmentStatusToLifecycle('abgeschlossen', false)).toBe('proof_ready');
  });

  it('getAssistVisitAllowedTransitions liefert Nachfolger', () => {
    expect(getAssistVisitAllowedTransitions('proof_ready')).toContain('portal_released');
    expect(getAssistVisitAllowedTransitions('billing_handoff_ready')).toEqual([]);
  });
});
