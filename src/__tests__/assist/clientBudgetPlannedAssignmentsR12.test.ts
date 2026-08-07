import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const allocationService = readFileSync(
  'src/lib/assist/assignmentBudgetAllocationService.ts',
  'utf8',
);
const repository = readFileSync(
  'src/lib/assist/repositories/visitRepository.supabase.ts',
  'utf8',
);
const migration = readFileSync(
  'supabase/migrations/20260807090000_assist_planned_budget_reservation_backfill.sql',
  'utf8',
);

describe('R12 planned assignment budget synchronization', () => {
  it('does not repeat a role check after the assignment create operation was authorized', () => {
    const reserveFunction = allocationService.slice(
      allocationService.indexOf('export async function reserveAssignmentBudget'),
      allocationService.indexOf('export async function releaseAssignmentBudgetReservation'),
    );

    expect(reserveFunction).not.toContain('enforcePermission');
    expect(reserveFunction).not.toContain('hasPermission');
    expect(reserveFunction).toContain('internal persistence step');
  });

  it('never reports a created visit when its budget reservation failed', () => {
    expect(repository).toContain('const persisted = await persistAssignmentBudgetAllocations');
    expect(repository).toContain('if (!persisted.ok)');
    expect(repository).toContain('const reserved = await reserveAssignmentBudget');
    expect(repository).toContain('if (!reserved.ok)');
    expect(repository).toContain('rollbackCreatedVisitAfterBudgetFailure');
  });

  it('backfills existing scheduled visits and rebuilds reserved account totals', () => {
    expect(migration).toContain("visit.planning_status = 'scheduled'");
    expect(migration).toContain("visit.execution_status = 'pending'");
    expect(migration).toContain('visit.budget_amount_cents');
    expect(migration).toContain('tenant_service_prices');
    expect(migration).toContain("'Planbetrag aus bestehender Einsatzplanung nachgetragen'");
    expect(migration).toContain('UPDATE public.client_budget_accounts account');
    expect(migration).toContain("COALESCE(transaction.lifecycle_status, 'geplant') = 'geplant'");
  });
});
