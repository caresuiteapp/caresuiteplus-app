// Generated native presentation from src/lib/privacy/dataSubjectRequestAdminWeb.web.ts. Update through scripts/port-native-workspaces.mjs.
import { shareNativeFile } from '@/lib/platform/nativeFileDelivery.native';
import { getSupabaseClient } from "../supabase/client.ts";
import { resolveAuthenticatedProfileId } from '@/lib/auth/resolveAuthenticatedProfile';
import { isDataSubjectRequestBackendReady } from './dataRequestConfig';
import { DATA_REQUEST_TYPE_LABELS, DATA_SUBJECT_REQUEST_STATUS_LABELS } from './dataSubjectRequestLabels';
import type { DataSubjectRequest, DataSubjectRequestStatus } from './dataSubjectRequest.types';
import type { ServiceResult } from '@/types';
export type DataRequestAdminScope = {
    authUserId: string;
    tenantId: string;
    profileId: string;
};
export type DataRequestAdminAccess = {
    view: boolean;
    manage: boolean;
};
export type DataRequestAdminPage = {
    items: DataSubjectRequest[];
    hasMore: boolean;
    nextOffset: number;
    access: DataRequestAdminAccess;
};
const COLUMNS = 'id,tenant_id,profile_id,request_type,status,requester_name,requester_email,verification_notes,request_number,received_at,created_at,updated_at';
const PAGE_SIZE = 50;
const IDENTITY_ERROR = 'Die Anmeldung konnte nicht bestätigt werden. Bitte melden Sie sich erneut an.';
const ACCESS_ERROR = 'Für diese Betroffenenanfragen fehlt die Berechtigung.';
const LOAD_ERROR = 'Die Anfragen konnten nicht geladen werden. Bitte versuchen Sie es erneut.';
const SETUP_ERROR = 'Die geschützte Bearbeitung von Betroffenenanfragen ist noch nicht verfügbar.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Client = NonNullable<ReturnType<typeof getSupabaseClient>>;
type Rpc = (name: 'data_request_workspace_v1', args: {
    p_action: 'capabilities' | 'admin_update';
    p_payload: Record<string, string>;
}) => PromiseLike<{
    data: unknown;
    error: unknown;
}>;
function failure(error: string): {
    ok: false;
    error: string;
} { return { ok: false, error }; }
function record(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
async function confirmIdentity(scope: DataRequestAdminScope): Promise<ServiceResult<Client>> {
    if (!isDataSubjectRequestBackendReady())
        return failure(SETUP_ERROR);
    if (![scope.authUserId, scope.tenantId, scope.profileId].every(id => UUID.test(id)))
        return failure(IDENTITY_ERROR);
    const client = getSupabaseClient();
    if (!client)
        return failure(SETUP_ERROR);
    const auth = await client.auth.getUser();
    if (auth.error || auth.data.user?.id !== scope.authUserId)
        return failure(IDENTITY_ERROR);
    const profile = await resolveAuthenticatedProfileId(scope.tenantId);
    if (!profile.ok || profile.data !== scope.profileId)
        return failure(IDENTITY_ERROR);
    // A profile lookup may outlive a sign-out or account switch.
    const current = await client.auth.getUser();
    return !current.error && current.data.user?.id === scope.authUserId ? { ok: true, data: client } : failure(IDENTITY_ERROR);
}
async function authorize(scope: DataRequestAdminScope, manage = false): Promise<ServiceResult<{
    client: Client;
    access: DataRequestAdminAccess;
}>> {
    const identity = await confirmIdentity(scope);
    if (!identity.ok)
        return identity;
    // Narrow typing for the versioned RPC until remote generated types include it.
    const rpc = identity.data.rpc.bind(identity.data) as unknown as Rpc;
    const result = await rpc('data_request_workspace_v1', { p_action: 'capabilities', p_payload: {
            expected_auth_user_id: scope.authUserId, expected_tenant_id: scope.tenantId, expected_profile_id: scope.profileId,
        } });
    const body = record(result.data);
    const capabilities = record(body?.capabilities);
    if (result.error || body?.version !== 1 || !capabilities)
        return failure(SETUP_ERROR);
    const access = { view: capabilities.admin_view === true, manage: capabilities.admin_manage === true };
    if (!access.view || (manage && !access.manage))
        return failure(ACCESS_ERROR);
    const stillCurrent = await confirmIdentity(scope);
    return stillCurrent.ok ? { ok: true, data: { client: stillCurrent.data, access } } : stillCurrent;
}
function nullableString(value: unknown): string | null { return typeof value === 'string' ? value : null; }
export function parseDataRequestAdminRow(value: unknown, tenantId: string): DataSubjectRequest | null {
    const row = record(value);
    if (!row || typeof row.id !== 'string' || !UUID.test(row.id) || row.tenant_id !== tenantId ||
        typeof row.request_type !== 'string' || !Object.prototype.hasOwnProperty.call(DATA_REQUEST_TYPE_LABELS, row.request_type) ||
        typeof row.status !== 'string' || !Object.prototype.hasOwnProperty.call(DATA_SUBJECT_REQUEST_STATUS_LABELS, row.status) ||
        typeof row.created_at !== 'string' || !Number.isFinite(Date.parse(row.created_at)) ||
        typeof row.updated_at !== 'string' || !Number.isFinite(Date.parse(row.updated_at)))
        return null;
    return {
        id: row.id, tenantId, profileId: nullableString(row.profile_id),
        requestType: row.request_type as DataSubjectRequest['requestType'], status: row.status as DataSubjectRequestStatus,
        requesterName: nullableString(row.requester_name), requesterEmail: nullableString(row.requester_email),
        verificationNotes: nullableString(row.verification_notes), requestNumber: nullableString(row.request_number),
        receivedAt: nullableString(row.received_at), createdAt: row.created_at, updatedAt: row.updated_at,
    };
}
export async function listDataRequestsForAdmin(scope: DataRequestAdminScope, offset = 0): Promise<ServiceResult<DataRequestAdminPage>> {
    if (!Number.isSafeInteger(offset) || offset < 0)
        return failure(LOAD_ERROR);
    try {
        const allowed = await authorize(scope);
        if (!allowed.ok)
            return allowed;
        const { data, error } = await allowed.data.client.from('data_subject_requests').select(COLUMNS)
            .eq('tenant_id', scope.tenantId).order('created_at', { ascending: false }).order('id', { ascending: false })
            .range(offset, offset + PAGE_SIZE);
        if (error || !Array.isArray(data))
            return failure(LOAD_ERROR);
        const current = await authorize(scope);
        if (!current.ok)
            return current;
        const rows = data.slice(0, PAGE_SIZE).map(row => parseDataRequestAdminRow(row, scope.tenantId));
        if (rows.some(row => row === null))
            return failure('Einige Anfragen konnten nicht sicher zugeordnet werden. Bitte laden Sie die Liste erneut.');
        return { ok: true, data: { items: rows as DataSubjectRequest[], hasMore: data.length > PAGE_SIZE,
                nextOffset: offset + rows.length, access: current.data.access } };
    }
    catch {
        return failure(LOAD_ERROR);
    }
}
export async function updateDataRequestForAdmin(scope: DataRequestAdminScope, item: DataSubjectRequest, status: DataSubjectRequestStatus): Promise<ServiceResult<DataSubjectRequest>> {
    if (item.tenantId !== scope.tenantId || !UUID.test(item.id) || !Number.isFinite(Date.parse(item.updatedAt)) ||
        !Object.prototype.hasOwnProperty.call(DATA_SUBJECT_REQUEST_STATUS_LABELS, status))
        return failure(ACCESS_ERROR);
    try {
        const allowed = await authorize(scope, true);
        if (!allowed.ok)
            return allowed;
        const rpc = allowed.data.client.rpc.bind(allowed.data.client) as unknown as Rpc;
        const { data, error } = await rpc('data_request_workspace_v1', { p_action: 'admin_update', p_payload: {
                expected_auth_user_id: scope.authUserId, expected_tenant_id: scope.tenantId, expected_profile_id: scope.profileId,
                request_id: item.id, expected_status: item.status, expected_updated_at: item.updatedAt, new_status: status,
            } });
        if (record(error)?.code === '40001')
            return failure('Die Anfrage wurde zwischenzeitlich geändert oder ist nicht mehr zugänglich. Bitte aktualisieren Sie die Liste.');
        if (error)
            return failure('Der Status konnte nicht bestätigt werden. Aktualisieren Sie die Liste, bevor Sie es erneut versuchen.');
        const body = record(data);
        if (body?.version !== 1 || !body.item)
            return failure('Der neue Status konnte nicht bestätigt werden. Bitte aktualisieren Sie die Liste.');
        const current = await authorize(scope, true);
        if (!current.ok)
            return current;
        const saved = parseDataRequestAdminRow(body.item, scope.tenantId);
        return saved && saved.id === item.id && saved.status === status
            ? { ok: true, data: saved }
            : failure('Der neue Status konnte nicht bestätigt werden. Bitte aktualisieren Sie die Liste.');
    }
    catch {
        return failure('Der Status konnte nicht bestätigt werden. Bitte aktualisieren Sie die Liste.');
    }
}
function csvCell(value: string | null): string {
    const text = (value ?? '').replace(/\u0000/g, '');
    // Quote every field and neutralize spreadsheet formula prefixes, even after whitespace.
    const safe = /^[\s\u0000-\u001f\u007f]*[=+@-]/u.test(text) || /^[\t\r\n]/.test(text) ? "'" + text : text;
    return '"' + safe.replace(/"/g, '""') + '"';
}
export function buildDataRequestAdminCsv(items: readonly DataSubjectRequest[]): string {
    const header = ['Anfragenummer', 'Anfrage-ID', 'Art', 'Status', 'Name', 'E-Mail', 'Eingang', 'Zuletzt geändert'];
    const rows = items.map(item => [
        item.requestNumber, item.id, DATA_REQUEST_TYPE_LABELS[item.requestType],
        DATA_SUBJECT_REQUEST_STATUS_LABELS[item.status], item.requesterName, item.requesterEmail,
        item.receivedAt ?? item.createdAt, item.updatedAt,
    ]);
    return '\ufeff' + [header, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n');
}
export async function prepareDataRequestAdminCsv(scope: DataRequestAdminScope, items: readonly DataSubjectRequest[]): Promise<ServiceResult<{
    csv: string;
    rowCount: number;
}>> {
    try {
        const allowed = await authorize(scope);
        if (!allowed.ok)
            return allowed;
        if (items.some(item => item.tenantId !== scope.tenantId))
            return failure(ACCESS_ERROR);
        return { ok: true, data: { csv: buildDataRequestAdminCsv(items), rowCount: items.length } };
    }
    catch {
        return failure('Der CSV-Download konnte nicht vorbereitet werden. Bitte versuchen Sie es erneut.');
    }
}
export function downloadDataRequestAdminCsv(csv: string): Promise<void> { return shareNativeFile(csv, 'betroffenenanfragen-' + new Date().toISOString().slice(0, 10) + '.csv', 'text/csv'); }
