import type { ServiceResult } from '@/types';
import type { Database } from '@/lib/supabase/database.types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
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
    salutation: form.salutation || null,
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
    service_start: form.serviceStart || null,
    birth_place: form.birthPlace.trim() || null,
    nationality: form.nationality.trim() || null,
    language: form.language.trim() || null,
    marital_status: form.maritalStatus.trim() || null,
    housing_form: form.housingForm.trim() || null,
    special_notes: form.specialNotes.trim() || null,
    primary_contact_phone: form.phone.trim() || form.mobile.trim() || null,
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

  // Keep an unfinished intake recoverable. The client is activated only after
  // every related record, document and signature has been persisted.
  const record = buildIntakeClientRecord(tenantId, form, actorProfileId, 'lead');

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

export async function activateClientFromIntake(
  tenantId: string,
  clientId: string,
  actorProfileId?: string | null,
): Promise<ServiceResult<{ id: string }>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const { data, error } = await supabase
    .from('clients')
    .update({
      status: 'active',
      updated_by: actorProfileId ?? null,
    })
    .eq('id', clientId)
    .eq('tenant_id', tenantId)
    .in('status', ['lead', 'active'])
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: { id: data.id } };
}

/**
 * Repairs an intake that reached document signing but remained a lead because
 * a later derived synchronization failed. Existing signatures are only read.
 */
export async function repairCompletedClientIntakeActivation(
  tenantId: string,
  clientId: string,
  actorProfileId?: string | null,
): Promise<ServiceResult<void>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('status')
    .eq('id', clientId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (clientError) {
    return { ok: false, error: toGermanSupabaseError(clientError) };
  }
  if (!client || client.status !== 'lead') {
    return { ok: true, data: undefined };
  }

  const [eventResult, signatureResult] = await Promise.all([
    fromUnknownTable(supabase, 'client_timeline_events')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .contains('metadata', { source: 'intake' })
      .limit(1)
      .maybeSingle(),
    fromUnknownTable(supabase, 'client_document_signatures')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('signer_role', 'client')
      .limit(1)
      .maybeSingle(),
  ]);

  if (eventResult.error) {
    return { ok: false, error: toGermanSupabaseError(eventResult.error) };
  }
  if (signatureResult.error) {
    return { ok: false, error: toGermanSupabaseError(signatureResult.error) };
  }
  if (!eventResult.data || !signatureResult.data) {
    return { ok: true, data: undefined };
  }

  const { error: activationError } = await supabase
    .from('clients')
    .update({
      status: 'active',
      updated_by: actorProfileId ?? null,
    })
    .eq('id', clientId)
    .eq('tenant_id', tenantId)
    .eq('status', 'lead');
  return activationError
    ? { ok: false, error: toGermanSupabaseError(activationError) }
    : { ok: true, data: undefined };
}

export function summarizeIntakeBillingType(form: ClientIntakeFormData): string {
  const billingType = resolveIntakeBillingProfileType(form.billingTypes);
  const committedTypes = form.costBearerTypes.filter(isCostBearerTypeKey);
  return [billingType, ...committedTypes].filter(Boolean).join(', ');
}
