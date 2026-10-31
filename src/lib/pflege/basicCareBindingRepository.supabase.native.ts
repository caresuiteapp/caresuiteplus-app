// Generated native presentation from src/lib/pflege/basicCareBindingRepository.supabase.web.ts. Update through scripts/port-native-workspaces.mjs.
import { cloneClientNativeOriginal } from "../clients/clientRecordNativeOriginal.native.ts";
import { createBasicCareTransportGuard } from "./basicCareRepository.supabase.native.ts";
import { assertBasicCareBindingReference, assertBasicCareBindingExpectedSelection, assertBasicCareBindingSelection, basicCareBindingPacketHash, decodeBasicCareBindingContext, decodeBasicCareBindingStatus, type BasicCareBindingScope, type BasicCareBindingReference, type BasicCareBindingExpectedSelection, type BasicCareBindingSelection, type BasicCareBindingStatus, type BasicCareBindingContext } from "./basicCareBinding.native.ts";
type Result<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: string;
    uncertain?: boolean;
};
const failure = 'Der eigene Planbindungsvorgang konnte nicht bestätigt werden.';
export async function readBasicCareBindingContext(context: BasicCareBindingScope & {
    isCurrent(): boolean;
}): Promise<Result<BasicCareBindingContext>> { try {
    const guard = await createBasicCareTransportGuard(context), response = await guard.read('web_read_basic_care_binding_context', { p_tenant_id: guard.scope.tenantId, p_client_id: guard.scope.clientId, p_actor_profile_id: guard.scope.actorId }, 'Native Grundpflegeplanung lesen');
    await guard.check();
    if (response.error !== null)
        throw Error(failure);
    return { ok: true, data: decodeBasicCareBindingContext(response.data, guard.scope) };
}
catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : failure };
} }
export async function prepareBasicCareBindingIntent(input: BasicCareBindingReference, text: string, expectedInput: BasicCareBindingExpectedSelection, isCurrent: () => boolean): Promise<Result<BasicCareBindingStatus>> { let dispatched = false; try {
    const ref = cloneClientNativeOriginal(input), expected = cloneClientNativeOriginal(expectedInput);
    assertBasicCareBindingReference(ref);
    assertBasicCareBindingExpectedSelection(expected);
    assertBasicCareBindingSelection(expected as BasicCareBindingSelection);
    if (await basicCareBindingPacketHash(text) !== ref.packetHash || !isCurrent())
        throw Error(failure);
    const packet = cloneClientNativeOriginal(JSON.parse(text));
    if (packet.schemaVersion !== '1' || packet.tenantId !== ref.tenantId || packet.clientId !== ref.clientId || packet.actorId !== ref.actorId || packet.requestId !== ref.requestId || packet.planVersionId !== expected.planVersionId || packet.measureId !== expected.measureId || packet.visitId !== expected.visitId || packet.plannedAt !== expected.plannedAt || packet.secondPersonRequired !== expected.secondPersonRequired || packet.sources?.measure?.category !== expected.kind || expected.title !== undefined && packet.sources?.measure?.title !== expected.title)
        throw Error(failure);
    const guard = await createBasicCareTransportGuard({ ...ref, isCurrent });
    dispatched = true;
    const response = await guard.read('web_prepare_basic_care_binding_intent', { p_packet_text: text, p_packet_hash: ref.packetHash }, 'Eigene Planbindungsabsicht vorbereiten');
    await guard.check();
    if (response.error !== null)
        throw Error(failure);
    const status = decodeBasicCareBindingStatus(response.data, ref, expected);
    if (status.state === 'absent')
        throw Error(failure);
    return { ok: true, data: status };
}
catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : failure, uncertain: dispatched };
} }
async function statusCall(name: string, input: BasicCareBindingReference, expectedInput: BasicCareBindingExpectedSelection, isCurrent: () => boolean, write: boolean): Promise<Result<BasicCareBindingStatus>> { let dispatched = false; try {
    const ref = cloneClientNativeOriginal(input), expected = cloneClientNativeOriginal(expectedInput);
    assertBasicCareBindingReference(ref);
    assertBasicCareBindingExpectedSelection(expected);
    const guard = await createBasicCareTransportGuard({ ...ref, isCurrent });
    dispatched = true;
    const response = await guard.read(name, { p_tenant_id: ref.tenantId, p_client_id: ref.clientId, p_actor_profile_id: ref.actorId, p_request_id: ref.requestId, p_packet_hash: ref.packetHash }, 'Eigenen Planbindungsausgang bestätigen');
    await guard.check();
    if (response.error !== null)
        throw Error(failure);
    const status = decodeBasicCareBindingStatus(response.data, ref, expected);
    if (write && !['committed', 'cancelled'].includes(status.state))
        throw Error(failure);
    return { ok: true, data: status };
}
catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : failure, uncertain: dispatched };
} }
export const confirmBasicCareBindingIntent = (ref: BasicCareBindingReference, expected: BasicCareBindingExpectedSelection, isCurrent: () => boolean) => statusCall('web_confirm_basic_care_binding_intent', ref, expected, isCurrent, false);
export const commitBasicCareBindingIntent = (ref: BasicCareBindingReference, expected: BasicCareBindingExpectedSelection, isCurrent: () => boolean) => statusCall('web_commit_basic_care_binding_intent', ref, expected, isCurrent, true);
export const cancelBasicCareBindingIntent = (ref: BasicCareBindingReference, expected: BasicCareBindingExpectedSelection, isCurrent: () => boolean) => statusCall('web_cancel_basic_care_binding_intent', ref, expected, isCurrent, true);
