import type { ServiceResult } from '@/types/core/base';
import { getServiceMode } from '@/lib/services/mode';
import { platformRpc } from './platformSupabaseClient';
import {
  validatePlatformAddonKey,
  validatePlatformPlanKey,
  validatePlatformReason,
} from './platformCapabilities';

function reasonGuard(reason: string): ServiceResult<never> | null {
  const err = validatePlatformReason(reason);
  return err ? { ok: false, error: err } : null;
}

export async function createPlatformPlan(
  planKey: string,
  planName: string,
  reason: string,
  options?: {
    description?: string;
    monthlyPriceCents?: number;
    yearlyPriceCents?: number;
    currency?: string;
    isPublic?: boolean;
  },
): Promise<ServiceResult<Record<string, unknown>>> {
  const guard = reasonGuard(reason);
  if (guard) return guard;
  const keyError = validatePlatformPlanKey(planKey);
  if (keyError) return { ok: false, error: keyError };
  const trimmedName = planName.trim();
  if (!trimmedName) return { ok: false, error: 'Plan-Name ist Pflicht.' };
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { plan: { plan_key: planKey.trim(), plan_name: trimmedName } } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_create_plan', {
    p_plan_key: planKey.trim(),
    p_plan_name: trimmedName,
    p_reason: reason.trim(),
    p_description: options?.description ?? null,
    p_monthly_price_cents: options?.monthlyPriceCents ?? 0,
    p_yearly_price_cents: options?.yearlyPriceCents ?? 0,
    p_currency: options?.currency ?? 'EUR',
    p_is_public: options?.isPublic ?? false,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function createPlatformPlanVersion(
  planKey: string,
  reason: string,
  monthlyPriceCents: number,
  yearlyPriceCents: number,
  effectiveFrom?: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const guard = reasonGuard(reason);
  if (guard) return guard;
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { plan_key: planKey, monthly_price_cents: monthlyPriceCents } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_create_plan_version', {
    p_plan_key: planKey,
    p_reason: reason.trim(),
    p_monthly_price_cents: monthlyPriceCents,
    p_yearly_price_cents: yearlyPriceCents,
    p_effective_from: effectiveFrom ?? new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function assignPlatformPlanToTenant(
  tenantId: string,
  planKey: string,
  reason: string,
  options?: {
    billingInterval?: 'monthly' | 'yearly';
    customMonthlyCents?: number | null;
    customYearlyCents?: number | null;
  },
): Promise<ServiceResult<Record<string, unknown>>> {
  const guard = reasonGuard(reason);
  if (guard) return guard;
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { tenant_id: tenantId, plan_key: planKey } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_assign_plan_to_tenant', {
    p_tenant_id: tenantId,
    p_plan_key: planKey,
    p_reason: reason.trim(),
    p_billing_interval: options?.billingInterval ?? 'monthly',
    p_custom_monthly_cents: options?.customMonthlyCents ?? null,
    p_custom_yearly_cents: options?.customYearlyCents ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function createPlatformAddon(
  addonKey: string,
  addonName: string,
  reason: string,
  options?: { description?: string; monthlyPriceCents?: number; yearlyPriceCents?: number },
): Promise<ServiceResult<Record<string, unknown>>> {
  const guard = reasonGuard(reason);
  if (guard) return guard;
  const keyError = validatePlatformAddonKey(addonKey);
  if (keyError) return { ok: false, error: keyError };
  const trimmedName = addonName.trim();
  if (!trimmedName) return { ok: false, error: 'Add-on-Name ist Pflicht.' };
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { addon: { addon_key: addonKey.trim() } } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_create_addon', {
    p_addon_key: addonKey.trim(),
    p_addon_name: trimmedName,
    p_reason: reason.trim(),
    p_description: options?.description ?? null,
    p_monthly_price_cents: options?.monthlyPriceCents ?? 0,
    p_yearly_price_cents: options?.yearlyPriceCents ?? 0,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function assignPlatformAddonToTenant(
  tenantId: string,
  addonKey: string,
  reason: string,
  options?: { billingInterval?: 'monthly' | 'yearly'; priceOverrideCents?: number | null },
): Promise<ServiceResult<Record<string, unknown>>> {
  const guard = reasonGuard(reason);
  if (guard) return guard;
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { tenant_id: tenantId, addon_key: addonKey } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_assign_addon_to_tenant', {
    p_tenant_id: tenantId,
    p_addon_key: addonKey,
    p_reason: reason.trim(),
    p_billing_interval: options?.billingInterval ?? 'monthly',
    p_price_override_cents: options?.priceOverrideCents ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function recalculatePlatformTenantEntitlements(
  tenantId: string,
  reason = 'manual_recalc',
): Promise<ServiceResult<Record<string, unknown>>> {
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { tenantId, count: 0 } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_recalculate_tenant_entitlements', {
    p_tenant_id: tenantId,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function getPlatformEffectiveTenantEntitlements(
  tenantId: string,
): Promise<ServiceResult<unknown[]>> {
  if (getServiceMode() === 'demo') {
    return { ok: true, data: [] };
  }
  const { data, error } = await platformRpc<unknown[]>('platform_get_effective_tenant_entitlements', {
    p_tenant_id: tenantId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function bookPlatformTenantCredit(
  tenantId: string,
  amountCents: number,
  reason: string,
  entryType: 'credit' | 'debit' | 'adjustment' = 'credit',
): Promise<ServiceResult<Record<string, unknown>>> {
  const guard = reasonGuard(reason);
  if (guard) return guard;
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { balanceCents: amountCents } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_book_tenant_credit', {
    p_tenant_id: tenantId,
    p_amount_cents: amountCents,
    p_reason: reason.trim(),
    p_entry_type: entryType,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function generatePlatformInvoicePreview(
  tenantId: string,
  periodStart: string,
  periodEnd: string,
  reason = 'preview',
  persist = true,
): Promise<ServiceResult<Record<string, unknown>>> {
  if (getServiceMode() === 'demo') {
    return {
      ok: true,
      data: { tenantId, subtotalCents: 0, discountCents: 0, creditCents: 0, totalCents: 0, isPreview: true },
    };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_generate_invoice_preview', {
    p_tenant_id: tenantId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_reason: reason,
    p_persist: persist,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function assignPlatformDiscountToTenant(
  tenantId: string,
  discountKey: string,
  reason: string,
  options?: { startsAt?: string; endsAt?: string },
): Promise<ServiceResult<Record<string, unknown>>> {
  const guard = reasonGuard(reason);
  if (guard) return guard;
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { tenant_id: tenantId, discount_key: discountKey } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_assign_discount_to_tenant', {
    p_tenant_id: tenantId,
    p_discount_key: discountKey,
    p_reason: reason.trim(),
    p_starts_at: options?.startsAt ?? new Date().toISOString(),
    p_ends_at: options?.endsAt ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function updatePlatformPlan(
  planKey: string,
  reason: string,
  options?: { planName?: string; description?: string; isPublic?: boolean; status?: string },
): Promise<ServiceResult<Record<string, unknown>>> {
  const guard = reasonGuard(reason);
  if (guard) return guard;
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { plan_key: planKey } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_update_plan', {
    p_plan_key: planKey,
    p_reason: reason.trim(),
    p_plan_name: options?.planName ?? null,
    p_description: options?.description ?? null,
    p_is_public: options?.isPublic ?? null,
    p_status: options?.status ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function assignPlatformPlanModule(
  planVersionId: string,
  moduleKey: string,
  accessState: string,
  reason: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const guard = reasonGuard(reason);
  if (guard) return guard;
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { module_key: moduleKey, access_state: accessState } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_assign_plan_module', {
    p_plan_version_id: planVersionId,
    p_module_key: moduleKey,
    p_access_state: accessState,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function removePlatformPlanModule(
  planVersionId: string,
  moduleKey: string,
  reason: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const guard = reasonGuard(reason);
  if (guard) return guard;
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { removed: true } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_remove_plan_module', {
    p_plan_version_id: planVersionId,
    p_module_key: moduleKey,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function setPlatformPlanLimit(
  planVersionId: string,
  limitKey: string,
  limitValue: number,
  reason: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const guard = reasonGuard(reason);
  if (guard) return guard;
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { limit_key: limitKey, limit_value: limitValue } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_set_plan_limit', {
    p_plan_version_id: planVersionId,
    p_limit_key: limitKey,
    p_limit_value: limitValue,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function suspendPlatformTenantSubscription(
  tenantId: string,
  reason: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const guard = reasonGuard(reason);
  if (guard) return guard;
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { status: 'suspended' } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_suspend_subscription', {
    p_tenant_id: tenantId,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function reactivatePlatformTenantSubscription(
  tenantId: string,
  reason: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const guard = reasonGuard(reason);
  if (guard) return guard;
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { status: 'active' } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_reactivate_subscription', {
    p_tenant_id: tenantId,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function cancelPlatformTenantSubscription(
  tenantId: string,
  reason: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const guard = reasonGuard(reason);
  if (guard) return guard;
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { status: 'cancelled' } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_cancel_subscription', {
    p_tenant_id: tenantId,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function updatePlatformAddon(
  addonKey: string,
  reason: string,
  options?: { addonName?: string; description?: string; status?: string },
): Promise<ServiceResult<Record<string, unknown>>> {
  const guard = reasonGuard(reason);
  if (guard) return guard;
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { addon_key: addonKey } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_update_addon', {
    p_addon_key: addonKey,
    p_reason: reason.trim(),
    p_addon_name: options?.addonName ?? null,
    p_description: options?.description ?? null,
    p_status: options?.status ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function createPlatformAddonVersion(
  addonKey: string,
  reason: string,
  monthlyPriceCents: number,
  yearlyPriceCents: number,
  effectiveFrom?: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const guard = reasonGuard(reason);
  if (guard) return guard;
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { addon_key: addonKey, monthly_price_cents: monthlyPriceCents } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_create_addon_version', {
    p_addon_key: addonKey,
    p_reason: reason.trim(),
    p_monthly_price_cents: monthlyPriceCents,
    p_yearly_price_cents: yearlyPriceCents,
    p_effective_from: effectiveFrom ?? new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function removePlatformAddonFromTenant(
  tenantId: string,
  addonKey: string,
  reason: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const guard = reasonGuard(reason);
  if (guard) return guard;
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { removed: true } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_remove_addon_from_tenant', {
    p_tenant_id: tenantId,
    p_addon_key: addonKey,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function removePlatformDiscountFromTenant(
  tenantId: string,
  discountKey: string,
  reason: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const guard = reasonGuard(reason);
  if (guard) return guard;
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { removed: true } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_remove_discount_from_tenant', {
    p_tenant_id: tenantId,
    p_discount_key: discountKey,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}
