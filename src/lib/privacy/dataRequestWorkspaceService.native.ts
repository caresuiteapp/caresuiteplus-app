// Generated native presentation from src/lib/privacy/dataRequestWorkspaceService.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { shareNativeFile } from '@/lib/platform/nativeFileDelivery.native';
import type { ServiceResult } from '@/types';
import { getSupabaseClient } from "../supabase/client.ts";
import { isDemoMode } from '@/lib/supabase/config';
import { resolveAuthenticatedProfileId } from '@/lib/auth/resolveAuthenticatedProfile';
import type { DataRequestType, DataSubjectRequestStatus } from './dataSubjectRequest.types';
export type DataRequestWorkspaceResult<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: string;
    code?: 'unavailable' | 'identity' | 'invalid_response' | 'validation' | 'connection';
};
export type DataRequestWorkspaceScope = {
    authUserId: string;
    tenantId: string;
    profileId: string;
};
export type DataRequestWorkspaceType = 'access' | 'portability' | 'correction' | 'restriction' | 'objection';
export type DataRequestWorkspaceDraft = {
    requestType: DataRequestWorkspaceType;
    requesterName: string;
    requesterEmail: string;
    message: string;
};
export type DataRequestWorkspaceItem = {
    id: string;
    requestType: DataRequestType;
    status: DataSubjectRequestStatus;
    requestNumber: string | null;
    receivedAt: string | null;
    createdAt: string;
    updatedAt: string;
};
export type DataRequestWorkspacePage = {
    items: DataRequestWorkspaceItem[];
    hasMore: boolean;
    nextOffset: number | null;
};
export type DataRequestAccountSnapshot = {
    version: 1;
    generatedAt: string;
    account: {
        firstName: string | null;
        lastName: string | null;
        displayName: string | null;
        email: string | null;
        phone: string | null;
        createdAt: string | null;
        updatedAt: string | null;
    };
};
export type DataRequestAccountExportFormat = 'json' | 'csv';
export type DataRequestAccountExportFile = {
    fileName: string;
    mediaType: string;
    content: string;
};
const TYPES: readonly DataRequestWorkspaceType[] = ['access', 'portability', 'correction', 'restriction', 'objection'];
const ALL_TYPES: readonly DataRequestType[] = [...TYPES, 'export', 'deletion', 'consent_withdrawal', 'other'];
const STATUSES: readonly DataSubjectRequestStatus[] = ['queued', 'running', 'completed', 'failed', 'cancelled'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTITY_ERROR = 'Ihr angemeldetes Profil konnte nicht bestätigt werden. Bitte melden Sie sich erneut an.';
const BACKEND_ERROR = 'Datenauskunft ist momentan nicht erreichbar. Bitte versuchen Sie es erneut oder wenden Sie sich an den Support.';
const RESPONSE_ERROR = 'Die Antwort konnte nicht sicher zugeordnet werden. Bitte laden Sie die Seite neu.';
type WorkspaceClient = NonNullable<ReturnType<typeof getSupabaseClient>>;
type RpcResponse = {
    data: unknown;
    error: unknown;
};
type RecordValue = Record<string, unknown>;
function record(value: unknown): value is RecordValue {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function textOrNull(value: unknown): value is string | null {
    return value === null || typeof value === 'string';
}
function dateValue(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}
function optionalDate(value: unknown): value is string | null {
    return value === null || dateValue(value);
}
function errorCode(error: unknown): 'unavailable' | 'identity' | 'connection' | undefined {
    if (!record(error))
        return undefined;
    const code = String(error.code ?? '');
    if (code === 'PGRST202' || code === '42883')
        return 'unavailable';
    if (code === '42501')
        return 'identity';
    if (/network|fetch|offline|connection|timeout/i.test(String(error.message ?? '')))
        return 'connection';
    return undefined;
}
function friendlyError(error: unknown): string {
    const value = record(error) ? String(error.message ?? '') : '';
    const code = record(error) ? String(error.code ?? '') : '';
    if (code === 'PGRST202' || code === '42883')
        return BACKEND_ERROR;
    if (/idempotency|request_conflict/i.test(value)) {
        return 'Diese Anfrage wurde bereits mit anderen Angaben gespeichert. Bitte laden Sie die Anfragen neu, bevor Sie eine neue Anfrage einreichen.';
    }
    if (/network|fetch|offline|connection|timeout/i.test(value)) {
        return 'Die Verbindung ist unterbrochen. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut. Bei einer Einreichung können Sie denselben Versuch wiederholen.';
    }
    if (code === '42501' || /unauthorized|not authenticated|jwt|identity|not authorized/i.test(value))
        return IDENTITY_ERROR;
    return BACKEND_ERROR;
}
export function validateDataRequestWorkspaceDraft(draft: DataRequestWorkspaceDraft): ServiceResult<DataRequestWorkspaceDraft> {
    if (!draft || !TYPES.includes(draft.requestType) ||
        typeof draft.requesterName !== 'string' || typeof draft.requesterEmail !== 'string' || typeof draft.message !== 'string') {
        return { ok: false, error: 'Bitte wählen Sie eine gültige Anfrageart und prüfen Sie Ihre Angaben.' };
    }
    const value: DataRequestWorkspaceDraft = {
        requestType: draft.requestType,
        requesterName: draft.requesterName.trim(),
        requesterEmail: draft.requesterEmail.trim(),
        message: draft.message.replace(/\r\n?/g, '\n').trim(),
    };
    if (!value.requesterName || value.requesterName.length > 160) {
        return { ok: false, error: 'Bitte geben Sie Ihren Namen mit höchstens 160 Zeichen an.' };
    }
    if (value.requesterEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.requesterEmail)) {
        return { ok: false, error: 'Bitte geben Sie eine gültige E-Mail-Adresse an.' };
    }
    if (/[\u0000-\u001f\u007f]/.test(value.requesterName + value.requesterEmail) ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.message)) {
        return { ok: false, error: 'Bitte entfernen Sie unsichtbare Steuerzeichen aus Ihren Angaben.' };
    }
    if (value.message.length > 4000)
        return { ok: false, error: 'Ihre Nachricht darf höchstens 4.000 Zeichen enthalten.' };
    return { ok: true, data: value };
}
export function createDataRequestIdempotencyKey(): ServiceResult<string> {
    try {
        const cryptoApi = crypto;
        if (!cryptoApi)
            throw new Error('Unavailable');
        if (typeof cryptoApi.randomUUID === 'function') {
            const key = cryptoApi.randomUUID();
            if (!UUID.test(key))
                throw new Error('Invalid UUID');
            return { ok: true, data: key };
        }
        const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
        return { ok: true, data: [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-') };
    }
    catch {
        return { ok: false, error: 'Die Anfrage konnte nicht vorbereitet werden. Bitte öffnen Sie CareSuite über eine sichere Verbindung und laden Sie die Seite neu.' };
    }
}
async function confirmScope(scope: DataRequestWorkspaceScope): Promise<DataRequestWorkspaceResult<WorkspaceClient>> {
    if (isDemoMode())
        return { ok: false, error: 'Im Demo-Modus werden keine persönlichen Anfragen eingereicht oder Kontodaten exportiert.', code: 'unavailable' };
    if (!scope?.authUserId || !scope.tenantId || !scope.profileId)
        return { ok: false, error: IDENTITY_ERROR, code: 'identity' };
    const client = getSupabaseClient();
    if (!client)
        return { ok: false, error: BACKEND_ERROR, code: 'unavailable' };
    const first = await client.auth.getUser();
    if (first.error || first.data.user?.id !== scope.authUserId)
        return { ok: false, error: IDENTITY_ERROR, code: 'identity' };
    const resolved = await resolveAuthenticatedProfileId(scope.tenantId);
    if (!resolved.ok || resolved.data !== scope.profileId)
        return { ok: false, error: IDENTITY_ERROR, code: 'identity' };
    const current = await client.auth.getUser();
    if (current.error || current.data.user?.id !== scope.authUserId)
        return { ok: false, error: IDENTITY_ERROR, code: 'identity' };
    return { ok: true, data: client };
}
async function requestWorkspace(scope: DataRequestWorkspaceScope, action: 'list' | 'submit' | 'account_export', payload: RecordValue): Promise<DataRequestWorkspaceResult<RecordValue>> {
    try {
        const before = await confirmScope(scope);
        if (!before.ok)
            return before;
        const rpc = before.data as unknown as {
            rpc(name: string, args: RecordValue): PromiseLike<RpcResponse>;
        };
        const response = await rpc.rpc('data_request_workspace_v1', { p_action: action, p_payload: {
                ...payload,
                expected_auth_user_id: scope.authUserId,
                expected_tenant_id: scope.tenantId,
                expected_profile_id: scope.profileId,
            } });
        // A completed response must never populate a different user's current page.
        const after = await confirmScope(scope);
        if (!after.ok)
            return after;
        if (response.error)
            return { ok: false, error: friendlyError(response.error), code: errorCode(response.error) };
        if (!record(response.data) || response.data.version !== 1)
            return { ok: false, error: RESPONSE_ERROR, code: 'invalid_response' };
        return { ok: true, data: response.data };
    }
    catch (error) {
        return { ok: false, error: friendlyError(error), code: errorCode(error) };
    }
}
function mapItem(row: unknown): DataRequestWorkspaceItem | null {
    if (!record(row) || typeof row.id !== 'string' || !UUID.test(row.id) ||
        typeof row.request_type !== 'string' || !ALL_TYPES.includes(row.request_type as DataRequestType) ||
        typeof row.status !== 'string' || !STATUSES.includes(row.status as DataSubjectRequestStatus) ||
        !textOrNull(row.request_number) || !optionalDate(row.received_at) ||
        !dateValue(row.created_at) || !dateValue(row.updated_at))
        return null;
    // Explicit allowlist. In particular, verification_notes and result_summary
    // can contain staff-only content and must never enter the personal history.
    return {
        id: row.id,
        requestType: row.request_type as DataRequestType,
        status: row.status as DataSubjectRequestStatus,
        requestNumber: row.request_number,
        receivedAt: row.received_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
export async function listOwnDataRequests(scope: DataRequestWorkspaceScope, options: {
    offset?: number;
    limit?: number;
} = {}): Promise<DataRequestWorkspaceResult<DataRequestWorkspacePage>> {
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 20;
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
        return { ok: false, error: 'Die angeforderte Seite ist ungültig. Bitte laden Sie die Anfragen neu.' };
    }
    const result = await requestWorkspace(scope, 'list', { limit, offset });
    if (!result.ok)
        return result;
    if (!Array.isArray(result.data.items) || typeof result.data.has_more !== 'boolean' || result.data.items.length > limit) {
        return { ok: false, error: RESPONSE_ERROR, code: 'invalid_response' };
    }
    const mapped = result.data.items.map(mapItem);
    if (mapped.some(item => item === null))
        return { ok: false, error: RESPONSE_ERROR, code: 'invalid_response' };
    const items = mapped as DataRequestWorkspaceItem[];
    if (new Set(items.map(item => item.id)).size !== items.length || (result.data.has_more && items.length === 0)) {
        return { ok: false, error: RESPONSE_ERROR, code: 'invalid_response' };
    }
    return {
        ok: true,
        data: { items, hasMore: result.data.has_more, nextOffset: result.data.has_more ? offset + items.length : null },
    };
}
export async function submitOwnDataRequest(scope: DataRequestWorkspaceScope, input: DataRequestWorkspaceDraft & {
    idempotencyKey: string;
}): Promise<DataRequestWorkspaceResult<{
    request: DataRequestWorkspaceItem;
    replayed: boolean;
}>> {
    const valid = validateDataRequestWorkspaceDraft(input);
    if (!valid.ok)
        return { ...valid, code: 'validation' };
    if (!UUID.test(input.idempotencyKey))
        return { ok: false, error: 'Die Anfragekennung ist ungültig. Bitte beginnen Sie eine neue Anfrage.' };
    const draft = valid.data;
    const result = await requestWorkspace(scope, 'submit', {
        idempotency_key: input.idempotencyKey,
        request_type: draft.requestType,
        requester_name: draft.requesterName,
        requester_email: draft.requesterEmail,
        message: draft.message,
    });
    if (!result.ok)
        return result;
    const request = mapItem(result.data.item);
    if (!request || request.requestType !== draft.requestType || typeof result.data.replayed !== 'boolean') {
        return { ok: false, error: RESPONSE_ERROR, code: 'invalid_response' };
    }
    return { ok: true, data: { request, replayed: result.data.replayed } };
}
export async function fetchOwnAccountExport(scope: DataRequestWorkspaceScope): Promise<DataRequestWorkspaceResult<DataRequestAccountSnapshot>> {
    const result = await requestWorkspace(scope, 'account_export', {});
    if (!result.ok)
        return result;
    const row = result.data.account;
    if (!dateValue(result.data.generated_at) || !record(row) ||
        !['first_name', 'last_name', 'display_name', 'email', 'phone'].every(key => textOrNull(row[key])) ||
        !optionalDate(row.created_at) || !optionalDate(row.updated_at))
        return { ok: false, error: RESPONSE_ERROR, code: 'invalid_response' };
    return {
        ok: true,
        data: {
            version: 1,
            generatedAt: result.data.generated_at,
            account: {
                firstName: row.first_name as string | null,
                lastName: row.last_name as string | null,
                displayName: row.display_name as string | null,
                email: row.email as string | null,
                phone: row.phone as string | null,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            },
        },
    };
}
function csvCell(raw: string | null): string {
    let value = raw ?? '';
    // Spreadsheet apps can execute a formula even inside quoted CSV cells.
    if (/^[\s\uFEFF]*[=+\-@]/u.test(value) || /^[\t\r\n]/.test(value))
        value = "'" + value;
    return '"' + value.replace(/"/g, '""') + '"';
}
/** Limited account-data copy; never a complete Art. 15 response or document archive. */
export function buildDataRequestAccountExportFile(snapshot: DataRequestAccountSnapshot, format: DataRequestAccountExportFormat): ServiceResult<DataRequestAccountExportFile> {
    if (!snapshot || snapshot.version !== 1 || !dateValue(snapshot.generatedAt) || !record(snapshot.account)) {
        return { ok: false, error: 'Die Kontodaten sind ungültig. Bitte laden Sie sie erneut.' };
    }
    const account = snapshot.account;
    if (!['firstName', 'lastName', 'displayName', 'email', 'phone'].every(key => textOrNull(account[key as keyof typeof account])) ||
        !optionalDate(account.createdAt) || !optionalDate(account.updatedAt)) {
        return { ok: false, error: 'Die Kontodaten sind ungültig. Bitte laden Sie sie erneut.' };
    }
    const safeAccount = {
        firstName: account.firstName, lastName: account.lastName, displayName: account.displayName,
        email: account.email, phone: account.phone, createdAt: account.createdAt, updatedAt: account.updatedAt,
    };
    const date = new Date(snapshot.generatedAt).toISOString().slice(0, 10);
    const scope = 'Kopie der gespeicherten Profil- und Kontaktdaten dieses Kontos.';
    const excluded = 'Keine vollständige Datenauskunft: Anfragen, Fachakten, Gesundheitsdaten, Nachrichten und Anhänge sind nicht enthalten.';
    if (format === 'json') {
        return {
            ok: true,
            data: {
                fileName: 'caresuite-kontodaten-' + date + '.json',
                mediaType: 'application/json;charset=utf-8',
                content: JSON.stringify({
                    format: 'caresuite-account-data', version: 1, generatedAt: snapshot.generatedAt,
                    scope, excluded, completeDataSubjectAccessResponse: false, account: safeAccount,
                }, null, 2),
            },
        };
    }
    if (format !== 'csv')
        return { ok: false, error: 'Bitte wählen Sie JSON oder CSV als Dateiformat.' };
    const rows: Array<Array<string | null>> = [
        ['Bereich', 'Feld', 'Wert'],
        ['Export', 'Erstellt am', snapshot.generatedAt],
        ['Export', 'Umfang', scope],
        ['Export', 'Nicht enthalten', excluded],
        ['Konto', 'Vorname', account.firstName],
        ['Konto', 'Nachname', account.lastName],
        ['Konto', 'Anzeigename', account.displayName],
        ['Konto', 'E-Mail', account.email],
        ['Konto', 'Telefon', account.phone],
        ['Konto', 'Konto erstellt am', account.createdAt],
        ['Konto', 'Zuletzt geändert am', account.updatedAt],
    ];
    return {
        ok: true,
        data: {
            fileName: 'caresuite-kontodaten-' + date + '.csv',
            mediaType: 'text/csv;charset=utf-8',
            content: '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n',
        },
    };
}
/** Starts a browser download; a successful click does not prove the user saved the file. */
export async function downloadDataRequestAccountExport(snapshot: DataRequestAccountSnapshot, format: DataRequestAccountExportFormat): Promise<ServiceResult<{
    fileName: string;
}>> { const file = buildDataRequestAccountExportFile(snapshot, format); if (!file.ok)
    return file; try {
    await shareNativeFile(file.data.content, file.data.fileName, file.data.mediaType);
    return { ok: true, data: { fileName: file.data.fileName } };
}
catch {
    return { ok: false, error: 'Die Datei konnte nicht an Android übergeben werden. Bitte erneut versuchen.' };
} }
