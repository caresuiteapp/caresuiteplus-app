import type { ServiceResult } from '@/types';
import type { Database } from '@/lib/supabase/database.types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import {
  isCostBearerTypeKey,
  resolvePrimaryCostBearerName,
} from '@/lib/clients/clientIntakeCostBearerConfig';
import { resolveIntakeBillingProfileType } from '@/lib/clients/clientIntakeBilling';

function getClient() {
  return getSupabaseClient();
}

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function buildIntakeClientRecord(
  tenantId: string,
  form: ClientIntakeFormData,
  actorProfileId: string | null | undefined,
  status: Database['public']['Enums']['client_status'],
): Database['public']['Tables']['clients']['Insert'] {
  const primaryCostBearerName = resolvePrimaryCostBearerName(form);
  resolveIntakeBillingProfileType(form.billingTypes);

  return {
    tenant_id: tenantId,
    first_name: form.firstName.trim(),
    last_name: form.lastName.trim(),
    date_of_birth: form.dateOfBirth || null,
    care_level: (form.careLevel.trim() || null) as Database['public']['Enums']['care_level'] | null,
    status,
    street: form.street.trim() || null,
    house_number: form.houseNumber.trim() || null,
    postal_code: form.zip.trim() || null,
    city: form.city.trim() || null,
    phone: form.phone.trim() || null,
    mobile: form.mobile.trim() || null,
    email: form.email.trim() || null,
    internal_notes: form.specialNotes.trim() || null,
    insurance_number: form.insuranceNumber.trim() || null,
    insurance_name: primaryCostBearerName,
    cost_bearer: primaryCostBearerName,
    admission_date: form.admissionDate || null,
    gender: form.gender || null,
    created_by: actorProfileId ?? null,
    updated_by: actorProfileId ?? null,
  };
}

export async function updateClientFromIntake(
  tenantId: string,
  clientId: string,
  form: ClientIntakeFormData,
  actorProfileId?: string | null,
): Promise<ServiceResult<{ id: string }>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const record = buildIntakeClientRecord(tenantId, form, actorProfileId, 'active');
  const { status: _status, ...updateRecord } = record;

  const { data, error } = await supabase
    .from('clients')
    .update(updateRecord)
    .eq('id', clientId)
    .eq('tenant_id', tenantId)
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: { id: data.id } };
}

export async function createClientFromIntake(
  tenantId: string,
  form: ClientIntakeFormData,
  actorProfileId?: string | null,
  draftClientId?: string | null,
): Promise<ServiceResult<{ id: string }>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const record = buildIntakeClientRecord(tenantId, form, actorProfileId, 'active');

  if (draftClientId) {
    const { data, error } = await supabase
      .from('clients')
      .update(record)
      .eq('id', draftClientId)
      .eq('tenant_id', tenantId)
      .in('status', ['lead', 'active'])
      .select('id')
      .single();

    if (error || !data) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }

    return { ok: true, data: { id: data.id } };
  }

  const { data, error } = await supabase.from('clients').insert(record).select('id').single();
  if (error || !data) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: { id: data.id } };
}

export function summarizeIntakeBillingType(form: ClientIntakeFormData): string {
  const billingType = resolveIntakeBillingProfileType(form.billingTypes);
  const committedTypes = form.costBearerTypes.filter(isCostBearerTypeKey);
  return [billingType, ...committedTypes].filter(Boolean).join(', ');
}
