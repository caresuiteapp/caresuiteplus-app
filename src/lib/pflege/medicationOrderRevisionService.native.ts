// Generated native presentation from src/lib/pflege/medicationOrderRevisionService.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { RoleKey, ServiceResult } from '@/types';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { getSupabaseClient } from "../supabase/client.ts";
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isDefiniteMedicationRejection } from './medicationRequestState';
import { sameWoundJson, woundUuid } from './woundCareDomain';
import { assertMedicationOrderRevision, assertMedicationOrderRevisionContext, compareMedicationOrderRevisionCursors, medicationOrderRevisionCursor, medicationOrderRevisionPacketIssue, type MedicationOrderRevision, type MedicationOrderRevisionScope, type MedicationOrderRevisionPacket, type MedicationOrderRevisionCursor, type MedicationOrderRevisionSource } from "./medicationOrderRevisionDomain.native.ts";
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
export type MedicationOrderRevisionWriteResult = ServiceResult<MedicationOrderRevision> & {
    uncertain?: boolean;
};
export type MedicationOrderRevisionWorkspace = {
    order: Record<string, unknown>;
    sources: MedicationOrderRevisionSource[];
    items: MedicationOrderRevision[];
};
const unavailable = { ok: false as const, error: 'Der Verordnungsarbeitsbereich ist nicht verbunden.' };
function ownAccess<T>(scope: MedicationOrderRevisionScope, role: RoleKey | null | undefined) {
    for (const permission of ['pflege.medications.manage', 'pflege.medications.view', 'office.documents.view', 'office.clients.view_sensitive'] as const) {
        const denied = enforcePermission<T>(role, permission);
        if (denied)
            return denied;
    }
    if (![scope.tenantId, scope.clientId, scope.medicationId].every(woundUuid))
        return { ok: false as const, error: 'Eigene Verordnungszuordnung fehlt.' };
    return guardServiceTenant(scope.tenantId);
}
function rpcClient(): RpcClient | null { const client = getSupabaseClient(); return client && getServiceMode() === 'supabase' ? client as unknown as RpcClient : null; }
function stillCurrent(scope: MedicationOrderRevisionScope, isCurrent: () => boolean) { if (!isCurrent() || guardServiceTenant(scope.tenantId))
    throw Error('Die eigene zugängliche Medikationsakte hat sich geändert.'); }
const immutableOriginal = (r: MedicationOrderRevision) => { const { state: _state, application: _application, ...original } = r; return original; };
/** A proposed transcription is not a native update or a medical authorization. */
export async function proposeMedicationOrderRevision(packet: MedicationOrderRevisionPacket, role: RoleKey | null | undefined, isCurrent: () => boolean): Promise<MedicationOrderRevisionWriteResult> {
    const issue = medicationOrderRevisionPacketIssue(packet);
    if (issue)
        return { ok: false, error: issue };
    const original = structuredClone(packet), denied = ownAccess<MedicationOrderRevision>(original, role);
    if (denied)
        return denied;
    const client = rpcClient();
    if (!client)
        return unavailable;
    try {
        stillCurrent(original, isCurrent);
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Aktive eigene Akte prüfen.' };
    }
    try {
        const sent = await withServiceQueryTimeout(Promise.resolve(client.rpc('propose_ambulatory_medication_order_revision', { packet: original })), 'Strukturierter Verordnungsentwurf', 20000);
        stillCurrent(original, isCurrent);
        if (sent.error)
            return { ok: false, error: toGermanSupabaseError(sent.error), uncertain: !isDefiniteMedicationRejection(sent.error.code, sent.status) };
        const retained = assertMedicationOrderRevision(sent.data, original, original);
        const confirmed = await withServiceQueryTimeout(Promise.resolve(client.rpc('confirm_ambulatory_medication_order_revision', { revision_id: retained.id, request_id: original.requestId })), 'Eigener Verordnungsentwurf', 20000);
        stillCurrent(original, isCurrent);
        if (confirmed.error)
            throw Error('Der eigene gespeicherte Entwurf ist noch nicht vollständig bestätigt.');
        const receipt = assertMedicationOrderRevision(confirmed.data, original, original);
        if (!sameWoundJson(immutableOriginal(retained), immutableOriginal(receipt)))
            throw Error('Das unveränderbare Entwurfsoriginal wurde geändert.');
        return { ok: true, data: receipt };
    }
    catch {
        return { ok: false, uncertain: true, error: 'Der eigene Verordnungsentwurf ist noch nicht bestätigt. Dieselbe unveränderte Anfrage erneut prüfen.' };
    }
}
export async function readMedicationOrderRevisionHistory(scope: MedicationOrderRevisionScope, role: RoleKey | null | undefined, isCurrent: () => boolean): Promise<ServiceResult<{
    items: MedicationOrderRevision[];
}>> {
    scope = structuredClone(scope);
    const denied = ownAccess<{
        items: MedicationOrderRevision[];
    }>(scope, role);
    if (denied)
        return denied;
    const client = rpcClient();
    if (!client)
        return unavailable;
    const items: MedicationOrderRevision[] = [], seen = new Set<string>();
    let cursor: MedicationOrderRevisionCursor | null = null, head: unknown = null;
    try {
        for (;;) {
            stillCurrent(scope, isCurrent);
            const result = await withServiceQueryTimeout(Promise.resolve(client.rpc('read_ambulatory_medication_order_revisions', { medication_id: scope.medicationId, cursor_at: cursor?.at ?? null, cursor_id: cursor?.id ?? null, page_size: 50 })), 'Verordnungsentwürfe', 20000);
            stillCurrent(scope, isCurrent);
            if (result.error)
                throw Error(toGermanSupabaseError(result.error));
            const page = result.data as {
                items?: unknown;
                nextCursor?: unknown;
            } | null;
            if (!page || typeof page !== 'object' || Array.isArray(page) || !Object.hasOwn(page, 'items') || !Object.hasOwn(page, 'nextCursor') || !Array.isArray(page.items) || page.items.length > 50)
                throw Error('Der Entwurfsverlauf ist unvollständig.');
            if (head === null)
                head = structuredClone(result.data);
            let previous = cursor;
            for (const value of page.items) {
                const revision = assertMedicationOrderRevision(value, scope), position = { at: revision.recorded_at, id: revision.id };
                if (seen.has(revision.id.toLowerCase()) || previous && compareMedicationOrderRevisionCursors(position, previous) >= 0)
                    throw Error('Der Entwurfsverlauf ist doppelt oder falsch sortiert.');
                seen.add(revision.id.toLowerCase());
                items.push(revision);
                previous = position;
            }
            if (page.nextCursor === null)
                break;
            const next = medicationOrderRevisionCursor(page.nextCursor);
            if (!page.items.length || !previous || compareMedicationOrderRevisionCursors(next, previous) !== 0 || cursor && compareMedicationOrderRevisionCursors(next, cursor) >= 0)
                throw Error('Der Entwurfsverlauf ist abgeschnitten oder der Cursor wurde ausgetauscht.');
            cursor = next;
        }
        const latest = await withServiceQueryTimeout(Promise.resolve(client.rpc('read_ambulatory_medication_order_revisions', { medication_id: scope.medicationId, cursor_at: null, cursor_id: null, page_size: 50 })), 'Entwurfsverlauf erneut bestätigen', 20000);
        stillCurrent(scope, isCurrent);
        if (latest.error || !sameWoundJson(head, latest.data))
            throw Error('Der Entwurfsverlauf wurde während des Ladens fortgeschrieben. Neu laden.');
        return { ok: true, data: { items } };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Verordnungsentwürfe konnten nicht vollständig geladen werden.' };
    }
}
export async function readMedicationOrderRevisionWorkspace(scope: MedicationOrderRevisionScope, role: RoleKey | null | undefined, isCurrent: () => boolean): Promise<ServiceResult<MedicationOrderRevisionWorkspace>> {
    scope = structuredClone(scope);
    const denied = ownAccess<MedicationOrderRevisionWorkspace>(scope, role);
    if (denied)
        return denied;
    const client = rpcClient();
    if (!client)
        return unavailable;
    try {
        stillCurrent(scope, isCurrent);
        const result = await withServiceQueryTimeout(Promise.resolve(client.rpc('read_ambulatory_medication_order_revision_context', { medication_id: scope.medicationId })), 'Native Verordnung und archivierte Quellen', 20000);
        stillCurrent(scope, isCurrent);
        if (result.error)
            throw Error(toGermanSupabaseError(result.error));
        const context = assertMedicationOrderRevisionContext(result.data, scope), history = await readMedicationOrderRevisionHistory(scope, role, isCurrent);
        stillCurrent(scope, isCurrent);
        if (!history.ok)
            return history;
        // Separate RPC transactions must not combine an old native/source context with
        // a newer history after a concurrent transcription or archive change.
        const latest = await withServiceQueryTimeout(Promise.resolve(client.rpc('read_ambulatory_medication_order_revision_context', { medication_id: scope.medicationId })), 'Verordnungsstand erneut bestätigen', 20000);
        stillCurrent(scope, isCurrent);
        if (latest.error || !sameWoundJson(context, assertMedicationOrderRevisionContext(latest.data, scope)))
            throw Error('Nativer Verordnungsstand oder archivierte Quellen wurden während des Ladens geändert. Neu laden.');
        return { ok: true, data: { ...context, items: history.data.items } };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Verordnungsarbeitsbereich konnte nicht vollständig geladen werden.' };
    }
}
