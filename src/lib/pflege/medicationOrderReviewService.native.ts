// Generated native presentation from src/lib/pflege/medicationOrderReviewService.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { getSupabaseClient } from "../supabase/client.ts";
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { assertMedicationOrderRevision, medicationOrderRevisionInstant, medicationOrderRevisionCursor, compareMedicationOrderRevisionCursors, type MedicationOrderRevision, type MedicationOrderRevisionScope, type MedicationOrderRevisionCursor } from "./medicationOrderRevisionDomain.native.ts";
import { assertMedicationOrderReviewItem, assertMedicationOrderReviewReceipt, assertMedicationOrderApply, assertMedicationOrderApplyConfirmation, medicationOrderReviewPacketIssue, medicationOrderApplyPacketIssue, type MedicationOrderReviewItem, type MedicationOrderReviewPacket, type MedicationOrderReviewReceipt, type MedicationOrderApplyPacket } from "./medicationOrderReviewDomain.native.ts";
import { isDefiniteMedicationRejection } from './medicationRequestState';
import { sameWoundJson, woundUuid } from './woundCareDomain';
type RpcResult = {
    data: unknown;
    error: {
        code?: string;
    } | null;
    status?: number;
};
type RpcClient = {
    rpc(name: string, args: Record<string, unknown>): Promise<RpcResult>;
};
export type MedicationOrderReviewWorkspace = {
    order: Record<string, unknown>;
    stateFingerprint: string;
    items: MedicationOrderReviewItem[];
};
export type MedicationOrderReviewWriteResult = ServiceResult<MedicationOrderReviewReceipt> & {
    uncertain?: boolean;
};
export type MedicationOrderReviewApplyResult = ServiceResult<MedicationOrderRevision> & {
    uncertain?: boolean;
};
const unavailable = { ok: false as const, error: 'Die technische Übertragungsprüfung ist nicht verbunden.' };
function ownAccess<T>(scope: MedicationOrderRevisionScope, role: RoleKey | null | undefined, sign = false) {
    for (const permission of ['pflege.medications.manage', 'pflege.medications.view', 'office.documents.view', 'office.clients.view_sensitive', ...(sign ? ['pflege.documentation.sign'] as const : [])] as const) {
        const denied = enforcePermission<T>(role, permission);
        if (denied)
            return denied;
    }
    if (![scope.tenantId, scope.clientId, scope.medicationId].every(woundUuid))
        return { ok: false as const, error: 'Eigene Medikationszuordnung fehlt.' };
    return guardServiceTenant(scope.tenantId);
}
function client(): RpcClient | null { const db = getSupabaseClient(); return db && getServiceMode() === 'supabase' ? db as unknown as RpcClient : null; }
function current(scope: MedicationOrderRevisionScope, isCurrent: () => boolean) { if (!isCurrent() || guardServiceTenant(scope.tenantId))
    throw Error('Eigener Medikations- oder Rechtekontext wurde geändert.'); }
export async function commitMedicationOrderReview(input: MedicationOrderReviewPacket, role: RoleKey | null | undefined, isCurrent: () => boolean): Promise<MedicationOrderReviewWriteResult> {
    const packet = structuredClone(input);
    if (packet.action === 'request' && typeof packet.reason === 'string')
        packet.reason = packet.reason.trim();
    else if (packet.action !== 'request' && typeof packet.reviewReference === 'string')
        packet.reviewReference = packet.reviewReference.trim();
    const issue = medicationOrderReviewPacketIssue(packet);
    if (issue)
        return { ok: false, error: issue };
    const denied = ownAccess<MedicationOrderReviewReceipt>(packet, role, packet.action === 'authorize' || packet.action === 'reject');
    if (denied)
        return denied;
    const db = client();
    if (!db)
        return unavailable;
    try {
        current(packet, isCurrent);
    }
    catch {
        return { ok: false, error: 'Aktiven eigenen Prüfkontext bestätigen.' };
    }
    try {
        const response = await withServiceQueryTimeout(Promise.resolve(db.rpc('commit_ambulatory_medication_order_review', { packet })), 'Technischer Übertragungsprüfauftrag', 20000);
        current(packet, isCurrent);
        if (response.error)
            return { ok: false, error: toGermanSupabaseError(response.error), uncertain: !isDefiniteMedicationRejection(response.error.code, response.status) };
        const original = assertMedicationOrderReviewReceipt(response.data, packet);
        const confirmed = await withServiceQueryTimeout(Promise.resolve(db.rpc('confirm_ambulatory_medication_order_review', { request_id: packet.requestId })), 'Eigener technischer Prüfbeleg', 20000);
        current(packet, isCurrent);
        if (confirmed.error)
            throw Error('Unabhängige Schreibbestätigung fehlt.');
        const receipt = assertMedicationOrderReviewReceipt(confirmed.data, packet);
        if (!sameWoundJson(original, receipt))
            throw Error('Ursprünglicher Prüfbeleg wurde geändert.');
        return { ok: true, data: receipt };
    }
    catch {
        return { ok: false, uncertain: true, error: 'Der ursprüngliche technische Prüfauftrag ist noch ungeklärt. Dieselbe unveränderte Anfrage erneut prüfen.' };
    }
}
export async function readMedicationOrderReviewWorkspace(input: MedicationOrderRevisionScope, role: RoleKey | null | undefined, isCurrent: () => boolean): Promise<ServiceResult<MedicationOrderReviewWorkspace>> {
    const scope = structuredClone(input), denied = ownAccess<MedicationOrderReviewWorkspace>(scope, role);
    if (denied)
        return denied;
    const db = client();
    if (!db)
        return unavailable;
    const items: MedicationOrderReviewItem[] = [], seen = new Set<string>();
    let cursor: MedicationOrderRevisionCursor | null = null, head: unknown = null, order: Record<string, unknown> | null = null, stateFingerprint = '';
    try {
        for (;;) {
            current(scope, isCurrent);
            const result = await withServiceQueryTimeout(Promise.resolve(db.rpc('read_ambulatory_medication_order_review_context', { medication_id: scope.medicationId, cursor_at: cursor?.at ?? null, cursor_id: cursor?.id ?? null, page_size: 50 })), 'Technischen Prüfverlauf vollständig laden', 20000);
            current(scope, isCurrent);
            if (result.error)
                throw Error(toGermanSupabaseError(result.error));
            const p = result.data as {
                order?: unknown;
                stateFingerprint?: unknown;
                items?: unknown;
                nextCursor?: unknown;
            } | null;
            if (!p || typeof p !== 'object' || Array.isArray(p) || Object.keys(p).length !== 4 || !Array.isArray(p.items) || p.items.length > 50 || !Object.hasOwn(p, 'nextCursor') || !p.order || typeof p.order !== 'object' || Array.isArray(p.order) || typeof p.stateFingerprint !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(p.stateFingerprint))
                throw Error('Vollständiger technischer Prüfkontext fehlt.');
            const native = p.order as Record<string, unknown>;
            if (native.id !== scope.medicationId || native.tenant_id !== scope.tenantId || native.client_id !== scope.clientId || medicationOrderRevisionInstant(native.updated_at) === null)
                throw Error('Nativer eigener Verordnungsstand fehlt.');
            if (head === null) {
                head = structuredClone(result.data);
                order = structuredClone(native);
                stateFingerprint = p.stateFingerprint;
            }
            else if (!sameWoundJson(order, native) || stateFingerprint !== p.stateFingerprint)
                throw Error('Prüfentscheid oder native Verordnung wurde während des Ladens geändert.');
            let previous = cursor;
            for (const value of p.items) {
                const item = assertMedicationOrderReviewItem(value, scope), position = { at: item.request.createdAt, id: item.request.id };
                if (seen.has(item.request.id.toLowerCase()) || previous && compareMedicationOrderRevisionCursors(position, previous) >= 0)
                    throw Error('Technischer Prüfverlauf ist doppelt oder falsch sortiert.');
                seen.add(item.request.id.toLowerCase());
                items.push(item);
                previous = position;
            }
            if (p.nextCursor === null)
                break;
            const next = medicationOrderRevisionCursor(p.nextCursor);
            if (!p.items.length || !previous || compareMedicationOrderRevisionCursors(next, previous) !== 0 || cursor && compareMedicationOrderRevisionCursors(next, cursor) >= 0)
                throw Error('Technischer Prüfverlauf ist abgeschnitten.');
            cursor = next;
        }
        const latest = await withServiceQueryTimeout(Promise.resolve(db.rpc('read_ambulatory_medication_order_review_context', { medication_id: scope.medicationId, cursor_at: null, cursor_id: null, page_size: 50 })), 'Prüfverlauf erneut bestätigen', 20000);
        current(scope, isCurrent);
        if (latest.error || !sameWoundJson(head, latest.data) || !order)
            throw Error('Technischer Prüfverlauf wurde fortgeschrieben. Neu laden.');
        return { ok: true, data: { order, stateFingerprint, items } };
    }
    catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : 'Technischen Prüfverlauf vollständig neu laden.' };
    }
}
export async function applyMedicationOrderReview(inputItem: MedicationOrderReviewItem, inputPacket: MedicationOrderApplyPacket, actorId: string, role: RoleKey | null | undefined, isCurrent: () => boolean): Promise<MedicationOrderReviewApplyResult> {
    const item = structuredClone(inputItem), packet = structuredClone(inputPacket), scope = item.request;
    if (typeof packet.reason === 'string')
        packet.reason = packet.reason.trim();
    const denied = ownAccess<MedicationOrderRevision>(scope, role);
    if (denied)
        return denied;
    try {
        assertMedicationOrderReviewItem(item, scope);
        if (medicationOrderApplyPacketIssue(packet) || !woundUuid(actorId) || actorId !== scope.creatorId || item.decision?.action !== 'authorize' || item.authorization?.revokedAt !== null || item.authorization.id !== packet.authorizationId || scope.revisionId !== packet.revisionId)
            throw Error('Eigene gesonderte technische Übertragungsberechtigung fehlt.');
        current(scope, isCurrent);
    }
    catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : 'Eigene technische Übertragung prüfen.' };
    }
    const db = client();
    if (!db)
        return unavailable;
    try {
        const result = await withServiceQueryTimeout(Promise.resolve(db.rpc('apply_ambulatory_medication_order_revision', { packet })), 'Strukturierte Verordnungsangaben übernehmen', 20000);
        current(scope, isCurrent);
        if (result.error)
            return { ok: false, error: toGermanSupabaseError(result.error), uncertain: !isDefiniteMedicationRejection(result.error.code, result.status) };
        const applied = assertMedicationOrderApply(item, packet, result.data);
        const confirmed = await withServiceQueryTimeout(Promise.resolve(db.rpc('confirm_ambulatory_medication_order_revision', { revision_id: scope.revisionId, request_id: scope.revision.request_id })), 'Übertragenen eigenen Verordnungsstand bestätigen', 20000);
        current(scope, isCurrent);
        if (confirmed.error)
            throw Error('Unabhängige native Übertragungsbestätigung fehlt.');
        const receipt = assertMedicationOrderRevision(confirmed.data, scope);
        if (!sameWoundJson(applied, receipt))
            throw Error('Unveränderte technische Übertragung ist nicht bestätigt.');
        return { ok: true, data: receipt };
    }
    catch {
        return { ok: false, uncertain: true, error: 'Die technische Übernahme ist noch ungeklärt. Dieselbe unveränderte Anfrage erneut prüfen.' };
    }
}
/** Historical own-write confirmation never issues or reissues a technical authorization. */
export async function confirmMedicationOrderReview(packet: MedicationOrderReviewPacket, role: RoleKey | null | undefined, isCurrent: () => boolean): Promise<MedicationOrderReviewWriteResult> {
    const original = structuredClone(packet), issue = medicationOrderReviewPacketIssue(original);
    if (issue)
        return { ok: false, error: issue, uncertain: true };
    const denied = ownAccess<MedicationOrderReviewReceipt>(original, role);
    if (denied)
        return { ...denied, uncertain: true };
    const db = client();
    if (!db)
        return { ...unavailable, uncertain: true };
    try {
        current(original, isCurrent);
        const response = await withServiceQueryTimeout(Promise.resolve(db.rpc('confirm_ambulatory_medication_order_review', { request_id: original.requestId })), 'Ursprünglichen eigenen Prüfbeleg wiederherstellen', 20000);
        current(original, isCurrent);
        if (response.error)
            throw Error('Eigener Prüfbeleg noch nicht erreichbar.');
        return { ok: true, data: assertMedicationOrderReviewReceipt(response.data, original) };
    }
    catch {
        return { ok: false, uncertain: true, error: 'Der ursprüngliche Prüfbeleg ist noch nicht bestätigt. Der gespeicherte Auftrag bleibt erhalten.' };
    }
}
export async function confirmMedicationOrderReviewApplication(inputItem: MedicationOrderReviewItem, inputPacket: MedicationOrderApplyPacket, actorId: string, role: RoleKey | null | undefined, isCurrent: () => boolean): Promise<MedicationOrderReviewApplyResult> {
    const item = structuredClone(inputItem), packet = structuredClone(inputPacket), scope = item.request;
    const denied = ownAccess<MedicationOrderRevision>(scope, role);
    if (denied)
        return { ...denied, uncertain: true };
    const db = client();
    if (!db)
        return { ...unavailable, uncertain: true };
    try {
        assertMedicationOrderReviewItem(item, scope);
        if (actorId !== scope.creatorId || medicationOrderApplyPacketIssue(packet))
            throw Error('Eigener Übertragungsbezug fehlt.');
        current(scope, isCurrent);
        const response = await withServiceQueryTimeout(Promise.resolve(db.rpc('confirm_ambulatory_medication_order_revision', { revision_id: scope.revisionId, request_id: scope.revision.request_id })), 'Ursprüngliche eigene Übernahme wiederherstellen', 20000);
        current(scope, isCurrent);
        if (response.error)
            throw Error('Eigene Übernahme noch nicht erreichbar.');
        const revision = assertMedicationOrderRevision(response.data, scope), confirmed = assertMedicationOrderApplyConfirmation(item, packet, revision.application);
        if (!sameWoundJson(revision, confirmed))
            throw Error('Übernahmeoriginal widerspricht dem Auftrag.');
        return { ok: true, data: confirmed };
    }
    catch {
        return { ok: false, uncertain: true, error: 'Die ursprüngliche eigene Übernahme ist noch nicht bestätigt. Der gespeicherte Auftrag bleibt erhalten.' };
    }
}
