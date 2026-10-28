// Generated native presentation from src/lib/office/continuity/clientCareContinuityRepository.supabase.web.ts. Update through scripts/port-native-workspaces.mjs.
import { getSupabaseClient } from "../../supabase/client.ts";
import type { ServiceResult } from '@/types';
import type { ClientServiceContinuitySummary, ClientServiceInterruption, ClientServiceInterruptionKind, } from '@/types/modules/clientCareContinuity';
type Row = Record<string, unknown>;
type RpcClient = {
    rpc(name: string, args: Record<string, unknown>): Promise<{
        data: unknown;
        error: {
            message?: string;
            code?: string;
        } | null;
    }>;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
function own(row: unknown, key: string): unknown {
    if (!row || typeof row !== 'object')
        return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(row, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}
function text(row: Row, key: string): string { return typeof row[key] === 'string' ? String(row[key]) : ''; }
function nullableText(row: Row, key: string): string | null { return text(row, key) || null; }
function count(row: Row, key: string): number { const n = Number(row[key]); return Number.isSafeInteger(n) && n >= 0 ? n : -1; }
function exactRow(value: unknown): value is Row { return !!value && typeof value === 'object' && !Array.isArray(value); }
function mapInterruption(value: unknown): ClientServiceInterruption | null {
    if (!exactRow(value))
        return null;
    const status = text(value, 'status');
    const kind = text(value, 'kind');
    const requiredIds = ['id', 'request_id', 'tenant_id', 'client_id'];
    const requiredTimes = ['planned_start_at', 'actual_start_at', 'client_updated_at', 'created_at', 'updated_at'];
    if (!requiredIds.every((key) => UUID.test(text(value, key)))
        || !requiredTimes.every((key) => INSTANT.test(text(value, key)))
        || !['active', 'ended'].includes(status)
        || !['hospital', 'rehabilitation', 'vacation', 'other'].includes(kind)
        || !text(value, 'reason').trim()
        || ['affected_visit_count', 'affected_tour_stop_count', 'blocked_started_visit_count'].some((key) => count(value, key) < 0)
        || nullableText(value, 'planned_end_at') && !INSTANT.test(text(value, 'planned_end_at'))
        || nullableText(value, 'actual_end_at') && !INSTANT.test(text(value, 'actual_end_at'))
        || status === 'ended' && (!nullableText(value, 'actual_end_at') || !nullableText(value, 'end_reason')))
        return null;
    return Object.freeze({
        id: text(value, 'id'), requestId: text(value, 'request_id'), tenantId: text(value, 'tenant_id'), clientId: text(value, 'client_id'),
        kind: kind as ClientServiceInterruptionKind, reason: text(value, 'reason'), plannedStartAt: text(value, 'planned_start_at'),
        plannedEndAt: nullableText(value, 'planned_end_at'), actualStartAt: text(value, 'actual_start_at'), actualEndAt: nullableText(value, 'actual_end_at'),
        endReason: nullableText(value, 'end_reason'), status: status as 'active' | 'ended',
        affectedVisitCount: count(value, 'affected_visit_count'), affectedTourStopCount: count(value, 'affected_tour_stop_count'),
        blockedStartedVisitCount: count(value, 'blocked_started_visit_count'), clientUpdatedAt: text(value, 'client_updated_at'),
        createdAt: text(value, 'created_at'), updatedAt: text(value, 'updated_at'),
    });
}
function mapSummary(value: unknown, tenantId: string, clientId: string): ClientServiceContinuitySummary | null {
    if (!exactRow(value) || typeof value.client_name !== 'string' || !INSTANT.test(text(value, 'client_updated_at')) || !Array.isArray(value.history))
        return null;
    const history = value.history.map(mapInterruption);
    if (history.some((entry) => !entry || entry.tenantId !== tenantId || entry.clientId !== clientId))
        return null;
    const active = value.active === null ? null : mapInterruption(value.active);
    if (value.active !== null && !active)
        return null;
    if (active && (active.tenantId !== tenantId || active.clientId !== clientId || active.status !== 'active'))
        return null;
    return Object.freeze({ clientName: value.client_name, clientUpdatedAt: text(value, 'client_updated_at'), active, history: Object.freeze(history as ClientServiceInterruption[]) });
}
async function call(name: string, args: Record<string, unknown>): Promise<ServiceResult<unknown>> {
    const client = getSupabaseClient();
    if (!client)
        return { ok: false, error: 'Die sichere Live-Datenbank ist nicht verfügbar.' };
    const captured = client;
    const result = await (captured as unknown as RpcClient).rpc(name, args);
    if (captured !== getSupabaseClient())
        return { ok: false, error: 'Die Datenbanksitzung hat während der Anfrage gewechselt.' };
    if (result.error)
        return { ok: false, error: result.error.message ?? 'Der native Unterbrechungsvorgang ist fehlgeschlagen.' };
    return { ok: true, data: result.data };
}
export async function readClientServiceContinuity(tenantId: string, clientId: string, actorId: string): Promise<ServiceResult<ClientServiceContinuitySummary>> {
    if (![tenantId, clientId, actorId].every((value) => UUID.test(value)))
        return { ok: false, error: 'Der sichere Personenbezug fehlt.' };
    const result = await call('web_read_client_service_continuity', { p_tenant_id: tenantId, p_client_id: clientId, p_actor_profile_id: actorId });
    if (!result.ok)
        return result;
    const summary = mapSummary(result.data, tenantId, clientId);
    return summary ? { ok: true, data: summary } : { ok: false, error: 'Die native Unterbrechungsübersicht ist unvollständig oder widersprüchlich.' };
}
export async function beginClientServiceInterruption(input: {
    tenantId: string;
    clientId: string;
    actorId: string;
    requestId: string;
    expectedClientUpdatedAt: string;
    kind: ClientServiceInterruptionKind;
    reason: string;
    plannedStartAt: string;
    plannedEndAt: string | null;
    actualStartAt: string;
}): Promise<ServiceResult<ClientServiceInterruption>> {
    if (![input.tenantId, input.clientId, input.actorId, input.requestId].every((value) => UUID.test(value))
        || ![input.expectedClientUpdatedAt, input.plannedStartAt, input.actualStartAt].every((value) => INSTANT.test(value))
        || input.plannedEndAt && !INSTANT.test(input.plannedEndAt) || input.reason.trim().length < 10) {
        return { ok: false, error: 'Unterbrechungsart, tatsächlicher Beginn, Planzeitraum und vollständiger Grund müssen bestätigt sein.' };
    }
    const original = Object.freeze({ ...input, reason: input.reason.trim() });
    const result = await call('web_begin_client_service_interruption', {
        p_tenant_id: original.tenantId, p_client_id: original.clientId, p_actor_profile_id: original.actorId,
        p_request_id: original.requestId, p_expected_client_updated_at: original.expectedClientUpdatedAt,
        p_kind: original.kind, p_reason: original.reason, p_planned_start_at: original.plannedStartAt,
        p_planned_end_at: original.plannedEndAt, p_actual_start_at: original.actualStartAt,
    });
    if (!result.ok)
        return result;
    const interruption = mapInterruption(result.data);
    return interruption && interruption.requestId === input.requestId && interruption.tenantId === input.tenantId && interruption.clientId === input.clientId
        ? { ok: true, data: interruption } : { ok: false, error: 'Die native Startquittung ist unvollständig oder gehört zu einem anderen Vorgang.' };
}
export async function confirmClientServiceInterruption(input: {
    tenantId: string;
    clientId: string;
    actorId: string;
    requestId: string;
}): Promise<ServiceResult<ClientServiceInterruption>> {
    if (![input.tenantId, input.clientId, input.actorId, input.requestId].every((value) => UUID.test(value)))
        return { ok: false, error: 'Der sichere Unterbrechungsbezug fehlt.' };
    const result = await call('web_confirm_client_service_interruption', {
        p_tenant_id: input.tenantId, p_client_id: input.clientId, p_actor_profile_id: input.actorId, p_request_id: input.requestId,
    });
    if (!result.ok)
        return result;
    const interruption = mapInterruption(result.data);
    return interruption && interruption.requestId === input.requestId && interruption.tenantId === input.tenantId && interruption.clientId === input.clientId
        ? { ok: true, data: interruption } : { ok: false, error: 'Die Unterbrechung ist durch keine vollständige native Quittung bestätigt.' };
}
export async function endClientServiceInterruption(input: {
    tenantId: string;
    clientId: string;
    actorId: string;
    interruptionId: string;
    endRequestId: string;
    expectedUpdatedAt: string;
    actualEndAt: string;
    endReason: string;
}): Promise<ServiceResult<ClientServiceInterruption>> {
    if (![input.tenantId, input.clientId, input.actorId, input.interruptionId, input.endRequestId].every((value) => UUID.test(value))
        || ![input.expectedUpdatedAt, input.actualEndAt].every((value) => INSTANT.test(value)) || input.endReason.trim().length < 10) {
        return { ok: false, error: 'Tatsächliches Ende, vollständiger Rückkehrgrund und aktueller Originalstand müssen bestätigt sein.' };
    }
    const result = await call('web_end_client_service_interruption', {
        p_tenant_id: input.tenantId, p_client_id: input.clientId, p_actor_profile_id: input.actorId,
        p_interruption_id: input.interruptionId, p_end_request_id: input.endRequestId,
        p_expected_updated_at: input.expectedUpdatedAt, p_actual_end_at: input.actualEndAt, p_end_reason: input.endReason.trim(),
    });
    if (!result.ok)
        return result;
    const interruption = mapInterruption(result.data);
    return interruption && interruption.id === input.interruptionId && interruption.status === 'ended'
        && interruption.tenantId === input.tenantId && interruption.clientId === input.clientId
        ? { ok: true, data: interruption } : { ok: false, error: 'Die native Rückkehrquittung ist unvollständig oder widersprüchlich.' };
}
export const clientServiceContinuityInternals = Object.freeze({ mapInterruption, mapSummary, own });
