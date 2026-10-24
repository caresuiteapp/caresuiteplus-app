// Generated native presentation from src/lib/pflege/vitalDetailNativeWrite.web.ts. Update through scripts/port-native-workspaces.mjs.
import { cloneClientNativeOriginal as clone, freezeClientNativeOriginal as freeze } from "../clients/clientRecordNativeOriginal.native.ts";
import { isDefiniteMedicationRejection } from './medicationRequestState.ts';
import { withServiceQueryTimeout } from '../services/queryTimeout';
import { vitalDetailNativeWriteAuthorityWeb, type VitalDetailWriteRuntimeWeb, type VitalDetailPayloadWeb, type VitalDetailOperationWeb } from "./vitalDetailWriteRuntime.native.ts";
import type { MedicationWriteResult } from './medicationAdministrationService';
type Row = Record<string, unknown>;
const outcomes = new WeakMap<object, {
    runtime: VitalDetailWriteRuntimeWeb;
    kind: VitalDetailOperationWeb;
    id: string;
    replay: boolean;
    flight: object | null;
    settled: boolean;
    original: unknown;
}>();
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function isOwnVitalDetailWriteOutcomeWeb(result: unknown, runtime: VitalDetailWriteRuntimeWeb, kind: VitalDetailOperationWeb, id: string, replay: boolean, flight: object | null) { const own = result && typeof result === 'object' ? outcomes.get(result) : null; return !!own && own.runtime === runtime && own.kind === kind && own.id === id && own.replay === replay && own.flight === flight; }
export function isSettledVitalDetailWriteOutcomeWeb(result: unknown, runtime: VitalDetailWriteRuntimeWeb, kind: VitalDetailOperationWeb, id: string, replay: boolean, flight: object) { return isOwnVitalDetailWriteOutcomeWeb(result, runtime, kind, id, replay, flight) && outcomes.get(result as object)?.settled === true; }
export function vitalDetailOwnWriteOriginalWeb(result: unknown, runtime: VitalDetailWriteRuntimeWeb, kind: VitalDetailOperationWeb, id: string, replay: boolean, flight: object) { return isOwnVitalDetailWriteOutcomeWeb(result, runtime, kind, id, replay, flight) ? outcomes.get(result as object)?.original ?? null : null; }
/** Native Manage+View before both first dispatch and original replay; no Shared/SQL contract weakening. */
export async function executeVitalDetailNativeWriteWeb(runtime: VitalDetailWriteRuntimeWeb, kind: VitalDetailOperationWeb, id: string, value: VitalDetailPayloadWeb, replay: boolean, frame: unknown): Promise<MedicationWriteResult> {
    const authority = vitalDetailNativeWriteAuthorityWeb(runtime);
    if (!authority || !['follow_up', 'invalidation'].includes(kind))
        return { ok: false, error: 'Eigener ursprünglicher Messungsauftrag fehlt.' };
    let entered = false, observing = false, flight: object | null = null;
    const outcome = (result: MedicationWriteResult, original: unknown, settled: boolean) => { const own = freeze(result); outcomes.set(own, { runtime, kind, id, replay, flight, settled, original }); authority.settle(kind, id, own, replay, flight); return own; };
    const unknown = (settled: boolean, original: unknown = null) => outcome({ ok: false, error: entered || replay ? 'Die ursprüngliche Speicherbestätigung fehlt. Dieselbe Originalanfrage mit aktuellen eigenen Rechten erneut prüfen.' : 'Ganzen Originalbestand, aktuelle Rechte und Verbindung zuerst prüfen.', uncertain: entered || replay }, original, settled);
    try {
        const payload = authority.beginRequest(kind, id, value, replay, frame);
        flight = authority.flightToken(kind, id);
        if (!flight)
            throw Error('Eigene native Transportphase fehlt.');
        await authority.assertSession(kind, id, payload, frame);
        const sdk = authority.assertRequest(kind, id, payload, frame), rpc = (sdk as unknown as Row).rpc, second = (sdk as unknown as Row).rpc;
        if (typeof rpc !== 'function' || rpc !== second)
            throw Error('Nativer RPCaufruf ist nicht bestätigt.');
        const args = freeze(clone({ request_id: id, payload })), name = kind === 'follow_up' ? 'record_ambulatory_vital_follow_up' : 'invalidate_ambulatory_vital_measurement';
        if (authority.assertRequest(kind, id, payload, frame) !== sdk)
            throw Error('Ursprüngliche native Verbindung fehlt.');
        // An RPC method can itself start eager transport. A later denied Then proves
        // neither nonexecution nor that an original request can be discarded.
        entered = true;
        const query = Reflect.apply(rpc, sdk, [name, args]);
        const then = (query as Row).then, secondThen = (query as Row).then;
        if (typeof then !== 'function' || then !== secondThen)
            throw Error('Nativer Thenaufruf ist nicht bestätigt.');
        const native = new Promise<unknown>((resolve, reject) => { if (authority.assertRequest(kind, id, payload, frame) !== sdk)
            throw Error('Ursprüngliche native Verbindung fehlt.'); observing = true; Reflect.apply(then, query, [resolve, reject]); });
        const completion = native.then(raw => {
            let response: Row | null = null;
            try {
                response = freeze(clone(raw)) as Row;
                if (!response || typeof response !== 'object' || Array.isArray(response) || !Object.hasOwn(response, 'error') || !Object.hasOwn(response, 'status'))
                    throw Error('Ganzes natives Ergebnis fehlt.');
                if (response.error !== null) {
                    const error = response.error as Row;
                    if (!error || typeof error !== 'object' || typeof response.status !== 'number' || !Number.isInteger(response.status))
                        throw Error('Unbekanntes Ergebnis.');
                    return outcome({ ok: false, error: 'Originalanfrage nicht bestätigt. Den ursprünglichen Auftrag erneut prüfen.', uncertain: !(Object.hasOwn(response, 'data') && response.data === null && response.status >= 400 && response.status < 500 && isDefiniteMedicationRejection(typeof error.code === 'string' ? error.code : undefined, response.status)) }, response, true);
                }
                if (![200, 201].includes(response.status as number) || !uuid(response.data))
                    throw Error('Native UUID-Bestätigung fehlt.');
            }
            catch {
                return unknown(true, response);
            }
            // Own native terminal facts survive closed attachments and revoked current UI rights.
            return outcome({ ok: true, data: { id: response.data as string } }, response, true);
        }, () => unknown(observing));
        return await withServiceQueryTimeout(completion, kind === 'follow_up' ? 'Originale Vitalwertkontrolle speichern' : 'Originalen Ungültigkeitsvermerk speichern', 20000);
    }
    catch {
        return unknown(!entered);
    }
}
