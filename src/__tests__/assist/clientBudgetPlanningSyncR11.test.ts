import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('client budget planning synchronization R11', () => {
  const repository = readFileSync(
    'src/lib/assist/repositories/visitRepository.supabase.ts',
    'utf8',
  );
  const allocationService = readFileSync(
    'src/lib/assist/assignmentBudgetAllocationService.ts',
    'utf8',
  );
  const migration = readFileSync(
    'supabase/migrations/20260806193000_assist_visit_budget_planning_sync.sql',
    'utf8',
  );

  it('releases and recalculates a plan when budget-relevant visit data changes', () => {
    expect(repository).toContain('const budgetPlanChanged =');
    expect(repository).toContain("'Einsatzplanung geändert'");
    expect(repository).toContain('await releaseAssignmentBudgetReservation(');
    expect(repository).toContain('await reserveAssignmentBudget({');
    expect(repository).toContain('await reserveForAssignment({');
  });

  it('does not swallow a failed reservation release', () => {
    expect(allocationService).toContain('const released = await releaseReservation(');
    expect(allocationService).toContain('if (!released.ok) return released;');
  });

  it('releases planned budget atomically when an assignment is deleted', () => {
    expect(migration).toContain("transaction_type = 'reservation'");
    expect(migration).toContain("IN ('geplant', 'durchgefuehrt')");
    expect(migration).toContain('reserved_cents = GREATEST(0, reserved_cents -');
    expect(migration).toContain("allocation_status = 'released'");
    expect(migration).toContain("'budgetReservationsReleased', v_released_reservations");
  });
});
