// Generated native presentation from src/lib/pflege/vitalCreateNativeWrite.web.ts. Update through scripts/port-native-workspaces.mjs.
import { cloneClientNativeOriginal as clone, freezeClientNativeOriginal as freeze } from "../clients/clientRecordNativeOriginal.native.ts";
import { isDefiniteMedicationRejection } from './medicationRequestState.ts';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import type { MedicationWriteResult } from "./medicationAdministrationService.native.ts";
import type { VitalMeasurementPayload } from './vitalMeasurementDomain';
import type { VitalCreateRuntimeWeb } from "./vitalCreateRuntime.native.ts";
type Row = Record<string, unknown>;
const outcomes = new WeakMap<object, {
    runtime: VitalCreateRuntimeWeb;
    id: string;
    replay: boolean;
    original: unknown;
    flight: object | null;
    settled: boolean;
}>();
export function isOwnVitalCreateWriteResultWeb(result: unknown, runtime: VitalCreateRuntimeWeb, id: string, replay: boolean, flight: object | null = null) { const own = result && typeof result === 'object' ? outcomes.get(result) : null; return !!own && own.runtime === runtime && own.id === id && own.replay === replay && own.flight === flight; }
export function isSettledVitalCreateWriteResultWeb(result: unknown, runtime: VitalCreateRuntimeWeb, id: string, replay: boolean, flight: object) { return isOwnVitalCreateWriteResultWeb(result, runtime, id, replay, flight) && outcomes.get(result as object)?.settled === true; }
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
/** Original RPC contract, private Web current owner/rights and native ingress. */
export async function executeVitalCreateNativeWeb(runtime: VitalCreateRuntimeWeb, id: string, value: VitalMeasurementPayload, replay: boolean): Promise<MedicationWriteResult> {
    let entered = false, observing = false, flight: object | null = null;
    const outcome = (result: MedicationWriteResult, original: unknown, settled: boolean) => { const own = freeze(result); outcomes.set(own, { runtime, id, replay, original, flight, settled }); runtime.settleRequest(id, own, replay, flight); return own; };
    const unknown = (settled: boolean, original: unknown = null) => outcome({ ok: false, error: entered || replay ? 'Die ursprüngliche Speicherbestätigung fehlt. Dieselbe Anfrage mit aktuellen Rechten erneut prüfen.' : 'Aktuelle eigene Auswahl, Rechte und Verbindung zuerst prüfen.', uncertain: entered || replay }, original, settled);
    try {
        const payload = runtime.beginRequest(id, value, replay);
        flight = runtime.writeFlight(id);
        if (!flight)
            throw Error('Eigene ursprüngliche Transportphase fehlt.');
        const sdk = runtime.assertRequest(id, payload), rpc = (sdk as unknown as Row).rpc, second = (sdk as unknown as Row).rpc;
        if (typeof rpc !== 'function' || rpc !== second)
            throw Error('Nativer RPCaufruf ist nicht bestätigt.');
        const args = freeze(clone({ request_id: id, payload }));
        if (runtime.assertRequest(id, payload) !== sdk)
            throw Error('Ursprüngliche Verbindung fehlt.');
        // Method entry may start transport. A later denied Then entry is unknown,
        // never a proof of absence; it keeps the exact original request for replay.
        entered = true;
        const query = Reflect.apply(rpc, sdk, ['record_ambulatory_vital_measurement', args]);
        const first = (query as Row).then, last = (query as Row).then;
        if (typeof first !== 'function' || first !== last)
            throw Error('Nativer Thenaufruf ist nicht bestätigt.');
        const native = new Promise<unknown>((resolve, reject) => { if (runtime.assertRequest(id, payload) !== sdk)
            throw Error('Ursprüngliche Verbindung fehlt.'); observing = true; Reflect.apply(first, query, [resolve, reject]); });
        // Keep observing this original native promise after a UI deadline or editor
        // cleanup. Terminal transport facts are stored before any current UI grant.
        const completion = native.then(raw => {
            let response: Row | null = null;
            try {
                response = freeze(clone(raw)) as Row;
                if (!response || typeof response !== 'object' || Array.isArray(response) || !Object.hasOwn(response, 'error') || !Object.hasOwn(response, 'status'))
                    throw Error('Ganzes Speicherergebnis fehlt.');
                if (response.error !== null) {
                    const error = response.error as Row;
                    if (!error || typeof error !== 'object' || typeof response.status !== 'number')
                        throw Error('Unbekanntes Speicherergebnis.');
                    return outcome({ ok: false, error: 'Die Messung wurde nicht bestätigt. Bitte den ursprünglichen Speicherauftrag prüfen.', uncertain: !isDefiniteMedicationRejection(typeof error.code === 'string' ? error.code : undefined, response.status) }, response, true);
                }
                if (![200, 201].includes(response.status as number) || !uuid(response.data))
                    throw Error('Ursprüngliche Speicherbestätigung fehlt.');
            }
            catch {
                return unknown(true, response);
            }
            return outcome({ ok: true, data: { id: response.data as string } }, response, true);
        }, () => unknown(true));
        return await withServiceQueryTimeout(completion, 'Vitalwert speichern', 20000);
    }
    catch {
        return unknown(!observing);
    }
}
