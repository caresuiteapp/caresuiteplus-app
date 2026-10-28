// Generated native presentation from src/lib/pflege/treatmentTimeDisplay.web.ts. Update through scripts/port-native-workspaces.mjs.
import { woundInstant } from './woundCareDomain.ts';
import { medicationTimeDisplay, type MedicationTimeDisplay } from "./medicationTimeDisplay.native.ts";
function invalidOriginal(value: unknown): MedicationTimeDisplay {
    const raw = typeof value === 'string' ? value : null;
    return { state: 'invalid', raw, display: raw === null ? 'Ungültige Originalzeit – nicht bestätigt' : `Ungültige Originalzeit – nicht bestätigt · Original: ${JSON.stringify(raw)}` };
}
/** A documented event time is not proof that the documented action was performed. */
export function treatmentEventTimeDisplay(value: unknown): MedicationTimeDisplay {
    if (value === null || value === undefined || value === '')
        return medicationTimeDisplay(value as string | null);
    if (typeof value !== 'string' || woundInstant(value) === null)
        return invalidOriginal(value);
    return medicationTimeDisplay(value);
}
/** Read historical recording metadata separately; never use it as an event fallback. */
export function treatmentRecordedTimeDisplay(value: unknown): MedicationTimeDisplay {
    if (value !== null && value !== undefined && typeof value !== 'string')
        return invalidOriginal(value);
    return medicationTimeDisplay(value as string | null);
}
