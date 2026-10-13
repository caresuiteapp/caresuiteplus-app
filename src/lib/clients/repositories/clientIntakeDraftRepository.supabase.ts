import type { ServiceResult } from '@/types';
import type { Database } from '@/lib/supabase/database.types';
import { normalizeIntakeCareLevelForDb } from '@/lib/clients/clientIntakeCareLevel';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import {
  resolvePrimaryCostBearerName,
} from '@/lib/clients/clientIntakeCostBearerConfig';
import { resolveIntakeBillingProfileType } from '@/lib/clients/clientIntakeBilling';
import { isUuid } from '@/lib/validation/uuid';

function getClient() {
  return getSupabaseClient();
}

function unavailable(): Extract<ServiceResult<never>, { ok: false }> {
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
    care_level: normalizeIntakeCareLevelForDb(form.careLevel),
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
): Promise<ServiceResult<{ id: string }> & { recoverableClientId?: string }> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const patch = buildIntakeClientPatch(tenantId, form, options?.actorProfileId ?? null, 'lead');

  const clientId = isUuid(options?.clientId) ? options.clientId : (await import('expo-crypto')).randomUUID();
  try {
    const loaded = await supabase.from('clients').select('id, status')
      .eq('id', clientId).eq('tenant_id', tenantId).maybeSingle();
    if (loaded.error) return { ok: false, error: toGermanSupabaseError(loaded.error), recoverableClientId: clientId };
    if (loaded.data && loaded.data.status !== 'lead') {
      return { ok: false, error: 'Diese Aufnahme ist kein Entwurf mehr. Bitte öffnen Sie die bestehende Klientenakte.', recoverableClientId: clientId };
    }
    const query = loaded.data
      ? supabase.from('clients').update(patch).eq('id', clientId).eq('tenant_id', tenantId).eq('status', 'lead')
      : supabase.from('clients').insert({ ...patch, id: clientId, created_by: options?.actorProfileId ?? null });
    const { data, error } = await query.select('id').single();
    if (error || data?.id !== clientId) {
      return { ok: false, error: error ? toGermanSupabaseError(error) : 'Serversicherung konnte nicht bestätigt werden. Bitte denselben Entwurf erneut speichern.', recoverableClientId: clientId };
    }
    return { ok: true, data: { id: clientId } };
  } catch {
    // A lost response may follow a committed insert. Never allocate another UUID on retry.
    return { ok: false, error: 'Serversicherung konnte nicht bestätigt werden. Bitte denselben Entwurf erneut speichern.', recoverableClientId: clientId };
  }
}
