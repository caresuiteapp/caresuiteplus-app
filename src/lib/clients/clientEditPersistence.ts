import type { ServiceResult } from '@/types';
import type { ClientEditFormData } from '@/types/forms/clientEditForm';
import type { Database } from '@/lib/supabase/database.types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isSupabaseMissingTableError, toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { buildStreetLine } from '@/lib/clients/clientEditFormMappers';
import { buildClientContactWritePayload } from '@/lib/clients/clientContactPayload';
import type { ClientContactType } from '@/types/modules/client';

function getClient() {
  return getSupabaseClient();
}

const CARE_LEVEL_DB_VALUES = new Set([
  'none',
  'pg1',
  'pg2',
  'pg3',
  'pg4',
  'pg5',
  'unknown',
]);

function normalizeCareLevelForDb(value: string): Database['public']['Enums']['care_level'] | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const catalogToDb: Record<string, Database['public']['Enums']['care_level']> = {
    kein: 'none',
    unbekannt: 'unknown',
  };
  const mapped = catalogToDb[trimmed] ?? trimmed;
  return CARE_LEVEL_DB_VALUES.has(mapped) ? mapped : null;
}

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

async function upsertContact(
  tenantId: string,
  clientId: string,
  contactId: string | null,
  name: string,
  phone: string,
  relationship: string,
  contactType: ClientContactType,
  email = '',
): Promise<ServiceResult<string | null>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  if (!name.trim() && !phone.trim() && !email.trim()) {
    if (contactId) {
      const { error } = await fromUnknownTable(supabase, 'client_contacts')
        .delete()
        .eq('id', contactId)
        .eq('tenant_id', tenantId);
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
    }
    return { ok: true, data: null };
  }

  const payload = buildClientContactWritePayload({
    tenantId,
    clientId,
    name,
    phone,
    email,
    relationship,
    contactType,
  });

  if (contactId) {
    const { error } = await fromUnknownTable(supabase, 'client_contacts')
      .update(payload)
      .eq('id', contactId)
      .eq('tenant_id', tenantId);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: contactId };
  }

  const { data, error } = await fromUnknownTable(supabase, 'client_contacts')
    .insert(payload)
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: String((data as { id: string }).id) };
}

async function syncCareContexts(
  tenantId: string,
  clientId: string,
  contexts: ClientEditFormData['careContexts'],
): Promise<ServiceResult<void>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const { error: deleteError } = await fromUnknownTable(supabase, 'client_care_contexts')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId);
  if (deleteError) {
    if (isSupabaseMissingTableError(deleteError)) {
      return { ok: true, data: undefined };
    }
    return { ok: false, error: toGermanSupabaseError(deleteError) };
  }

  for (const [index, contextKey] of contexts.entries()) {
    const { error } = await fromUnknownTable(supabase, 'client_care_contexts').insert({
      tenant_id: tenantId,
      client_id: clientId,
      context_key: contextKey,
      is_primary: index === 0,
    });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
  }

  return { ok: true, data: undefined };
}

async function upsertPrimaryAddress(
  tenantId: string,
  clientId: string,
  form: ClientEditFormData,
): Promise<ServiceResult<void>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const streetLine = buildStreetLine(form.street, form.houseNumber);
  const payload = {
    tenant_id: tenantId,
    client_id: clientId,
    address_type: 'hauptwohnsitz',
    street: streetLine,
    zip: form.zip.trim(),
    city: form.city.trim(),
    country: 'DE',
    is_primary: true,
    access_notes: form.accessNotes.trim() || null,
    floor: form.floor.trim() || null,
    door_code: form.bellName.trim() || null,
  };

  if (form.primaryAddressId) {
    const { error } = await fromUnknownTable(supabase, 'client_addresses')
      .update(payload)
      .eq('id', form.primaryAddressId)
      .eq('tenant_id', tenantId);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: undefined };
  }

  if (!streetLine || !form.zip.trim() || !form.city.trim()) {
    return { ok: true, data: undefined };
  }

  const { error } = await fromUnknownTable(supabase, 'client_addresses').insert(payload);
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: undefined };
}

export async function persistClientEditData(
  tenantId: string,
  clientId: string,
  form: ClientEditFormData,
  actorProfileId?: string | null,
): Promise<ServiceResult<void>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const streetLine = buildStreetLine(form.street, form.houseNumber);
  const clientPatch: Database['public']['Tables']['clients']['Update'] = {
    first_name: form.firstName.trim(),
    last_name: form.lastName.trim(),
    date_of_birth: form.dateOfBirth || null,
    gender: form.gender || null,
    care_level: normalizeCareLevelForDb(form.careLevel),
    street: streetLine || null,
    house_number: form.houseNumber.trim() || null,
    postal_code: form.zip.trim() || null,
    city: form.city.trim() || null,
    phone: form.phone.trim() || null,
    mobile: form.mobile.trim() || null,
    email: form.email.trim() || null,
    internal_notes: form.notes.trim() || null,
    insurance_number: form.insuranceNumber.trim() || null,
    insurance_name: form.costCarrier.trim() || null,
    cost_bearer: form.costCarrier.trim() || null,
    access_notes: form.accessNotes.trim() || null,
    floor: form.floor.trim() || null,
    doorbell_name: form.bellName.trim() || null,
    diagnoses_notes: form.diagnosesNotes.trim() || null,
    mobility_notes: form.mobilityNotes.trim() || null,
    visible_notes_for_employee: form.careAgreementNotes.trim() || null,
    key_management_notes: form.communicationNotes.trim() || null,
    emergency_notes: form.riskNotes.trim() || null,
    updated_by: actorProfileId ?? null,
  };

  const { error: clientError } = await supabase
    .from('clients')
    .update(clientPatch)
    .eq('id', clientId)
    .eq('tenant_id', tenantId);

  if (clientError) {
    return { ok: false, error: toGermanSupabaseError(clientError) };
  }

  const addressResult = await upsertPrimaryAddress(tenantId, clientId, form);
  if (!addressResult.ok) return addressResult;

  const contextsResult = await syncCareContexts(tenantId, clientId, form.careContexts);
  if (!contextsResult.ok) return contextsResult;

  const emergencyResult = await upsertContact(
    tenantId,
    clientId,
    form.emergencyContactId,
    form.emergencyContactName,
    form.emergencyContactPhone,
    'notfallkontakt',
    'emergency_contact',
  );
  if (!emergencyResult.ok) return emergencyResult;

  const relativeResult = await upsertContact(
    tenantId,
    clientId,
    form.relativeContactId,
    form.relativeContactName,
    form.relativeContactPhone,
    'angehoerige',
    'relative',
  );
  if (!relativeResult.ok) return relativeResult;

  const doctorResult = await upsertContact(
    tenantId,
    clientId,
    form.familyDoctorId,
    form.familyDoctorName,
    form.familyDoctorPhone,
    'arzt',
    'doctor',
    form.familyDoctorEmail,
  );
  if (!doctorResult.ok) return doctorResult;

  const careServiceResult = await upsertContact(
    tenantId,
    clientId,
    form.careServiceId,
    form.careServiceName,
    form.careServicePhone,
    'pflegedienst',
    'care_service',
    form.careServiceEmail,
  );
  if (!careServiceResult.ok) return careServiceResult;

  if (form.billingProfileId && form.billingType && form.serviceType) {
    const { error: billingError } = await fromUnknownTable(supabase, 'client_billing_profiles')
      .update({
        billing_type: form.billingType,
        service_type: form.serviceType,
        cost_bearer_name: form.costCarrier.trim() || null,
      })
      .eq('id', form.billingProfileId)
      .eq('tenant_id', tenantId);
    if (billingError) return { ok: false, error: toGermanSupabaseError(billingError) };
  }

  const careLevelGrade = normalizeCareLevelForDb(form.careLevel);
  if (careLevelGrade) {
    const { data: existingLevels } = await fromUnknownTable(supabase, 'client_care_levels')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('valid_from', { ascending: false })
      .limit(1);

    const latest = Array.isArray(existingLevels) ? existingLevels[0] : null;
    const carePayload = {
      grade: careLevelGrade,
      care_fund_name: form.costCarrier.trim() || 'Unbekannt',
      care_fund_member_id: form.insuranceNumber.trim() || null,
    };

    if (latest && typeof latest === 'object' && 'id' in latest) {
      const { error } = await fromUnknownTable(supabase, 'client_care_levels')
        .update(carePayload)
        .eq('id', String((latest as { id: string }).id))
        .eq('tenant_id', tenantId);
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
    } else {
      const { error } = await fromUnknownTable(supabase, 'client_care_levels').insert({
        tenant_id: tenantId,
        client_id: clientId,
        grade: careLevelGrade,
        valid_from: new Date().toISOString().slice(0, 10),
        care_fund_name: form.costCarrier.trim() || 'Unbekannt',
        care_fund_member_id: form.insuranceNumber.trim() || null,
      });
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
    }
  }

  return { ok: true, data: undefined };
}
