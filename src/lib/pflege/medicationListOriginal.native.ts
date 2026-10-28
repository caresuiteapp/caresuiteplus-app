// Generated native presentation from src/lib/pflege/medicationListOriginal.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { MedicationListItem } from '@/types/modules/pflege';
import { woundInstant, woundUuid } from './woundCareDomain.ts';
/** Validate every supplied list projection. This does not prove an exhaustive roster or original clinical history. */
export function captureMedicationListOriginal(input: unknown, tenantId: string): MedicationListItem[] {
    if (!woundUuid(tenantId) || !Array.isArray(input))
        throw Error('Der aktuelle Medikationslistenbestand ist nicht bestätigt.');
    const ids = new Set<string>();
    for (let i = 0; i < input.length; i++) {
        const item = input[i];
        if (!item || typeof item !== 'object' || Array.isArray(item) || !woundUuid(item.id) || ids.has(item.id.toLowerCase())
            || item.tenantId !== tenantId || !woundUuid(item.clientId) || (typeof item.updatedAt !== 'string' || woundInstant(item.updatedAt.replace(' ', 'T')) === null)
            || !['active', 'paused', 'stopped', 'archived'].includes(item.status)
            || ['clientName', 'medicationName', 'dosage', 'schedule', 'route', 'prescribedBy'].some(key => typeof item[key] !== 'string' || !item[key].trim())
            || ['activeIngredient', 'strength', 'form', 'startDate', 'endDate'].some(key => !(item[key] === null || typeof item[key] === 'string'))
            || ['isPrn', 'isHighAlert', 'isControlledSubstance', 'intensiveCareRelevant'].some(key => typeof item[key] !== 'boolean')) {
            throw Error('Die geladene Medikationsliste enthält ungültige, fremde oder doppelte native Listenangaben. Bitte neu laden.');
        }
        ids.add(item.id.toLowerCase());
    }
    return structuredClone(input) as MedicationListItem[];
}
/** Entire retained projection: raw strings and array order matter; object key order does not. */
export function sameMedicationListOriginal(a: unknown, b: unknown): boolean {
    if (Object.is(a, b))
        return true;
    if (Array.isArray(a) || Array.isArray(b)) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
            return false;
    }
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object')
        return false;
    const left = a as Record<string, unknown>, right = b as Record<string, unknown>, keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameMedicationListOriginal(left[key], right[key]));
}
