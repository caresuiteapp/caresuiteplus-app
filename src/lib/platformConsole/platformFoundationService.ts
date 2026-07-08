import type { ServiceResult } from '@/types/core/base';
import { getServiceMode } from '@/lib/services/mode';
import { platformRpc } from './platformSupabaseClient';
import { validatePlatformReason } from './platformCapabilities';

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
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { plan: { plan_key: planKey, plan_name: planName } } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_create_plan', {
    p_plan_key: planKey,
    p_plan_name: planName,
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
  if (getServiceMode() === 'demo') {
    return { ok: true, data: { addon: { addon_key: addonKey } } };
  }
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_create_addon', {
    p_addon_key: addonKey,
    p_addon_name: addonName,
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
