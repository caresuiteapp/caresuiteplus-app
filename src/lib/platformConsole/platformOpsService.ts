import type { ServiceResult } from '@/types/core/base';
import type {
  PlatformAuditEntry,
  PlatformDiscountRow,
  PlatformFeatureFlagRow,
  PlatformInvoiceRow,
  PlatformPaymentRow,
  PlatformSupportSessionRow,
  PlatformTenantDiscountRow,
  PlatformOperatorUserRow,
  PlatformReleaseRow,
  PlatformRoleKey,
  PlatformUserStatus,
  PlatformTenantUserRow,
} from '@/types/platformConsole';
import { getServiceMode } from '@/lib/services/mode';
import { platformRpc, platformSelect, platformSelectWhere } from './platformSupabaseClient';
import { validatePlatformReason } from './platformCapabilities';

export async function listPlatformAuditLog(options?: {
  tenantId?: string;
  action?: string;
  limit?: number;
  offset?: number;
}): Promise<ServiceResult<{ items: PlatformAuditEntry[] }>> {
  if (getServiceMode() === 'demo') {
    return {
      ok: true,
      data: {
        items: [
          {
            id: 'audit-demo-1',
            actor_user_id: '00000000-0000-4000-8000-000000000099',
            actor_role: 'platform_owner',
            action: 'module.enabled',
            target_type: 'platform_tenant_module',
            target_id: null,
            tenant_id: options?.tenantId ?? null,
            before: null,
            after: { module_key: 'assist', status: 'enabled' },
            reason: 'Demo-Freischaltung',
            created_at: new Date().toISOString(),
          },
        ],
      },
    };
  }

  const { data, error } = await platformRpc<{ items: PlatformAuditEntry[] }>('platform_list_audit_log', {
    p_tenant_id: options?.tenantId ?? null,
    p_action: options?.action ?? null,
    p_limit: options?.limit ?? 50,
    p_offset: options?.offset ?? 0,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? { items: [] } };
}

export async function assignPlatformDiscount(
  tenantId: string,
  discountKey: string,
  reason: string,
  options?: { startsAt?: string; endsAt?: string },
): Promise<ServiceResult<Record<string, unknown>>> {
  const reasonError = validatePlatformReason(reason);
  if (reasonError) return { ok: false, error: reasonError };

  if (options?.startsAt && options?.endsAt) {
    const start = new Date(options.startsAt).getTime();
    const end = new Date(options.endsAt).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
      return { ok: false, error: 'Enddatum muss nach dem Startdatum liegen.' };
    }
  }

  if (getServiceMode() === 'demo') {
    return { ok: true, data: { tenant_id: tenantId, discount_key: discountKey } };
  }

  const { data, error } = await platformRpc<Record<string, unknown>>('platform_assign_discount', {
    p_tenant_id: tenantId,
    p_discount_key: discountKey,
    p_reason: reason.trim(),
    p_starts_at: options?.startsAt ?? new Date().toISOString(),
    p_ends_at: options?.endsAt ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function removePlatformDiscount(
  tenantId: string,
  discountKey: string,
  reason: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const reasonError = validatePlatformReason(reason);
  if (reasonError) return { ok: false, error: reasonError };

  if (getServiceMode() === 'demo') {
    return { ok: true, data: { tenant_id: tenantId, discount_key: discountKey, status: 'revoked' } };
  }

  const { data, error } = await platformRpc<Record<string, unknown>>('platform_remove_discount', {
    p_tenant_id: tenantId,
    p_discount_key: discountKey,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function updatePlatformInvoiceStatus(
  invoiceId: string,
  status: string,
  reason: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const reasonError = validatePlatformReason(reason);
  if (reasonError) return { ok: false, error: reasonError };

  if (getServiceMode() === 'demo') {
    return { ok: true, data: { id: invoiceId, status } };
  }

  const { data, error } = await platformRpc<Record<string, unknown>>('platform_update_invoice_status', {
    p_invoice_id: invoiceId,
    p_status: status,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function createPlatformDiscount(input: { key: string; name: string; type: PlatformDiscountRow['discount_type']; value: number; description?: string }, reason: string): Promise<ServiceResult<Record<string, unknown>>> {
  const reasonError = validatePlatformReason(reason);
  if (reasonError) return { ok: false, error: reasonError };
  if (!/^[a-z0-9_-]{3,}$/.test(input.key.trim())) return { ok: false, error: 'Der Rabattcode muss mindestens drei Zeichen enthalten und darf nur Kleinbuchstaben, Zahlen, _ und - verwenden.' };
  if (!input.name.trim() || !Number.isFinite(input.value) || input.value < 0) return { ok: false, error: 'Name und ein gültiger Rabattwert sind erforderlich.' };
  if (getServiceMode() === 'demo') return { ok: true, data: { ...input, id: 'demo-discount' } };
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_create_discount', { p_discount_key: input.key.trim(), p_name: input.name.trim(), p_discount_type: input.type, p_value: input.value, p_description: input.description?.trim() || null, p_reason: reason.trim() });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function createPlatformManualInvoice(tenantId: string, totalCents: number, taxCents: number, dueDate: string, reason: string): Promise<ServiceResult<Record<string, unknown>>> {
  const reasonError = validatePlatformReason(reason);
  if (reasonError) return { ok: false, error: reasonError };
  if (!tenantId || totalCents <= 0 || taxCents < 0 || taxCents > totalCents || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { ok: false, error: 'Mandant, gültige Beträge und Fälligkeitsdatum sind erforderlich.' };
  if (getServiceMode() === 'demo') return { ok: true, data: { tenant_id: tenantId, total_cents: totalCents, tax_cents: taxCents, due_date: dueDate } };
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_create_manual_invoice', { p_tenant_id: tenantId, p_total_cents: totalCents, p_tax_cents: taxCents, p_due_date: dueDate, p_reason: reason.trim() });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function updatePlatformPaymentStatus(paymentId: string, status: string, reason: string): Promise<ServiceResult<Record<string, unknown>>> {
  const reasonError = validatePlatformReason(reason);
  if (reasonError) return { ok: false, error: reasonError };
  if (getServiceMode() === 'demo') return { ok: true, data: { id: paymentId, status } };
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_update_payment_status', { p_payment_id: paymentId, p_status: status, p_reason: reason.trim() });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function recordPlatformManualPayment(
  tenantId: string,
  invoiceId: string | null,
  amountCents: number,
  status: string,
  reason: string,
  paymentMethod = 'manual',
): Promise<ServiceResult<Record<string, unknown>>> {
  const reasonError = validatePlatformReason(reason);
  if (reasonError) return { ok: false, error: reasonError };

  if (getServiceMode() === 'demo') {
    return { ok: true, data: { tenant_id: tenantId, amount_cents: amountCents, status } };
  }

  const { data, error } = await platformRpc<Record<string, unknown>>('platform_record_manual_payment', {
    p_tenant_id: tenantId,
    p_invoice_id: invoiceId,
    p_amount_cents: amountCents,
    p_status: status,
    p_reason: reason.trim(),
    p_payment_method: paymentMethod,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function setPlatformFeatureFlag(
  flagKey: string,
  enabled: boolean,
  reason: string,
  options?: { scope?: string; tenantId?: string; rolloutPercentage?: number },
): Promise<ServiceResult<Record<string, unknown>>> {
  const reasonError = validatePlatformReason(reason);
  if (reasonError) return { ok: false, error: reasonError };

  if (getServiceMode() === 'demo') {
    return { ok: true, data: { flag_key: flagKey, enabled } };
  }

  const { data, error } = await platformRpc<Record<string, unknown>>('platform_set_feature_flag', {
    p_flag_key: flagKey,
    p_enabled: enabled,
    p_reason: reason.trim(),
    p_scope: options?.scope ?? 'global',
    p_tenant_id: options?.tenantId ?? null,
    p_rollout_percentage: options?.rolloutPercentage ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function startPlatformSupportSession(
  tenantId: string,
  reason: string,
  expiresAt: string,
  readonly = true,
  allowedScopes: string[] = [],
): Promise<ServiceResult<Record<string, unknown>>> {
  const reasonError = validatePlatformReason(reason);
  if (reasonError) return { ok: false, error: reasonError };

  if (getServiceMode() === 'demo') {
    return {
      ok: true,
      data: { tenant_id: tenantId, status: 'active', readonly, expires_at: expiresAt },
    };
  }

  const { data, error } = await platformRpc<Record<string, unknown>>('platform_start_support_session', {
    p_tenant_id: tenantId,
    p_reason: reason.trim(),
    p_expires_at: expiresAt,
    p_readonly: readonly,
    p_allowed_scopes: allowedScopes,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function endPlatformSupportSession(
  sessionId: string,
  reason: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const reasonError = validatePlatformReason(reason);
  if (reasonError) return { ok: false, error: reasonError };

  if (getServiceMode() === 'demo') {
    return { ok: true, data: { id: sessionId, status: 'closed' } };
  }

  const { data, error } = await platformRpc<Record<string, unknown>>('platform_end_support_session', {
    p_session_id: sessionId,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function updatePlatformSystemSetting(
  settingKey: string,
  value: unknown,
  reason: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const reasonError = validatePlatformReason(reason);
  if (reasonError) return { ok: false, error: reasonError };

  if (getServiceMode() === 'demo') {
    return { ok: true, data: { setting_key: settingKey, value } };
  }

  const { data, error } = await platformRpc<Record<string, unknown>>('platform_update_system_setting', {
    p_setting_key: settingKey,
    p_value: value,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function listPlatformModules(): Promise<ServiceResult<Record<string, unknown>[]>> {
  if (getServiceMode() === 'demo') {
    return {
      ok: true,
      data: [
        { module_key: 'office', module_name: 'Office', status: 'available' },
        { module_key: 'assist', module_name: 'Assist', status: 'available' },
      ],
    };
  }

  const { data, error } = await platformSelect<Record<string, unknown>>(
    'platform_modules',
    '*',
    'module_name',
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function listPlatformPlans(): Promise<ServiceResult<Record<string, unknown>[]>> {
  if (getServiceMode() === 'demo') {
    return {
      ok: true,
      data: [
        { plan_key: 'starter', plan_name: 'Starter', monthly_price_cents: 9900 },
        { plan_key: 'professional', plan_name: 'Professional', monthly_price_cents: 29900 },
      ],
    };
  }

  const { data, error } = await platformSelect<Record<string, unknown>>(
    'platform_plans',
    '*',
    'plan_name',
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function listPlatformSystemSettings(): Promise<ServiceResult<Record<string, unknown>[]>> {
  if (getServiceMode() === 'demo') {
    return {
      ok: true,
      data: [
        { setting_key: 'maintenance_mode', value: false, description: 'Wartungsmodus aktiv' },
        { setting_key: 'default_trial_days', value: 14, description: 'Standard-Trial-Dauer' },
      ],
    };
  }

  const { data, error } = await platformSelect<{
    id: string;
    setting_key: string;
    value: unknown;
    description: string | null;
    is_sensitive: boolean;
    updated_at: string;
  }>(
    'platform_system_settings',
    'id, setting_key, value, description, is_sensitive, updated_at',
    'setting_key',
  );
  if (error) return { ok: false, error: error.message };

  const sanitized = (data ?? []).map((row) => ({
    ...row,
    value: row.is_sensitive ? '[maskiert]' : row.value,
  }));

  return { ok: true, data: sanitized as Record<string, unknown>[] };
}

export async function listPlatformOperatorUsers(): Promise<ServiceResult<PlatformOperatorUserRow[]>> {
  if (getServiceMode() === 'demo') {
    return { ok: true, data: [{ id: 'demo-owner', user_id: 'demo', email: 'owner@example.com', full_name: 'Platform Owner', role: 'platform_owner', status: 'active', last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() }] };
  }
  const { data, error } = await platformRpc<{ items: PlatformOperatorUserRow[] }>('platform_list_operator_users');
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data?.items ?? [] };
}

export async function updatePlatformOperatorUser(
  platformUserId: string,
  role: PlatformRoleKey,
  status: PlatformUserStatus,
  reason: string,
): Promise<ServiceResult<Record<string, unknown>>> {
  const reasonError = validatePlatformReason(reason);
  if (reasonError) return { ok: false, error: reasonError };
  if (getServiceMode() === 'demo') return { ok: true, data: { id: platformUserId, role, status } };
  const { data, error } = await platformRpc<Record<string, unknown>>('platform_update_operator_user', {
    p_platform_user_id: platformUserId,
    p_role: role,
    p_status: status,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? {} };
}

export async function listPlatformReleases(): Promise<ServiceResult<PlatformReleaseRow[]>> {
  if (getServiceMode() === 'demo') return { ok: true, data: [] };
  const { data, error } = await platformRpc<{ items: PlatformReleaseRow[] }>('platform_list_releases', { p_limit: 100 });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data?.items ?? [] };
}

export async function listPlatformTenantUsers(tenantId: string): Promise<ServiceResult<PlatformTenantUserRow[]>> {
  if (getServiceMode() === 'demo') return { ok: true, data: [{ id: 'demo-user', display_name: 'Demo Mitarbeiter:in', email: 'mitarbeiter@example.com', phone: null, role_key: 'employee', updated_at: new Date().toISOString() }] };
  const { data, error } = await platformRpc<{ items: PlatformTenantUserRow[] }>('platform_list_tenant_users', { p_tenant_id: tenantId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data?.items ?? [] };
}

export async function registerPlatformRelease(
  release: Omit<PlatformReleaseRow, 'id' | 'checks' | 'deployed_at'> & { checks?: Record<string, unknown> },
  reason: string,
): Promise<ServiceResult<PlatformReleaseRow>> {
  const reasonError = validatePlatformReason(reason);
  if (reasonError) return { ok: false, error: reasonError };
  if (getServiceMode() === 'demo') return { ok: true, data: { ...release, id: 'demo-release', checks: release.checks ?? {}, deployed_at: new Date().toISOString() } };
  const { data, error } = await platformRpc<PlatformReleaseRow>('platform_register_release', {
    p_environment: release.environment,
    p_version_label: release.version_label,
    p_commit_sha: release.commit_sha,
    p_status: release.status,
    p_deployment_url: release.deployment_url,
    p_migration_version: release.migration_version,
    p_checks: release.checks ?? {},
    p_notes: release.notes,
    p_reason: reason.trim(),
  });
  if (error || !data) return { ok: false, error: error?.message ?? 'Release konnte nicht registriert werden.' };
  return { ok: true, data };
}

const DEMO_DISCOUNTS: PlatformDiscountRow[] = [
  {
    id: 'disc-1',
    discount_key: 'beta_20',
    discount_name: 'Beta 20%',
    discount_type: 'percentage',
    value: 20,
    status: 'active',
    description: 'Beta-Teilnehmer',
    created_at: new Date().toISOString(),
  },
  {
    id: 'disc-2',
    discount_key: 'goodwill_50',
    discount_name: 'Kulanz 50 EUR',
    discount_type: 'goodwill_credit',
    value: 5000,
    status: 'active',
    description: 'Manuelle Kulanz',
    created_at: new Date().toISOString(),
  },
];

const DEMO_INVOICES: PlatformInvoiceRow[] = [
  {
    id: 'inv-1',
    tenant_id: '00000000-0000-4000-8000-000000000001',
    invoice_number: 'INV-2026-001',
    status: 'open',
    amount_cents: 29900,
    tax_cents: 5681,
    net_cents: 24219,
    currency: 'EUR',
    due_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    issued_at: new Date().toISOString(),
    paid_at: null,
    created_at: new Date().toISOString(),
  },
];

const DEMO_PAYMENTS: PlatformPaymentRow[] = [
  {
    id: 'pay-1',
    tenant_id: '00000000-0000-4000-8000-000000000001',
    invoice_id: 'inv-1',
    amount_cents: 29900,
    status: 'succeeded',
    provider: 'stripe',
    provider_payment_id: 'pi_demo_abc123xyz',
    payment_method: 'card',
    failure_reason: null,
    created_at: new Date().toISOString(),
  },
];

const DEMO_FLAGS: PlatformFeatureFlagRow[] = [
  {
    id: 'ff-1',
    flag_key: 'messaging_v2',
    flag_name: 'Messaging V2',
    scope: 'global',
    tenant_id: null,
    enabled: true,
    rollout_percentage: 100,
    starts_at: null,
    ends_at: null,
    updated_at: new Date().toISOString(),
  },
];

const DEMO_SUPPORT: PlatformSupportSessionRow[] = [
  {
    id: 'ss-1',
    tenant_id: '00000000-0000-4000-8000-000000000001',
    status: 'active',
    readonly: true,
    allowed_scopes: ['tenants.read', 'modules.read'],
    reason: 'Onboarding-Hilfe',
    started_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    ended_at: null,
  },
];

function mapDiscountRow(row: Record<string, unknown>): PlatformDiscountRow {
  const type = String(row.discount_type ?? 'percentage');
  const value =
    row.percentage != null
      ? Number(row.percentage)
      : row.amount_cents != null
        ? Number(row.amount_cents)
        : row.free_months != null
          ? Number(row.free_months)
          : null;
  return {
    id: String(row.id),
    discount_key: String(row.discount_key),
    discount_name: String(row.name ?? row.discount_key),
    discount_type: type as PlatformDiscountRow['discount_type'],
    value,
    status: String(row.status ?? 'active'),
    description: row.description != null ? String(row.description) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

function mapInvoiceRow(row: Record<string, unknown>): PlatformInvoiceRow {
  const total = Number(row.total_cents ?? 0);
  const tax = row.tax_cents != null ? Number(row.tax_cents) : null;
  const subtotal = row.subtotal_cents != null ? Number(row.subtotal_cents) : null;
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    invoice_number: String(row.invoice_number ?? '—'),
    status: String(row.status),
    amount_cents: total,
    tax_cents: tax,
    net_cents: subtotal,
    currency: String(row.currency ?? 'EUR'),
    due_at: row.due_date ? String(row.due_date) : null,
    issued_at: row.issued_at != null ? String(row.issued_at) : null,
    paid_at: row.paid_at != null ? String(row.paid_at) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

function mapPaymentRow(row: Record<string, unknown>): PlatformPaymentRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    invoice_id: row.invoice_id != null ? String(row.invoice_id) : null,
    amount_cents: Number(row.amount_cents ?? 0),
    status: String(row.status),
    provider: row.provider != null ? String(row.provider) : null,
    provider_payment_id: row.external_payment_id != null ? String(row.external_payment_id) : null,
    payment_method: row.payment_method != null ? String(row.payment_method) : null,
    failure_reason: row.failure_reason != null ? String(row.failure_reason) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

function mapFlagRow(row: Record<string, unknown>): PlatformFeatureFlagRow {
  return {
    id: String(row.id),
    flag_key: String(row.flag_key),
    flag_name: String(row.name ?? row.flag_key),
    scope: String(row.scope ?? 'global'),
    tenant_id: row.tenant_id != null ? String(row.tenant_id) : null,
    enabled: Boolean(row.enabled),
    rollout_percentage: row.rollout_percentage != null ? Number(row.rollout_percentage) : null,
    starts_at: row.starts_at != null ? String(row.starts_at) : null,
    ends_at: row.ends_at != null ? String(row.ends_at) : null,
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function mapSupportRow(row: Record<string, unknown>): PlatformSupportSessionRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    status: String(row.status),
    readonly: Boolean(row.readonly ?? true),
    allowed_scopes: Array.isArray(row.allowed_scopes) ? (row.allowed_scopes as string[]) : null,
    reason: row.reason != null ? String(row.reason) : null,
    started_at: String(row.starts_at ?? row.created_at ?? new Date().toISOString()),
    expires_at: String(row.expires_at),
    ended_at: row.ends_at != null ? String(row.ends_at) : null,
  };
}

function mapTenantDiscountRow(row: Record<string, unknown>): PlatformTenantDiscountRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    discount_key: String(row.discount_key),
    status: String(row.status),
    starts_at: row.starts_at != null ? String(row.starts_at) : null,
    ends_at: row.ends_at != null ? String(row.ends_at) : null,
    reason: row.reason != null ? String(row.reason) : null,
    assigned_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function listPlatformDiscountCatalog(): Promise<ServiceResult<PlatformDiscountRow[]>> {
  if (getServiceMode() === 'demo') {
    return { ok: true, data: DEMO_DISCOUNTS };
  }
  const { data, error } = await platformSelect<Record<string, unknown>>('platform_discounts', '*', 'name');
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map(mapDiscountRow) };
}

export async function listPlatformTenantDiscounts(options?: {
  tenantId?: string;
}): Promise<ServiceResult<PlatformTenantDiscountRow[]>> {
  if (getServiceMode() === 'demo') {
    return {
      ok: true,
      data: [
        {
          id: 'td-1',
          tenant_id: options?.tenantId ?? '00000000-0000-4000-8000-000000000001',
          discount_key: 'beta_20',
          status: 'active',
          starts_at: new Date().toISOString(),
          ends_at: null,
          reason: 'Beta-Programm',
          assigned_at: new Date().toISOString(),
        },
      ],
    };
  }
  const { data, error } = await platformSelectWhere<Record<string, unknown>>('platform_tenant_discounts', '*', {
    orderBy: 'created_at',
    ascending: false,
    eq: options?.tenantId ? { tenant_id: options.tenantId } : undefined,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map(mapTenantDiscountRow) };
}

export async function listPlatformInvoices(options?: {
  tenantId?: string;
  status?: string;
  search?: string;
}): Promise<ServiceResult<PlatformInvoiceRow[]>> {
  if (getServiceMode() === 'demo') {
    let rows = DEMO_INVOICES;
    if (options?.tenantId) rows = rows.filter((r) => r.tenant_id === options.tenantId);
    if (options?.status) rows = rows.filter((r) => r.status === options.status);
    if (options?.search) {
      const q = options.search.toLowerCase();
      rows = rows.filter((r) => r.invoice_number.toLowerCase().includes(q));
    }
    return { ok: true, data: rows };
  }
  const { data, error } = await platformSelectWhere<Record<string, unknown>>('platform_invoices', '*', {
    orderBy: 'created_at',
    ascending: false,
    eq: {
      ...(options?.tenantId ? { tenant_id: options.tenantId } : {}),
      ...(options?.status ? { status: options.status } : {}),
    },
  });
  if (error) return { ok: false, error: error.message };
  let rows = (data ?? []).map(mapInvoiceRow);
  if (options?.search) {
    const q = options.search.toLowerCase();
    rows = rows.filter((r) => r.invoice_number.toLowerCase().includes(q));
  }
  return { ok: true, data: rows };
}

export async function listPlatformPayments(options?: {
  tenantId?: string;
  invoiceId?: string;
  status?: string;
  provider?: string;
}): Promise<ServiceResult<PlatformPaymentRow[]>> {
  if (getServiceMode() === 'demo') {
    let rows = DEMO_PAYMENTS;
    if (options?.tenantId) rows = rows.filter((r) => r.tenant_id === options.tenantId);
    if (options?.invoiceId) rows = rows.filter((r) => r.invoice_id === options.invoiceId);
    if (options?.status) rows = rows.filter((r) => r.status === options.status);
    if (options?.provider) rows = rows.filter((r) => r.provider === options.provider);
    return { ok: true, data: rows };
  }
  const eq: Record<string, string> = {};
  if (options?.tenantId) eq.tenant_id = options.tenantId;
  if (options?.invoiceId) eq.invoice_id = options.invoiceId;
  if (options?.status) eq.status = options.status;
  if (options?.provider) eq.provider = options.provider;
  const { data, error } = await platformSelectWhere<Record<string, unknown>>('platform_payments', '*', {
    orderBy: 'created_at',
    ascending: false,
    eq: Object.keys(eq).length ? eq : undefined,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map(mapPaymentRow) };
}

export async function listPlatformFeatureFlags(options?: {
  tenantId?: string;
  scope?: string;
}): Promise<ServiceResult<PlatformFeatureFlagRow[]>> {
  if (getServiceMode() === 'demo') {
    return { ok: true, data: DEMO_FLAGS };
  }
  const eq: Record<string, string> = {};
  if (options?.tenantId) eq.tenant_id = options.tenantId;
  if (options?.scope) eq.scope = options.scope;
  const { data, error } = await platformSelectWhere<Record<string, unknown>>('platform_feature_flags', '*', {
    orderBy: 'flag_key',
    eq: Object.keys(eq).length ? eq : undefined,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []).map(mapFlagRow) };
}

export async function listPlatformSupportSessions(options?: {
  tenantId?: string;
  activeOnly?: boolean;
}): Promise<ServiceResult<PlatformSupportSessionRow[]>> {
  if (getServiceMode() === 'demo') {
    let rows = DEMO_SUPPORT;
    if (options?.tenantId) rows = rows.filter((r) => r.tenant_id === options.tenantId);
    if (options?.activeOnly) rows = rows.filter((r) => r.status === 'active');
    return { ok: true, data: rows };
  }
  const { data, error } = await platformSelectWhere<Record<string, unknown>>('platform_support_sessions', '*', {
    orderBy: 'starts_at',
    ascending: false,
    eq: options?.tenantId ? { tenant_id: options.tenantId } : undefined,
  });
  if (error) return { ok: false, error: error.message };
  let rows = (data ?? []).map(mapSupportRow);
  if (options?.activeOnly) {
    rows = rows.filter((r) => r.status === 'active');
  }
  return { ok: true, data: rows };
}

export function getPlatformPlanLimits(plan: Record<string, unknown> | null | undefined): Record<string, number | null> {
  if (!plan) return {};
  return {
    max_users: plan.max_users != null ? Number(plan.max_users) : null,
    max_clients: plan.max_clients != null ? Number(plan.max_clients) : null,
    max_employees: plan.max_employees != null ? Number(plan.max_employees) : null,
    max_storage_mb: plan.max_storage_mb != null ? Number(plan.max_storage_mb) : null,
  };
}

export function getPlatformLimitsDeferred(): string[] {
  return [
    'max_api_requests',
    'max_active_assignments',
    'max_message_attachments',
    'max_document_templates',
    'max_signatures_per_month',
    'max_ai_usage',
  ];
}

export function getPlatformReleaseInfo(): {
  environment: string;
  demoMode: boolean;
  supabaseUrlMasked: string;
  buildHint: string;
} {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const masked = url
    ? `${url.slice(0, 12)}…${url.slice(-8)}`
    : '(nicht konfiguriert)';

  return {
    environment: process.env.NODE_ENV ?? 'development',
    demoMode: process.env.EXPO_PUBLIC_DEMO_MODE === 'true',
    supabaseUrlMasked: masked,
    buildHint: typeof __DEV__ !== 'undefined' && __DEV__ ? 'Development Build' : 'Production Build',
  };
}
