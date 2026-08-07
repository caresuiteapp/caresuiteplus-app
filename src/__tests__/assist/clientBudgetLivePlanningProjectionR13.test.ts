import { describe, expect, it } from 'vitest';
import {
  derivePlannedVisitAmountCents,
  projectPlannedReservations,
} from '@/lib/assist/clientAssistBillingProfileService';

describe('R13 live planning projection for client budgets', () => {
  it('uses the stored visit amount when the assignment already has one', () => {
    expect(
      derivePlannedVisitAmountCents(
        {
          budget_amount_cents: 6_550,
          duration_minutes: 120,
          planned_start_at: '2026-08-07T09:00:00.000Z',
          planned_end_at: '2026-08-07T11:00:00.000Z',
        },
        3_275,
      ),
    ).toBe(6_550);
  });

  it('calculates an old planned visit from its duration and current hourly rate', () => {
    expect(
      derivePlannedVisitAmountCents(
        {
          budget_amount_cents: null,
          duration_minutes: null,
          planned_start_at: '2026-08-07T09:00:00.000Z',
          planned_end_at: '2026-08-07T11:00:00.000Z',
        },
        3_275,
      ),
    ).toBe(6_550);
  });

  it('projects the active Einsatzplanung instead of a stale cached zero', () => {
    const projected = projectPlannedReservations(
      [
        {
          id: 'paragraph-45b-account',
          allocatedCents: 13_100,
          usedCents: 0,
          reservedCents: 0,
          remainingCents: 13_100,
        },
      ],
      new Map([['paragraph-45b-account', 6_550]]),
    );

    expect(projected[0]?.reservedCents).toBe(6_550);
    expect(projected[0]?.remainingCents).toBe(6_550);
  });

  it('clears a stale reservation when no active planned visit remains', () => {
    const projected = projectPlannedReservations(
      [
        {
          id: 'paragraph-45b-account',
          allocatedCents: 13_100,
          usedCents: 3_275,
          reservedCents: 6_550,
          remainingCents: 3_275,
        },
      ],
      new Map(),
    );

    expect(projected[0]?.reservedCents).toBe(0);
    expect(projected[0]?.remainingCents).toBe(9_825);
  });
});
