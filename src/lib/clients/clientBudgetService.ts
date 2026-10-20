import type { ServiceResult } from '@/types';
import type { ClientBudget } from '@/types/modules/client';
import { getDemoClientFullDetail, upsertDemoClientFullDetail } from '@/data/demo/clients';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { runService } from '@/lib/services/serviceRunner';
import { assertDemoTenant, getClientExtendedRepository, isDemoClientBackend } from './clientBackend';

export async function fetchClientBudgets(
  tenantId: string,
  clientId: string,
): Promise<ServiceResult<ClientBudget[]>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().fetchBudgets(tenantId, clientId);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };
    return { ok: true, data: full.budgets };
  }, { delayMs: 200 });
}

export async function updateClientBudget(
  tenantId: string,
  clientId: string,
  budgetId: string,
  input: Partial<Pick<ClientBudget, 'usedAmountCents' | 'reservedAmountCents' | 'notes'>>,
): Promise<ServiceResult<ClientBudget>> {
  return runService(async () => {
    if (!isDemoClientBackend()) {
      return getClientExtendedRepository().updateBudget(tenantId, clientId, budgetId, input);
    }

    const denied = assertDemoTenant(tenantId);
    if (denied) return denied;
    const full = getDemoClientFullDetail(clientId);
    if (!full) return { ok: false, error: SERVICE_ERRORS.clientNotFound };

    const idx = full.budgets.findIndex((b) => b.id === budgetId);
    if (idx < 0) return { ok: false, error: 'Budget nicht gefunden.' };

    const now = new Date().toISOString();
    const updated = { ...full.budgets[idx], ...input, updatedAt: now };
    const budgets = [...full.budgets];
    budgets[idx] = updated;
    upsertDemoClientFullDetail({ ...full, budgets, updatedAt: now });
    return { ok: true, data: updated };
  }, { delayMs: 250 });
}
