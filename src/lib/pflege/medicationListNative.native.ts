// Generated native presentation from src/lib/pflege/medicationListNative.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { MedicationListItem } from '@/types/modules/pflege';
import { validEventInstant } from './medicationAdministrationDomain.ts';
import { woundUuid } from './woundCareDomain.ts';
type NativeRow = Record<string, unknown>;
export type NativeMedicationListItem = MedicationListItem & {
    nativeOriginal: NativeRow;
};
const nullableText = ['active_ingredient', 'strength', 'form', 'dosage', 'schedule', 'prescribed_by', 'morning_dose', 'noon_dose', 'evening_dose', 'night_dose', 'prn_reason', 'indication', 'notes', 'interaction_notes', 'side_effect_notes', 'storage_notes', 'route', 'infusion_rate', 'dilution'] as const;
const nativeFlags = ['is_prn', 'is_high_alert', 'is_controlled_substance', 'intensive_care_relevant', 'pump_required'] as const;
const object = (value: unknown): value is NativeRow => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;
const validDate = (value: unknown): boolean => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && validEventInstant(`${value}T00:00:00Z`);
/** Native read grammar only; raw PostgreSQL metadata remains unchanged. This never proves an event or a current clinical head. */
export function validMedicationListNativeTime(value: unknown): value is string {
    return typeof value === 'string' && validEventInstant(value.replace(' ', 'T'));
}
function readClientRelation(value: unknown, index: number): NativeRow | null {
    const invalid = () => Error(`Medikationsliste: native Klientenrelation in Zeile ${index + 1} ist ungültig.`);
    if (value === null)
        return null;
    let relation = value;
    if (Array.isArray(value)) {
        if (value.length > 1 || (value.length === 1 && !Object.hasOwn(value, 0)))
            throw invalid();
        relation = value.length ? value[0] : null;
    }
    if (relation === null)
        return null;
    if (!object(relation) || ['first_name', 'last_name', 'full_name'].some(key => Object.hasOwn(relation, key) && relation[key] !== null && typeof relation[key] !== 'string'))
        throw invalid();
    return relation;
}
/** Check every supplied native row before projecting. This is one returned read pool, never a claim about an exhaustive roster or full clinical history. */
export function decodeMedicationListNative(input: unknown, tenantId: string): NativeMedicationListItem[] {
    if (!woundUuid(tenantId) || !Array.isArray(input))
        throw Error('Medikationsliste: der tatsächlich gelieferte native Bestand fehlt oder ist ungültig.');
    const ids = new Set<string>(), rows: Array<{
        raw: NativeRow;
        client: NativeRow | null;
    }> = [];
    for (let i = 0; i < input.length; i++) {
        const raw = input[i];
        const invalid = (field: string) => Error(`Medikationsliste: native Angabe ${field} in Zeile ${i + 1} fehlt, ist ungültig oder nicht eindeutig. Bitte neu laden.`);
        if (!Object.hasOwn(input, i) || !object(raw))
            throw invalid('Datensatz');
        for (const key of ['id', 'tenant_id', 'client_id', 'name', 'status', 'updated_at', ...nativeFlags])
            if (!Object.hasOwn(raw, key))
                throw invalid(key);
        if (!woundUuid(raw.id) || ids.has(raw.id.toLowerCase()))
            throw invalid('id');
        if (raw.tenant_id !== tenantId || !woundUuid(raw.client_id))
            throw invalid('Mandant/Pflegefall');
        if (!['active', 'paused', 'stopped', 'archived'].includes(raw.status as string))
            throw invalid('status');
        if (!validMedicationListNativeTime(raw.updated_at))
            throw invalid('updated_at');
        if (typeof raw.name !== 'string')
            throw invalid('name');
        for (const key of nativeFlags)
            if (typeof raw[key] !== 'boolean')
                throw invalid(key);
        for (const key of nullableText)
            if (!Object.hasOwn(raw, key) || !(raw[key] === null || typeof raw[key] === 'string'))
                throw invalid(key);
        for (const key of ['start_date', 'end_date'])
            if (!Object.hasOwn(raw, key) || !(raw[key] === null || validDate(raw[key])))
                throw invalid(key);
        if (!Object.hasOwn(raw, 'clients'))
            throw invalid('clients');
        const client = readClientRelation(raw.clients, i);
        ids.add(raw.id.toLowerCase());
        rows.push({ raw, client });
    }
    return rows.map(({ raw, client }) => ({
        id: raw.id as string, tenantId: raw.tenant_id as string, clientId: raw.client_id as string,
        // Missing descriptive strings are explicit display labels; nativeOriginal retains their exact returned null/blank values.
        clientName: text(client?.full_name) ?? ([text(client?.first_name), text(client?.last_name)].filter(Boolean).join(' ') || 'Klient:in'),
        medicationName: text(raw.name) ?? 'Unbenanntes Medikament', activeIngredient: raw.active_ingredient as string | null,
        strength: raw.strength as string | null, form: raw.form as string | null,
        dosage: text(raw.dosage) ?? 'Nicht angegeben', schedule: text(raw.schedule) ?? 'Nicht angegeben',
        route: text(raw.route) ?? 'Nicht angegeben', prescribedBy: text(raw.prescribed_by) ?? 'Nicht angegeben',
        status: raw.status as MedicationListItem['status'], updatedAt: raw.updated_at as string,
        isPrn: raw.is_prn as boolean, isHighAlert: raw.is_high_alert as boolean,
        isControlledSubstance: raw.is_controlled_substance as boolean, intensiveCareRelevant: raw.intensive_care_relevant as boolean,
        startDate: raw.start_date as string | null, endDate: raw.end_date as string | null,
        nativeOriginal: structuredClone(raw),
    }));
}
