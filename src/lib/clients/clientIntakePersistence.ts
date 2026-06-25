import type { ServiceResult } from '@/types';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { buildClientContactWritePayload } from '@/lib/clients/clientContactPayload';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  resolvePrimaryCostBearerName,
  resolvePrimaryCostBearerReference,
} from '@/lib/clients/clientIntakeCostBearerConfig';
import { resolveIntakeBillingProfileType } from '@/lib/clients/clientIntakeBilling';
import { serializeHomeAccessValues } from '@/lib/clients/clientIntakeHomeAccess';
import { syncClientCareEntitlementFromLegacy } from '@/lib/assist/clientCareEntitlementSyncService';

function getClient() {
  return getSupabaseClient();
}

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: SERVICE_ERRORS.supabaseUnavailable };
}

function parseHourlyRateCents(value: string): number {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return 0;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

function resolveServiceType(careContexts: ClientIntakeFormData['careContexts']): string {
  if (careContexts.includes('ambulatory_care')) return 'sachleistung';
  if (careContexts.includes('support_care') || careContexts.includes('daily_assistance')) return 'betreuung';
  if (careContexts.includes('stationary_care')) return 'haushalt';
  return 'betreuung';
}

export async function persistIntakeClientExtendedData(
  tenantId: string,
  clientId: string,
  form: ClientIntakeFormData,
  actorProfileId?: string | null,
): Promise<ServiceResult<void>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const streetLine = [form.street.trim(), form.houseNumber.trim()].filter(Boolean).join(' ');
  const billingType = resolveIntakeBillingProfileType(form.billingTypes);
  const primaryCostBearerName = resolvePrimaryCostBearerName(form);
  const primaryCostBearerRef = resolvePrimaryCostBearerReference(form);

  for (const [index, contextKey] of form.careContexts.entries()) {
    const { error } = await fromUnknownTable(supabase, 'client_care_contexts').insert({
      tenant_id: tenantId,
      client_id: clientId,
      context_key: contextKey,
      is_primary: index === 0,
    });
    if (error && error.code !== '23505') {
      return { ok: false, error: toGermanSupabaseError(error) };
    }
  }

  if (streetLine && form.zip.trim() && form.city.trim()) {
    const { error } = await fromUnknownTable(supabase, 'client_addresses').insert({
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
      door_code: form.doorCode.trim() || null,
    });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (form.careLevel.trim()) {
    const { error } = await fromUnknownTable(supabase, 'client_care_levels').insert({
      tenant_id: tenantId,
      client_id: clientId,
      grade: form.careLevel.trim(),
      valid_from: form.careLevelValidFrom.trim() || form.serviceStart.trim() || form.admissionDate || new Date().toISOString().slice(0, 10),
      care_fund_name: form.careFundName.trim() || primaryCostBearerName || 'Unbekannt',
      care_fund_member_id: form.insuranceNumber.trim() || null,
      notes: form.careLevelStatus.trim() || null,
    });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
  }

  const { error: billingError } = await fromUnknownTable(supabase, 'client_billing_profiles').insert({
    tenant_id: tenantId,
    client_id: clientId,
    billing_type: billingType,
    hourly_rate_cents: parseHourlyRateCents(form.hourlyRate),
    service_type: resolveServiceType(form.careContexts),
    cost_bearer_name: primaryCostBearerName,
    cost_bearer_reference: primaryCostBearerRef,
    invoice_recipient: form.selbstzahlerName.trim() || null,
    notes: form.billingTypes.join(', ') || null,
  });
  if (billingError) return { ok: false, error: toGermanSupabaseError(billingError) };

  const { data: existingInsurance } = await fromUnknownTable(supabase, 'client_insurance_profiles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('is_primary', true)
    .maybeSingle();

  if (!existingInsurance) {
    const { error: insuranceError } = await fromUnknownTable(supabase, 'client_insurance_profiles').insert({
      tenant_id: tenantId,
      client_id: clientId,
      care_level: form.careLevel.trim() || null,
      care_level_status: form.careLevelStatus.trim() || null,
      care_level_valid_from: form.careLevelValidFrom.trim() || null,
      care_fund_name: form.careFundName.trim() || null,
      health_insurance: form.healthInsurance.trim() || null,
      cost_bearer_ik: form.costBearerIk.trim() || form.healthInsuranceIk.trim() || null,
      insurance_number: form.insuranceNumber.trim() || null,
      billing_type: billingType,
      self_pay: form.selfPay,
      is_primary: true,
    });
    if (insuranceError) return { ok: false, error: toGermanSupabaseError(insuranceError) };
  }

  if (form.emergencyContactName.trim() || form.emergencyContactPhone.trim()) {
    const { error } = await fromUnknownTable(supabase, 'client_contacts').insert(
      buildClientContactWritePayload({
        tenantId,
        clientId,
        name: form.emergencyContactName.trim() || 'Notfallkontakt',
        phone: form.emergencyContactPhone,
        relationship: 'notfallkontakt',
        contactType: 'emergency_contact',
      }),
    );
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (form.familyDoctor.trim()) {
    const { error } = await fromUnknownTable(supabase, 'client_contacts').insert(
      buildClientContactWritePayload({
        tenantId,
        clientId,
        name: form.familyDoctor.trim(),
        phone: '',
        relationship: 'arzt',
        contactType: 'doctor',
      }),
    );
    if (error && error.code !== '23505') return { ok: false, error: toGermanSupabaseError(error) };
  }

  const homeAccessStored = serializeHomeAccessValues(form.homeAccess);
  const hasAmbulatoryData =
    homeAccessStored ||
    form.keyStatus ||
    form.familyDoctor.trim() ||
    form.accessNotes.trim() ||
    form.pets;

  if (hasAmbulatoryData) {
    const { error } = await fromUnknownTable(supabase, 'client_ambulatory_details').insert({
      tenant_id: tenantId,
      client_id: clientId,
      home_access: homeAccessStored,
      key_status: form.keyStatus || null,
      key_number: form.keyNumber.trim() || null,
      key_safe_code: form.keySafeCode.trim() || null,
      door_code: form.doorCode.trim() || null,
      bell_name: form.bellName.trim() || null,
      floor: form.floor.trim() || null,
      elevator_available: form.elevatorAvailable,
      parking_notes: form.parkingNotes.trim() || null,
      access_notes: form.accessNotes.trim() || null,
      hazard_notes: form.hazardNotes.trim() || null,
      pets: form.pets || null,
      smoker_household: form.smokerHousehold,
      aids_on_site: form.aidsOnSite.trim() || null,
      hygiene_notes: form.hygieneNotes.trim() || null,
      infection_notes: form.infectionNotes.trim() || null,
      family_doctor: form.familyDoctor.trim() || null,
    });
    if (error && error.code !== '23505') return { ok: false, error: toGermanSupabaseError(error) };
  }

  if (form.facilityName.trim() || form.roomNumber.trim()) {
    const { error } = await fromUnknownTable(supabase, 'client_stationary_details').insert({
      tenant_id: tenantId,
      client_id: clientId,
      facility_name: form.facilityName.trim() || null,
      facility_location: form.facilityLocation.trim() || null,
      care_area: form.careArea.trim() || null,
      room_number: form.roomNumber.trim() || null,
      bed_position: form.bedPosition.trim() || null,
      admission_date: form.admissionDateStationary.trim() || form.admissionDate || null,
      resident_status: form.residentStatus.trim() || null,
      room_status: form.roomStatus.trim() || null,
      primary_nurse: form.primaryNurse.trim() || null,
      area_manager: form.areaManager.trim() || null,
      cost_form: form.costForm.trim() || null,
      meal_notes: form.mealNotes.trim() || null,
      daily_structure: form.dailyStructure.trim() || null,
    });
    if (error && error.code !== '23505') return { ok: false, error: toGermanSupabaseError(error) };
  }

  const { error: timelineError } = await fromUnknownTable(supabase, 'client_timeline_events').insert({
    tenant_id: tenantId,
    client_id: clientId,
    event_type: 'sonstige',
    icon: '📋',
    title: 'Aufnahme abgeschlossen',
    subtitle: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
    status: 'abgeschlossen',
    actor_name: actorProfileId ?? null,
    is_internal: false,
    metadata: { source: 'intake' },
  });
  if (timelineError) return { ok: false, error: toGermanSupabaseError(timelineError) };

  await syncClientCareEntitlementFromLegacy(tenantId, clientId, { regenerateAccounts: true });

  return { ok: true, data: undefined };
}

async function syncCareContexts(
  tenantId: string,
  clientId: string,
  contexts: ClientIntakeFormData['careContexts'],
): Promise<ServiceResult<void>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const { error: deleteError } = await fromUnknownTable(supabase, 'client_care_contexts')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId);
  if (deleteError) return { ok: false, error: toGermanSupabaseError(deleteError) };

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
  form: ClientIntakeFormData,
): Promise<ServiceResult<void>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const streetLine = [form.street.trim(), form.houseNumber.trim()].filter(Boolean).join(' ');
  if (!streetLine || !form.zip.trim() || !form.city.trim()) {
    return { ok: true, data: undefined };
  }

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
    door_code: form.doorCode.trim() || null,
  };

  const { data: existing } = await fromUnknownTable(supabase, 'client_addresses')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('is_primary', true)
    .maybeSingle();

  if (existing && typeof existing === 'object' && 'id' in existing) {
    const { error } = await fromUnknownTable(supabase, 'client_addresses')
      .update(payload)
      .eq('id', String((existing as { id: string }).id))
      .eq('tenant_id', tenantId);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: undefined };
  }

  const { error } = await fromUnknownTable(supabase, 'client_addresses').insert(payload);
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: undefined };
}

async function upsertContactByType(
  tenantId: string,
  clientId: string,
  name: string,
  phone: string,
  relationship: string,
  contactType: string,
): Promise<ServiceResult<void>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const { data: existing } = await fromUnknownTable(supabase, 'client_contacts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('contact_type', contactType)
    .maybeSingle();

  if (!name.trim() && !phone.trim()) {
    if (existing && typeof existing === 'object' && 'id' in existing) {
      const { error } = await fromUnknownTable(supabase, 'client_contacts')
        .delete()
        .eq('id', String((existing as { id: string }).id))
        .eq('tenant_id', tenantId);
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
    }
    return { ok: true, data: undefined };
  }

  const payload = buildClientContactWritePayload({
    tenantId,
    clientId,
    name: name.trim() || 'Kontakt',
    phone,
    relationship,
    contactType: contactType as import('@/types/modules/client').ClientContactType,
  });

  if (existing && typeof existing === 'object' && 'id' in existing) {
    const { error } = await fromUnknownTable(supabase, 'client_contacts')
      .update(payload)
      .eq('id', String((existing as { id: string }).id))
      .eq('tenant_id', tenantId);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: undefined };
  }

  const { error } = await fromUnknownTable(supabase, 'client_contacts').insert(payload);
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: undefined };
}

/** Syncs intake extended data on edit — upserts related records instead of insert-only. */
export async function syncIntakeClientExtendedData(
  tenantId: string,
  clientId: string,
  form: ClientIntakeFormData,
  actorProfileId?: string | null,
): Promise<ServiceResult<void>> {
  const supabase = getClient();
  if (!supabase) return unavailable();

  const billingType = resolveIntakeBillingProfileType(form.billingTypes);
  const primaryCostBearerName = resolvePrimaryCostBearerName(form);
  const primaryCostBearerRef = resolvePrimaryCostBearerReference(form);

  const contextsResult = await syncCareContexts(tenantId, clientId, form.careContexts);
  if (!contextsResult.ok) return contextsResult;

  const addressResult = await upsertPrimaryAddress(tenantId, clientId, form);
  if (!addressResult.ok) return addressResult;

  if (form.careLevel.trim()) {
    const { data: existingLevels } = await fromUnknownTable(supabase, 'client_care_levels')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .order('valid_from', { ascending: false })
      .limit(1);

    const latest = Array.isArray(existingLevels) ? existingLevels[0] : null;
    const carePayload = {
      grade: form.careLevel.trim(),
      valid_from:
        form.careLevelValidFrom.trim()
        || form.serviceStart.trim()
        || form.admissionDate
        || new Date().toISOString().slice(0, 10),
      care_fund_name: form.careFundName.trim() || primaryCostBearerName || 'Unbekannt',
      care_fund_member_id: form.insuranceNumber.trim() || null,
      notes: form.careLevelStatus.trim() || null,
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
        ...carePayload,
      });
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
    }
  }

  const billingPayload = {
    billing_type: billingType,
    hourly_rate_cents: parseHourlyRateCents(form.hourlyRate),
    service_type: resolveServiceType(form.careContexts),
    cost_bearer_name: primaryCostBearerName,
    cost_bearer_reference: primaryCostBearerRef,
    invoice_recipient: String((form as Record<string, unknown>).selbstzahlerName ?? '').trim() || null,
    notes: form.billingTypes.join(', ') || null,
  };

  const { data: existingBilling } = await fromUnknownTable(supabase, 'client_billing_profiles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (existingBilling && typeof existingBilling === 'object' && 'id' in existingBilling) {
    const { error } = await fromUnknownTable(supabase, 'client_billing_profiles')
      .update(billingPayload)
      .eq('id', String((existingBilling as { id: string }).id))
      .eq('tenant_id', tenantId);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
  } else {
    const { error } = await fromUnknownTable(supabase, 'client_billing_profiles').insert({
      tenant_id: tenantId,
      client_id: clientId,
      ...billingPayload,
    });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
  }

  const { data: existingInsurance } = await fromUnknownTable(supabase, 'client_insurance_profiles')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('is_primary', true)
    .maybeSingle();

  const insurancePayload = {
    care_level: form.careLevel.trim() || null,
    care_level_status: form.careLevelStatus.trim() || null,
    care_level_valid_from: form.careLevelValidFrom.trim() || null,
    care_fund_name: form.careFundName.trim() || null,
    health_insurance: form.healthInsurance.trim() || null,
    cost_bearer_ik: form.costBearerIk.trim() || null,
    insurance_number: form.insuranceNumber.trim() || null,
    billing_type: billingType,
    self_pay: form.selfPay,
    is_primary: true,
  };

  if (existingInsurance && typeof existingInsurance === 'object' && 'id' in existingInsurance) {
    const { error } = await fromUnknownTable(supabase, 'client_insurance_profiles')
      .update(insurancePayload)
      .eq('id', String((existingInsurance as { id: string }).id))
      .eq('tenant_id', tenantId);
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
  } else {
    const { error } = await fromUnknownTable(supabase, 'client_insurance_profiles').insert({
      tenant_id: tenantId,
      client_id: clientId,
      ...insurancePayload,
    });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
  }

  const emergencyResult = await upsertContactByType(
    tenantId,
    clientId,
    form.emergencyContactName,
    form.emergencyContactPhone,
    'notfallkontakt',
    'emergency_contact',
  );
  if (!emergencyResult.ok) return emergencyResult;

  if (form.familyDoctor.trim()) {
    const doctorResult = await upsertContactByType(
      tenantId,
      clientId,
      form.familyDoctor.trim(),
      '',
      'arzt',
      'doctor',
    );
    if (!doctorResult.ok) return doctorResult;
  }

  const homeAccessStored = serializeHomeAccessValues(form.homeAccess);
  const hasAmbulatoryData =
    homeAccessStored
    || form.keyStatus
    || form.familyDoctor.trim()
    || form.accessNotes.trim()
    || form.pets;

  if (hasAmbulatoryData) {
    const ambulatoryPayload = {
      home_access: homeAccessStored,
      key_status: form.keyStatus || null,
      key_number: form.keyNumber.trim() || null,
      key_safe_code: form.keySafeCode.trim() || null,
      door_code: form.doorCode.trim() || null,
      bell_name: form.bellName.trim() || null,
      floor: form.floor.trim() || null,
      elevator_available: form.elevatorAvailable,
      parking_notes: form.parkingNotes.trim() || null,
      access_notes: form.accessNotes.trim() || null,
      hazard_notes: form.hazardNotes.trim() || null,
      pets: form.pets || null,
      smoker_household: form.smokerHousehold,
      aids_on_site: form.aidsOnSite.trim() || null,
      hygiene_notes: form.hygieneNotes.trim() || null,
      infection_notes: form.infectionNotes.trim() || null,
      family_doctor: form.familyDoctor.trim() || null,
    };

    const { data: existingAmbulatory } = await fromUnknownTable(supabase, 'client_ambulatory_details')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (existingAmbulatory && typeof existingAmbulatory === 'object' && 'id' in existingAmbulatory) {
      const { error } = await fromUnknownTable(supabase, 'client_ambulatory_details')
        .update(ambulatoryPayload)
        .eq('id', String((existingAmbulatory as { id: string }).id))
        .eq('tenant_id', tenantId);
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
    } else {
      const { error } = await fromUnknownTable(supabase, 'client_ambulatory_details').insert({
        tenant_id: tenantId,
        client_id: clientId,
        ...ambulatoryPayload,
      });
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
    }
  }

  if (form.facilityName.trim() || form.roomNumber.trim()) {
    const stationaryPayload = {
      facility_name: form.facilityName.trim() || null,
      facility_location: form.facilityLocation.trim() || null,
      care_area: form.careArea.trim() || null,
      room_number: form.roomNumber.trim() || null,
      bed_position: form.bedPosition.trim() || null,
      admission_date: form.admissionDateStationary.trim() || form.admissionDate || null,
      resident_status: form.residentStatus.trim() || null,
      room_status: form.roomStatus.trim() || null,
      primary_nurse: form.primaryNurse.trim() || null,
      area_manager: form.areaManager.trim() || null,
      cost_form: form.costForm.trim() || null,
      meal_notes: form.mealNotes.trim() || null,
      daily_structure: form.dailyStructure.trim() || null,
    };

    const { data: existingStationary } = await fromUnknownTable(supabase, 'client_stationary_details')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .maybeSingle();

    if (existingStationary && typeof existingStationary === 'object' && 'id' in existingStationary) {
      const { error } = await fromUnknownTable(supabase, 'client_stationary_details')
        .update(stationaryPayload)
        .eq('id', String((existingStationary as { id: string }).id))
        .eq('tenant_id', tenantId);
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
    } else {
      const { error } = await fromUnknownTable(supabase, 'client_stationary_details').insert({
        tenant_id: tenantId,
        client_id: clientId,
        ...stationaryPayload,
      });
      if (error) return { ok: false, error: toGermanSupabaseError(error) };
    }
  }

  const { error: timelineError } = await fromUnknownTable(supabase, 'client_timeline_events').insert({
    tenant_id: tenantId,
    client_id: clientId,
    event_type: 'sonstige',
    icon: '✏️',
    title: 'Stammdaten aktualisiert',
    subtitle: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
    status: 'abgeschlossen',
    actor_name: actorProfileId ?? null,
    is_internal: false,
    metadata: { source: 'intake_edit' },
  });
  if (timelineError) return { ok: false, error: toGermanSupabaseError(timelineError) };

  await syncClientCareEntitlementFromLegacy(tenantId, clientId, { regenerateAccounts: true });

  return { ok: true, data: undefined };
}
