import type { ServiceResult } from '@/types';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import {
  resolvePrimaryCostBearerName,
  resolvePrimaryCostBearerReference,
} from '@/lib/clients/clientIntakeCostBearerConfig';
import { resolveIntakeBillingProfileType } from '@/lib/clients/clientIntakeBilling';

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

  if (form.emergencyContactName.trim() || form.emergencyContactPhone.trim()) {
    const { error } = await fromUnknownTable(supabase, 'client_contacts').insert({
      tenant_id: tenantId,
      client_id: clientId,
      name: form.emergencyContactName.trim() || 'Notfallkontakt',
      first_name: form.emergencyContactName.trim().split(' ')[0] ?? form.emergencyContactName.trim(),
      last_name: form.emergencyContactName.trim().split(' ').slice(1).join(' ') || '',
      relationship: 'notfallkontakt',
      phone: form.emergencyContactPhone.trim() || null,
      email: null,
      is_emergency: true,
    });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
  }

  const hasAmbulatoryData =
    form.homeAccess ||
    form.keyStatus ||
    form.familyDoctor.trim() ||
    form.accessNotes.trim() ||
    form.pets;

  if (hasAmbulatoryData) {
    const { error } = await fromUnknownTable(supabase, 'client_ambulatory_details').insert({
      tenant_id: tenantId,
      client_id: clientId,
      home_access: form.homeAccess || null,
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
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
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
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
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

  return { ok: true, data: undefined };
}
