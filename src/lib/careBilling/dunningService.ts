import type { DunningLetter, DunningLetterLevel, PrepareDunningRunResult } from '@/types/careBilling/billingCycle';
import {
  appendBillingAuditEvent,
  getReceivable,
  listDunningLetters,
  listDunningRuns,
  nextBillingCycleId,
  saveDunningLetter,
  saveDunningRun,
  saveReceivable,
} from './billingCycleStore';
import { assertBillingCycleProductionReady } from './billingCycleGuard';
import {
  isReceivableEligibleForDunning,
  listOpenDueReceivables,
  refreshReceivableDunningStatus,
} from './receivableService';

export type PrepareDunningRunInput = {
  tenantId: string;
  preparedBy?: string | null;
};

const NEXT_DUNNING_STATUS: Record<string, 'reminder_sent' | 'first_dunning_sent' | 'final_dunning_sent'> = {
  due: 'reminder_sent',
  overdue: 'first_dunning_sent',
  reminder_sent: 'first_dunning_sent',
  first_dunning_sent: 'final_dunning_sent',
};

const LETTER_LEVEL_FOR_STATUS: Record<string, DunningLetterLevel> = {
  due: 'reminder',
  overdue: 'first',
  reminder_sent: 'first',
  first_dunning_sent: 'final',
};

export function prepareDunningRun(input: PrepareDunningRunInput): PrepareDunningRunResult {
  const prodGuard = assertBillingCycleProductionReady();
  if (!prodGuard.allowed) {
    return { ok: false, dunningRunId: null, receivableCount: 0, blockedReason: prodGuard.reason };
  }

  const eligible = listOpenDueReceivables(input.tenantId).filter(isReceivableEligibleForDunning);

  if (eligible.length === 0) {
    return {
      ok: false,
      dunningRunId: null,
      receivableCount: 0,
      blockedReason: 'Kein Mahnlauf — keine offenen fälligen Forderungen.',
    };
  }

  const now = new Date().toISOString();
  const runId = nextBillingCycleId('drun');

  saveDunningRun(input.tenantId, {
    id: runId,
    tenantId: input.tenantId,
    status: 'prepared',
    runAt: now,
    receivableCount: eligible.length,
    preparedBy: input.preparedBy ?? null,
    notes: null,
    createdAt: now,
    updatedAt: now,
  });

  for (const receivable of eligible) {
    const letterLevel = LETTER_LEVEL_FOR_STATUS[receivable.dunningStatus] ?? 'reminder';
    const letter: DunningLetter = {
      id: nextBillingCycleId('dlet'),
      tenantId: input.tenantId,
      dunningRunId: runId,
      receivableId: receivable.id,
      invoiceId: receivable.invoiceId,
      letterLevel,
      openAmountCents: receivable.openAmountCents,
      status: 'prepared',
      preparedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    saveDunningLetter(input.tenantId, letter);

    const nextStatus = NEXT_DUNNING_STATUS[receivable.dunningStatus];
    if (nextStatus) {
      saveReceivable(input.tenantId, {
        ...receivable,
        dunningStatus: nextStatus,
        lastDunningAt: now,
        updatedAt: now,
      });
    }
  }

  appendBillingAuditEvent({
    tenantId: input.tenantId,
    action: 'billing_cycle.dunning_run_prepared',
    entityType: 'dunning_runs',
    entityId: runId,
    summary: `Mahnlauf vorbereitet — ${eligible.length} Forderung(en), Mahnungen als Entwurf.`,
    actorId: input.preparedBy ?? null,
  });

  return { ok: true, dunningRunId: runId, receivableCount: eligible.length, blockedReason: null };
}

export function completeDunningRun(tenantId: string, dunningRunId: string): { ok: boolean; error?: string } {
  const runs = listDunningRuns(tenantId);
  const run = runs.find((r) => r.id === dunningRunId);
  if (!run) return { ok: false, error: 'Mahnlauf nicht gefunden.' };

  const now = new Date().toISOString();
  saveDunningRun(tenantId, { ...run, status: 'completed', updatedAt: now });

  const letters = listDunningLetters(tenantId, dunningRunId);
  for (const letter of letters) {
    saveDunningLetter(tenantId, { ...letter, status: 'sent_prepared', updatedAt: now });
  }

  appendBillingAuditEvent({
    tenantId,
    action: 'billing_cycle.dunning_run_completed',
    entityType: 'dunning_runs',
    entityId: dunningRunId,
    summary: `${letters.length} Mahnung(en) als vorbereitet markiert (kein automatischer Versand).`,
    actorId: null,
  });

  return { ok: true };
}

export { listDunningRuns, listDunningLetters };

export function refreshAllReceivableStatuses(tenantId: string): number {
  const receivables = listOpenDueReceivables(tenantId);
  let updated = 0;
  for (const r of receivables) {
    const before = r.dunningStatus;
    const after = refreshReceivableDunningStatus(tenantId, r.id);
    if (after && after.dunningStatus !== before) updated += 1;
  }
  return updated;
}
