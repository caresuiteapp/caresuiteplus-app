// Generated native presentation from src/lib/pflege/medicationCreateReceipt.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { RoleKey } from '@/types';
import type { CreateMedicationInput } from './medicationLiveService';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { getSupabaseClient } from "../supabase/client.ts";
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { validEventInstant } from './medicationAdministrationDomain';
import { woundUuid } from './woundCareDomain';
type OwnAttempt = {
    tenantId: string;
    profileId: string;
    clientId: string;
    id: string;
    role: RoleKey;
    input: CreateMedicationInput;
};
type Row = Record<string, unknown>;
/** Match only the explicit returned native ID. Field equality corroborates this particular write; it never discovers an ID or establishes clinical approval. */
export function assertMedicationCreateReceipt(raw: unknown, attempt: OwnAttempt): Row {
    if (!woundUuid(attempt.id) || !woundUuid(attempt.tenantId) || !woundUuid(attempt.profileId) || !woundUuid(attempt.clientId)
        || typeof attempt.role !== 'string' || !attempt.role.trim() || !raw || typeof raw !== 'object' || Array.isArray(raw))
        throw Error('Der eigene native Anlagenachweis ist ungültig.');
    const input = attempt.input, row = raw as Row;
    if (input.clientId !== attempt.clientId || typeof input.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)
        || !validEventInstant(`${input.startDate}T00:00:00Z`))
        throw Error('Der ursprüngliche Anlageninhalt ist nicht eindeutig.');
    const expected: Row = {
        id: attempt.id, tenant_id: attempt.tenantId, client_id: attempt.clientId,
        name: input.name.trim(), active_ingredient: input.activeIngredient?.trim() || null,
        strength: input.strength?.trim() || null, form: input.form?.trim() || null, dosage: input.dosage?.trim() || null,
        schedule: input.schedule?.trim() || null, route: input.route?.trim() || null, prescribed_by: input.prescribedBy?.trim() || null,
        indication: input.indication?.trim() || null, notes: input.notes?.trim() || null, start_date: input.startDate,
        morning_dose: input.morningDose?.trim() || null, noon_dose: input.noonDose?.trim() || null,
        evening_dose: input.eveningDose?.trim() || null, night_dose: input.nightDose?.trim() || null,
        is_prn: input.isPrn, prn_reason: input.prnReason?.trim() || null, is_high_alert: input.isHighAlert,
        is_controlled_substance: input.isControlledSubstance, intensive_care_relevant: input.intensiveCareRelevant,
        infusion_rate: input.infusionRate?.trim() || null, dilution: input.dilution?.trim() || null, pump_required: input.pumpRequired,
        status: 'active', created_by: attempt.profileId, updated_by: attempt.profileId,
    };
    if (Object.keys(expected).some(key => !Object.hasOwn(row, key) || row[key] !== expected[key])
        || typeof row.created_at !== 'string' || typeof row.updated_at !== 'string'
        || !validEventInstant(row.created_at) || !validEventInstant(row.updated_at)) {
        throw Error('Die native Verordnung entspricht nicht vollständig dem ursprünglichen eigenen Anlagenauftrag.');
    }
    return JSON.parse(JSON.stringify(row)) as Row;
}
/** Private Web-only read through existing SDK facilities; caller supplies fresh native/context/form/read guards around the awaited transport. */
export async function readMedicationCreateReceipt(attempt: OwnAttempt, isCurrent: () => boolean): Promise<Row> {
    if (!isCurrent() || !woundUuid(attempt.id) || !woundUuid(attempt.tenantId) || !woundUuid(attempt.profileId) || !woundUuid(attempt.clientId)
        || typeof attempt.role !== 'string' || !attempt.role.trim())
        throw Error('Der aktuelle eigene Anlagenbezug fehlt.');
    const denied = enforcePermission(attempt.role, 'pflege.medications.view') ?? guardServiceTenant(attempt.tenantId);
    if (denied)
        throw Error(denied.error);
    const client = getSupabaseClient();
    if (!client || getServiceMode() !== 'supabase')
        throw Error('Der Anlagenachweis ist nicht verfügbar.');
    const { data, error } = await withServiceQueryTimeout(Promise.resolve(fromUnknownTable(client, 'medications').select('*')
        .eq('tenant_id', attempt.tenantId).eq('id', attempt.id).maybeSingle()), 'Anlagenachweis');
    if (!isCurrent())
        throw Error('Der eigene Anlagenbezug wurde geändert.');
    if (error || !data)
        throw Error('Der vollständige native Anlagenachweis ist nicht verfügbar.');
    return assertMedicationCreateReceipt(data, attempt);
}
