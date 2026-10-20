import { describe, expect, it } from 'vitest';
import {
  derivePlannedVisitAmountCents,
  isActivePlannedVisit,
  projectPlannedReservations,
} from '@/lib/assist/clientAssistBillingProfileService';

describe('R13 live planning projection for client budgets', () => {
  const plannedVisit = {
    id: 'visit-1',
    legacy_assignment_id: 'assignment-1',
    assignment_date: '2026-08-08',
    planned_start_at: '2026-08-08T09:00:00.000Z',
    planned_end_at: '2026-08-08T10:00:00.000Z',
    duration_minutes: 60,
    budget_amount_cents: 3_275,
    billing_budget_source_key: 'paragraph_45b',
    planning_status: 'scheduled',
    execution_status: 'pending',
    canonical_status: 'planned',
  };

  it('counts scheduled, confirmed and at-risk visits while they remain active', () => {
    expect(isActivePlannedVisit(plannedVisit)).toBe(true);
    expect(isActivePlannedVisit({ ...plannedVisit, planning_status: 'confirmed' })).toBe(true);
    expect(isActivePlannedVisit({ ...plannedVisit, planning_status: 'at_risk' })).toBe(true);
  });

  it('counts historical planned assignments that migration 0116 marked as drafts', () => {
    expect(isActivePlannedVisit({ ...plannedVisit, planning_status: 'draft' })).toBe(true);
    expect(isActivePlannedVisit({
      ...plannedVisit,
      planning_status: 'draft',
      legacy_assignment_id: null,
    })).toBe(false);
  });

  it('does not count completed, cancelled or no-show visits', () => {
    expect(isActivePlannedVisit({ ...plannedVisit, execution_status: 'completed' })).toBe(false);
    expect(isActivePlannedVisit({ ...plannedVisit, planning_status: 'cancelled' })).toBe(false);
    expect(isActivePlannedVisit({ ...plannedVisit, canonical_status: 'no_show' })).toBe(false);
  });

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
