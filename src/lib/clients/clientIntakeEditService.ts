import type { RoleKey, ServiceResult } from '@/types';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { fetchClientEditData } from '@/lib/clients/clientEditService';
import { mapClientEditLoadToIntakeForm } from '@/lib/clients/clientIntakeFormMappers';
import { mergeIntakeFormWithDefaults } from '@/lib/clients/clientIntakeDraftStorage';
import { isDemoClientBackend } from '@/lib/clients/clientBackend';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { parseHomeAccessStoredValue } from '@/lib/clients/clientIntakeHomeAccess';

async function fetchIntakeSnapshot(
  tenantId: string,
  clientId: string,
): Promise<Partial<ClientIntakeFormData>> {
  const supabase = getSupabaseClient();
  if (!supabase) return {};

  const [clientResult, supportResult, ambulatoryResult, stationaryResult, insuranceResult] =
    await Promise.all([
      fromUnknownTable(supabase, 'clients')
        .select('admission_date, service_start, birth_place, nationality, language, marital_status, housing_form, special_notes')
        .eq('tenant_id', tenantId)
        .eq('id', clientId)
        .maybeSingle(),
      fromUnknownTable(supabase, 'client_support_preferences')
        .select('support_wishes, preferred_times, excluded_times, mobility, orientation, communication')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .maybeSingle(),
      fromUnknownTable(supabase, 'client_ambulatory_details')
        .select('home_access, key_status, key_number, key_safe_code, door_code, bell_name, floor, elevator_available, parking_notes, access_notes, hazard_notes, pets, smoker_household, aids_on_site, hygiene_notes, infection_notes, family_doctor')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .maybeSingle(),
      fromUnknownTable(supabase, 'client_stationary_details')
        .select('facility_name, facility_location, care_area, room_number, bed_position, admission_date, resident_status, room_status, primary_nurse, area_manager, cost_form, meal_notes, daily_structure')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .maybeSingle(),
      fromUnknownTable(supabase, 'client_insurance_profiles')
        .select('care_level, care_level_status, care_level_valid_from, care_fund_name, health_insurance, cost_bearer_ik, insurance_number, self_pay')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .eq('is_primary', true)
        .maybeSingle(),
    ]);

  const client = (clientResult.data ?? {}) as Record<string, unknown>;
  const support = (supportResult.data ?? {}) as Record<string, unknown>;
  const ambulatory = (ambulatoryResult.data ?? {}) as Record<string, unknown>;
  const stationary = (stationaryResult.data ?? {}) as Record<string, unknown>;
  const insurance = (insuranceResult.data ?? {}) as Record<string, unknown>;
  const text = (row: Record<string, unknown>, key: string) =>
    typeof row[key] === 'string' ? row[key] as string : '';
  const strings = (row: Record<string, unknown>, key: string) =>
    Array.isArray(row[key]) ? (row[key] as unknown[]).filter((value): value is string => typeof value === 'string') : [];

  return {
    admissionDate: text(client, 'admission_date'),
    serviceStart: text(client, 'service_start'),
    birthPlace: text(client, 'birth_place'),
    nationality: text(client, 'nationality') || 'DE',
    language: text(client, 'language') || 'de',
    maritalStatus: text(client, 'marital_status'),
    housingForm: text(client, 'housing_form'),
    specialNotes: text(client, 'special_notes'),
    supportWishes: strings(support, 'support_wishes'),
    preferredTimes: strings(support, 'preferred_times'),
    excludedTimes: strings(support, 'excluded_times'),
    mobility: text(support, 'mobility'),
    orientation: text(support, 'orientation'),
    communication: text(support, 'communication'),
    homeAccess: parseHomeAccessStoredValue(text(ambulatory, 'home_access')),
    keyStatus: text(ambulatory, 'key_status'),
    keyNumber: text(ambulatory, 'key_number'),
    keySafeCode: text(ambulatory, 'key_safe_code'),
    doorCode: text(ambulatory, 'door_code'),
    bellName: text(ambulatory, 'bell_name'),
    floor: text(ambulatory, 'floor'),
    elevatorAvailable: ambulatory.elevator_available === true,
    parkingNotes: text(ambulatory, 'parking_notes'),
    accessNotes: text(ambulatory, 'access_notes'),
    hazardNotes: text(ambulatory, 'hazard_notes'),
    pets: text(ambulatory, 'pets'),
    smokerHousehold: ambulatory.smoker_household === true,
    aidsOnSite: text(ambulatory, 'aids_on_site'),
    hygieneNotes: text(ambulatory, 'hygiene_notes'),
    infectionNotes: text(ambulatory, 'infection_notes'),
    familyDoctor: text(ambulatory, 'family_doctor'),
    facilityName: text(stationary, 'facility_name'),
    facilityLocation: text(stationary, 'facility_location'),
    careArea: text(stationary, 'care_area'),
    roomNumber: text(stationary, 'room_number'),
    bedPosition: text(stationary, 'bed_position'),
    admissionDateStationary: text(stationary, 'admission_date'),
    residentStatus: text(stationary, 'resident_status'),
    roomStatus: text(stationary, 'room_status'),
    primaryNurse: text(stationary, 'primary_nurse'),
    areaManager: text(stationary, 'area_manager'),
    costForm: text(stationary, 'cost_form'),
    mealNotes: text(stationary, 'meal_notes'),
    dailyStructure: text(stationary, 'daily_structure'),
    careLevel: text(insurance, 'care_level'),
    careLevelStatus: text(insurance, 'care_level_status'),
    careLevelValidFrom: text(insurance, 'care_level_valid_from'),
    careFundName: text(insurance, 'care_fund_name'),
    healthInsurance: text(insurance, 'health_insurance'),
    costBearerIk: text(insurance, 'cost_bearer_ik'),
    insuranceNumber: text(insurance, 'insurance_number'),
    selfPay: insurance.self_pay === true,
  };
}

/** Loads an existing client into intake wizard form defaults for edit mode. */
export async function fetchClientIntakeEditData(
  clientId: string,
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<ClientIntakeFormData>> {
  if (isDemoClientBackend()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDemoClientIntakeRecord } = require('@/data/demo/clients/intakeRecords');
    const demoRecord = getDemoClientIntakeRecord(clientId);
    if (demoRecord) {
      return { ok: true, data: mergeIntakeFormWithDefaults(demoRecord) };
    }
  }

  const editResult = await fetchClientEditData(clientId, tenantId, actorRoleKey);
  if (!editResult.ok) return editResult;

  const intakeSnapshot = isDemoClientBackend()
    ? {}
    : await fetchIntakeSnapshot(tenantId, clientId);

  return {
    ok: true,
    data: mapClientEditLoadToIntakeForm({
      ...editResult.data,
      ambulatoryHomeAccess: intakeSnapshot.homeAccess?.join(','),
      intakeSnapshot,
    }),
  };
}
