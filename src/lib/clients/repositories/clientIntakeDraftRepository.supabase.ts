import type { ServiceResult } from '@/types';
import type { Database } from '@/lib/supabase/database.types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import {
  resolvePrimaryCostBearerName,
} from '@/lib/clients/clientIntakeCostBearerConfig';
import { resolveIntakeBillingProfileType } from '@/lib/clients/clientIntakeBilling';

function getClient() {
  return getSupabaseClient();
}

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function resolveDraftNames(form: ClientIntakeFormData): { firstName: string; lastName: string } {
  const firstName = form.firstName.trim() || 'Entwurf';
  const lastName = form.lastName.trim() || '—';
  return { firstName, lastName };
}

function buildIntakeClientPatch(
  tenantId: string,
  form: ClientIntakeFormData,
  actorProfileId?: string | null,
  status: Database['public']['Enums']['client_status'] = 'lead',
): Database['public']['Tables']['clients']['Insert'] {
  const { firstName, lastName } = resolveDraftNames(form);
  const primaryCostBearerName = resolvePrimaryCostBearerName(form);
  resolveIntakeBillingProfileType(form.billingTypes);

  return {
    tenant_id: tenantId,
    first_name: firstName,
    last_name: lastName,
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
    updated_by: actorProfileId ?? null,
  };
}

export async function upsertClientIntakeDraft(
  tenantId: string,
  form: ClientIntakeFormData,
  options?: { clientId?: string | null; actorProfileId?: string | null },
): Promise<ServiceResult<{ id: string }>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const patch = buildIntakeClientPatch(tenantId, form, options?.actorProfileId ?? null, 'lead');

  if (options?.clientId) {
    const { data, error } = await supabase
      .from('clients')
      .update(patch)
      .eq('id', options.clientId)
      .eq('tenant_id', tenantId)
      .eq('status', 'lead')
      .select('id')
      .maybeSingle();

    if (!error && data?.id) {
      return { ok: true, data: { id: data.id } };
    }

    // Stale AsyncStorage clientId (z. B. nach Abschluss der Aufnahme) → neuen Lead anlegen.
    if (error && !/0 rows|no rows|PGRST116/i.test(error.message ?? '')) {
      return { ok: false, error: toGermanSupabaseError(error) };
    }
  }

  const { data, error } = await supabase
    .from('clients')
    .insert({
      ...patch,
      created_by: options?.actorProfileId ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: { id: data.id } };
}
