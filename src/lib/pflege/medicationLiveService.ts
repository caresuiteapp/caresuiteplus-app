import type { RoleKey, ServiceResult } from '@/types';
import type {
  MedicationAdministration,
  MedicationAdministrationStatus,
  MedicationClientOption,
  MedicationDetail,
  MedicationListItem,
  MedicationStatus,
  MedicationWitnessOption,
} from '@/types/modules/pflege';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

type UnknownRow = Record<string, unknown>;

const MEDICATION_SELECT = [
  'id', 'tenant_id', 'client_id', 'name', 'active_ingredient', 'strength', 'form',
  'dosage', 'schedule', 'status', 'is_prn', 'prescribed_by', 'start_date', 'end_date',
  'morning_dose', 'noon_dose', 'evening_dose', 'night_dose', 'prn_reason', 'indication',
  'notes', 'interaction_notes', 'side_effect_notes', 'storage_notes', 'updated_at',
  'route', 'is_high_alert', 'is_controlled_substance', 'intensive_care_relevant',
  'infusion_rate', 'dilution', 'pump_required',
  'clients!medications_client_id_fkey(first_name,last_name,full_name,allergies)',
].join(',');

function unavailable<T>(): ServiceResult<T> {
  return { ok: false, error: 'Die produktive Medikationsdatenbank ist nicht verbunden.' };
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

function status(value: unknown): MedicationStatus {
  return value === 'paused' || value === 'stopped' || value === 'archived' ? value : 'active';
}

function clientName(row: UnknownRow): string {
  const relation = (Array.isArray(row.clients) ? row.clients[0] : row.clients) as UnknownRow | null;
  return text(relation?.full_name)
    ?? ([text(relation?.first_name), text(relation?.last_name)].filter(Boolean).join(' ') || 'Klient:in');
}

function mapMedication(row: UnknownRow): MedicationListItem {
  const route = text(row.route) ?? text(row.form) ?? 'Nicht angegeben';
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    clientId: String(row.client_id),
    clientName: clientName(row),
    medicationName: text(row.name) ?? 'Unbenanntes Medikament',
    activeIngredient: text(row.active_ingredient),
    strength: text(row.strength),
    form: text(row.form),
    dosage: text(row.dosage) ?? 'Nicht angegeben',
    schedule: text(row.schedule) ?? 'Individuell',
    route,
    status: status(row.status),
    isPrn: bool(row.is_prn),
    isHighAlert: bool(row.is_high_alert),
    isControlledSubstance: bool(row.is_controlled_substance),
    intensiveCareRelevant: bool(row.intensive_care_relevant),
    prescribedBy: text(row.prescribed_by) ?? 'Nicht angegeben',
    startDate: text(row.start_date),
    endDate: text(row.end_date),
    updatedAt: text(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function mapAdministration(row: UnknownRow): MedicationAdministration {
  const actor = (Array.isArray(row.administered_by_profile) ? row.administered_by_profile[0] : row.administered_by_profile) as UnknownRow | null;
  const witness = (Array.isArray(row.witness_profile) ? row.witness_profile[0] : row.witness_profile) as UnknownRow | null;
  const name = (profile: UnknownRow | null) => profile
    ? text(profile.full_name) ?? ([text(profile.first_name), text(profile.last_name)].filter(Boolean).join(' ') || null)
    : null;
  return {
    id: String(row.id), tenantId: String(row.tenant_id), medicationId: String(row.medication_id),
    clientId: String(row.client_id), scheduledAt: text(row.scheduled_at), administeredAt: text(row.administered_at),
    status: (text(row.status) ?? 'scheduled') as MedicationAdministrationStatus,
    administeredDose: text(row.administered_dose), route: text(row.route), deviationReason: text(row.deviation_reason),
    prnReason: text(row.prn_reason), effectEvaluation: text(row.effect_evaluation),
    painScoreBefore: typeof row.pain_score_before === 'number' ? row.pain_score_before : null,
    painScoreAfter: typeof row.pain_score_after === 'number' ? row.pain_score_after : null,
    vitalContext: row.vital_context && typeof row.vital_context === 'object' ? row.vital_context as Record<string, unknown> : {},
    notes: text(row.notes), administeredByName: name(actor), witnessName: name(witness),
    createdAt: text(row.created_at) ?? new Date(0).toISOString(),
  };
}

function guard<T>(
  tenantId: string,
  role: RoleKey | null | undefined,
  permission: 'pflege.medications.view' | 'pflege.medications.manage' | 'pflege.medications.administer' = 'pflege.medications.view',
): ServiceResult<T> | null {
  const denied = enforcePermission<T>(role, permission);
  if (denied) return denied;
  return guardServiceTenant(tenantId);
}

export async function fetchLiveMedicationList(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<MedicationListItem[]>> {
  const blocked = guard<MedicationListItem[]>(tenantId, role); if (blocked) return blocked;
  if (getServiceMode() !== 'supabase') return unavailable();
  const supabase = getSupabaseClient(); if (!supabase) return unavailable();
  try {
    const { data, error } = await withServiceQueryTimeout(Promise.resolve(fromUnknownTable(supabase, 'medications')
      .select(MEDICATION_SELECT).eq('tenant_id', tenantId).order('updated_at', { ascending: false })), 'Medikationsplan');
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return { ok: true, data: ((data ?? []) as unknown as UnknownRow[]).map(mapMedication) };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Medikationsplan konnte nicht geladen werden.' }; }
}

export async function fetchLiveMedicationDetail(id: string, tenantId: string, role?: RoleKey | null): Promise<ServiceResult<MedicationDetail>> {
  const blocked = guard<MedicationDetail>(tenantId, role); if (blocked) return blocked;
  if (getServiceMode() !== 'supabase') return unavailable();
  const supabase = getSupabaseClient(); if (!supabase) return unavailable();
  try {
    const [medicationResult, administrationResult] = await Promise.all([
      withServiceQueryTimeout(Promise.resolve(fromUnknownTable(supabase, 'medications').select(MEDICATION_SELECT).eq('tenant_id', tenantId).eq('id', id).maybeSingle()), 'Verordnung'),
      withServiceQueryTimeout(Promise.resolve(fromUnknownTable(supabase, 'medication_administrations')
        .select('*,administered_by_profile:profiles!medication_administrations_administered_by_fkey(first_name,last_name,full_name),witness_profile:profiles!medication_administrations_witnessed_by_fkey(first_name,last_name,full_name)')
        .eq('tenant_id', tenantId).eq('medication_id', id).order('created_at', { ascending: false }).limit(100)), 'Medikamentengaben'),
    ]);
    if (medicationResult.error) return { ok: false, error: toGermanSupabaseError(medicationResult.error) };
    if (!medicationResult.data) return { ok: false, error: 'Verordnung nicht gefunden.' };
    if (administrationResult.error) return { ok: false, error: toGermanSupabaseError(administrationResult.error) };
    const row = medicationResult.data as unknown as UnknownRow;
    const client = (Array.isArray(row.clients) ? row.clients[0] : row.clients) as UnknownRow | null;
    const administrations = ((administrationResult.data ?? []) as UnknownRow[]).map(mapAdministration);
    const base = mapMedication(row);
    return { ok: true, data: {
      ...base, clientAllergies: text(client?.allergies), indication: text(row.indication), morningDose: text(row.morning_dose), noonDose: text(row.noon_dose),
      eveningDose: text(row.evening_dose), nightDose: text(row.night_dose), prnReason: text(row.prn_reason),
      instructions: text(row.notes) ?? 'Keine besonderen Einnahmehinweise hinterlegt.',
      interactionNotes: text(row.interaction_notes), sideEffectNotes: text(row.side_effect_notes), storageNotes: text(row.storage_notes),
      infusionRate: text(row.infusion_rate), dilution: text(row.dilution), pumpRequired: bool(row.pump_required),
      lastAdministeredAt: administrations.find((entry) => entry.status === 'administered')?.administeredAt ?? null,
      administrations,
    } };
  } catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Verordnung konnte nicht geladen werden.' }; }
}

export async function fetchMedicationClientOptions(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<MedicationClientOption[]>> {
  const blocked = guard<MedicationClientOption[]>(tenantId, role, 'pflege.medications.manage'); if (blocked) return blocked;
  if (getServiceMode() !== 'supabase') return unavailable();
  const supabase = getSupabaseClient(); if (!supabase) return unavailable();
  const { data, error } = await fromUnknownTable(supabase, 'clients').select('id,first_name,last_name,full_name,allergies,special_notes')
    .eq('tenant_id', tenantId).is('deleted_at', null).eq('status', 'active').order('last_name');
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: ((data ?? []) as UnknownRow[]).map((row) => ({ id: String(row.id), label: text(row.full_name) ?? [text(row.first_name), text(row.last_name)].filter(Boolean).join(' '), allergies: text(row.allergies), specialNotes: text(row.special_notes) })) };
}

export async function fetchMedicationWitnessOptions(tenantId: string, actorProfileId: string | null, role?: RoleKey | null): Promise<ServiceResult<MedicationWitnessOption[]>> {
  const blocked = guard<MedicationWitnessOption[]>(tenantId, role, 'pflege.medications.administer'); if (blocked) return blocked;
  if (getServiceMode() !== 'supabase') return unavailable();
  const supabase = getSupabaseClient(); if (!supabase) return unavailable();
  const rpc = supabase as unknown as { rpc: (name: string) => Promise<{ data: unknown; error: unknown }> };
  const { data, error } = await rpc.rpc('medication_witness_options');
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: ((data ?? []) as UnknownRow[]).filter((row) => String(row.id) !== actorProfileId).map((row) => ({ id: String(row.id), label: text(row.label) ?? 'Pflegefachkraft' })) };
}

export type CreateMedicationInput = {
  clientId: string; name: string; activeIngredient?: string; strength?: string; form?: string; dosage?: string;
  schedule?: string; route?: string; prescribedBy?: string; indication?: string; notes?: string; startDate?: string;
  morningDose?: string; noonDose?: string; eveningDose?: string; nightDose?: string; isPrn: boolean; prnReason?: string;
  isHighAlert: boolean; isControlledSubstance: boolean; intensiveCareRelevant: boolean; infusionRate?: string; dilution?: string; pumpRequired: boolean;
};

export async function createLiveMedication(tenantId: string, actorProfileId: string | null, input: CreateMedicationInput, role?: RoleKey | null): Promise<ServiceResult<{ id: string }>> {
  const blocked = guard<{ id: string }>(tenantId, role, 'pflege.medications.manage'); if (blocked) return blocked;
  if (!actorProfileId) return { ok: false, error: 'Das angemeldete Benutzerprofil konnte nicht ermittelt werden.' };
  if (!input.clientId || !input.name.trim()) return { ok: false, error: 'Klient:in und Präparat sind erforderlich.' };
  if (input.isPrn && !input.prnReason?.trim()) return { ok: false, error: 'Für Bedarfsmedikation ist eine eindeutige Indikation erforderlich.' };
  if (input.pumpRequired && !input.infusionRate?.trim()) return { ok: false, error: 'Bei Pumpengabe ist die Laufgeschwindigkeit erforderlich.' };
  if (getServiceMode() !== 'supabase') return unavailable();
  const supabase = getSupabaseClient(); if (!supabase) return unavailable();
  const payload = {
    tenant_id: tenantId, client_id: input.clientId, name: input.name.trim(), active_ingredient: input.activeIngredient?.trim() || null,
    strength: input.strength?.trim() || null, form: input.form?.trim() || null, dosage: input.dosage?.trim() || null,
    schedule: input.schedule?.trim() || null, route: input.route?.trim() || null, prescribed_by: input.prescribedBy?.trim() || null,
    indication: input.indication?.trim() || null, notes: input.notes?.trim() || null, start_date: input.startDate || new Date().toISOString().slice(0, 10),
    morning_dose: input.morningDose?.trim() || null, noon_dose: input.noonDose?.trim() || null, evening_dose: input.eveningDose?.trim() || null,
    night_dose: input.nightDose?.trim() || null, is_prn: input.isPrn, prn_reason: input.prnReason?.trim() || null,
    is_high_alert: input.isHighAlert, is_controlled_substance: input.isControlledSubstance, intensive_care_relevant: input.intensiveCareRelevant,
    infusion_rate: input.infusionRate?.trim() || null, dilution: input.dilution?.trim() || null, pump_required: input.pumpRequired,
    status: 'active', created_by: actorProfileId, updated_by: actorProfileId,
  };
  const { data, error } = await fromUnknownTable(supabase, 'medications').insert(payload).select('id').single();
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { id: String((data as UnknownRow).id) } };
}

export async function setLiveMedicationStatus(id: string, tenantId: string, nextStatus: MedicationStatus, actorProfileId: string | null, role?: RoleKey | null): Promise<ServiceResult<{ status: MedicationStatus }>> {
  const blocked = guard<{ status: MedicationStatus }>(tenantId, role, 'pflege.medications.manage'); if (blocked) return blocked;
  if (!actorProfileId) return { ok: false, error: 'Das angemeldete Benutzerprofil konnte nicht ermittelt werden.' };
  if (getServiceMode() !== 'supabase') return unavailable();
  const supabase = getSupabaseClient(); if (!supabase) return unavailable();
  const { error } = await fromUnknownTable(supabase, 'medications').update({ status: nextStatus, updated_by: actorProfileId, end_date: nextStatus === 'stopped' ? new Date().toISOString().slice(0, 10) : undefined }).eq('tenant_id', tenantId).eq('id', id);
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { status: nextStatus } };
}

export type RecordAdministrationInput = { status: Exclude<MedicationAdministrationStatus, 'scheduled'>; dose?: string; route?: string; deviationReason?: string; prnReason?: string; effectEvaluation?: string; painScoreBefore?: number | null; painScoreAfter?: number | null; notes?: string; witnessProfileId?: string | null; vitalContext?: Record<string, unknown> };

export async function recordMedicationAdministration(medication: MedicationDetail, tenantId: string, actorProfileId: string | null, input: RecordAdministrationInput, role?: RoleKey | null): Promise<ServiceResult<{ id: string }>> {
  const blocked = guard<{ id: string }>(tenantId, role, 'pflege.medications.administer'); if (blocked) return blocked;
  if (!actorProfileId) return { ok: false, error: 'Das angemeldete Benutzerprofil konnte nicht ermittelt werden.' };
  if (medication.status !== 'active') return { ok: false, error: 'Nur aktive Verordnungen dürfen dokumentiert werden.' };
  if (input.status !== 'administered' && !input.deviationReason?.trim()) return { ok: false, error: 'Bei nicht erfolgter oder abweichender Gabe ist eine Begründung erforderlich.' };
  if (medication.isPrn && input.status === 'administered' && !input.prnReason?.trim()) return { ok: false, error: 'Die Indikation der Bedarfsmedikation muss vor der Gabe dokumentiert werden.' };
  if (medication.isControlledSubstance && input.status === 'administered' && !input.witnessProfileId) return { ok: false, error: 'Für BtM-Gaben ist eine Gegenkontrolle erforderlich.' };
  if (getServiceMode() !== 'supabase') return unavailable();
  const supabase = getSupabaseClient(); if (!supabase) return unavailable();
  const { data, error } = await fromUnknownTable(supabase, 'medication_administrations').insert({
    tenant_id: tenantId, medication_id: medication.id, client_id: medication.clientId, status: input.status,
    administered_dose: input.dose?.trim() || medication.dosage,
    route: input.route?.trim() || medication.route, deviation_reason: input.deviationReason?.trim() || null,
    prn_reason: input.prnReason?.trim() || null, effect_evaluation: input.effectEvaluation?.trim() || null,
    pain_score_before: input.painScoreBefore ?? null, pain_score_after: input.painScoreAfter ?? null,
    vital_context: input.vitalContext ?? {}, notes: input.notes?.trim() || null,
    administered_by: actorProfileId, witnessed_by: input.witnessProfileId ?? null,
  }).select('id,administered_at,administered_by').single();
  if (error) return { ok: false, error: toGermanSupabaseError(error) };
  return { ok: true, data: { id: String((data as UnknownRow).id) } };
}
