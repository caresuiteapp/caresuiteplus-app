// Generated native presentation from src/lib/clients/clientRecordNativeWrites.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { RoleKey } from '@/types/core/auth';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { ClientFullDetail } from '@/types/modules/client';
import type { ClientRecordView } from './clientRecordService';
import type { ClientParentReadScope } from "./clientRecordRead.native.ts";
import { captureClientParentDetail, captureClientParentRecord } from "./clientRecordRead.native.ts";
import { woundUuid } from '../pflege/woundCareDomain.ts';
import { getSupabaseClient } from "../supabase/client.ts";
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { enforcePermission } from '@/lib/permissions';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';
import { resolveOfficeDocumentTitle } from '@/lib/office/officeDocumentDisplay';
import { REMOTE_CLIENT_DELETED_STATUS } from '@/lib/services/clients/clientStatusBridge';
export type ClientNativeWriteAction = 'recovery' | 'delete' | 'archive';
export type ClientNativeOriginalReceipt = Readonly<{
    scopeKey: string;
    owner: object;
    recordTicket: number;
    fullTicket: number;
    record: ClientRecordView;
    full: ClientFullDetail;
    scope: ClientParentReadScope;
}>;
/** The caller supplies its live original-read accessor AND current minted action ticket.
 * `allowed` must reflect the current action-specific runtime right, not a signature,
 * a static role alone or a retained render closure. No server authorization is implied.
 * This adapter has no edit-modal implementation or existing UI integration. */
export type ClientNativeWriteAuthority = Readonly<{
    original: ClientNativeOriginalReceipt;
    action: ClientNativeWriteAction;
    actionTicket: object;
    allowed: boolean;
}>;
export type ClientNativeWriteLease = Readonly<{
    action: ClientNativeWriteAction;
}>;
export type ClientNativeWriteStep = Readonly<{
    name: string;
    kind: 'read' | 'write';
    outcome: 'acknowledged' | 'failed' | 'unresolved';
}>;
export type ClientNativeWriteOutcome = Readonly<{
    status: 'blocked' | 'uncertain' | 'acknowledged';
    writeStarted: boolean;
    steps: readonly ClientNativeWriteStep[];
    currentAtReturn: boolean;
    error?: string;
}>;
type Row = Record<string, unknown>;
type NativeResult = {
    data?: unknown;
    error: unknown;
    count?: unknown;
};
type NativeQuery = PromiseLike<NativeResult> & {
    select(columns: string, options?: {
        count: 'exact';
        head: true;
    }): NativeQuery;
    eq(column: string, value: unknown): NativeQuery;
    not(column: string, operator: string, value: string): NativeQuery;
    limit(count: number): NativeQuery;
    single(): NativeQuery;
    maybeSingle(): NativeQuery;
    upsert(payload: Row, options: {
        onConflict: string;
    }): NativeQuery;
    insert(payload: Row): NativeQuery;
    update(payload: Row): NativeQuery;
};
type NativeDb = {
    from(table: string): NativeQuery;
};
type Entry = {
    action: ClientNativeWriteAction;
    original: ClientNativeOriginalReceipt;
    actionTicket: object;
    readCurrent: () => ClientNativeWriteAuthority | null;
    lifetime: object;
    ownerKey: string;
    used: boolean;
};
type Attempt = {
    entry: Entry;
    db: NativeDb;
    started: boolean;
    complete: boolean;
    steps: ClientNativeWriteStep[];
};
const blockedScope = 'Die ursprüngliche eigene Akte und aktuelle Aktionsberechtigung sind nicht mehr bestätigt.';
const archiveBlock = 'Direkte Archivierung ist gesperrt. Bitte „Kündigung & Offboarding“ verwenden.';
const unresolved = 'Der begonnene native Schreibablauf ist nicht vollständig bestätigt. Nicht automatisch erneut ausführen.';
const object = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function own(value: unknown, key: string): unknown {
    if (!value || typeof value !== 'object')
        return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}
function clone(value: unknown, seen = new Set<object>()): unknown {
    if (value === null || value === undefined || typeof value === 'string' || typeof value === 'boolean'
        || typeof value === 'number' && Number.isFinite(value))
        return value;
    if ((!object(value) && !(Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype)) || seen.has(value as object)) {
        throw Error('Die ganze ursprüngliche Eingabe ist nicht verlustfrei als DTO lesbar.');
    }
    seen.add(value as object);
    const result: Row | unknown[] = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
    for (const key of Reflect.ownKeys(value as object)) {
        if (Array.isArray(value) && key === 'length')
            continue;
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        if (typeof key !== 'string' || !('value' in descriptor) || !descriptor.enumerable
            || Array.isArray(value) && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)) {
            throw Error('Die ganze ursprüngliche Eingabe enthält ungeklärte Felder.');
        }
        Object.defineProperty(result, key, { value: clone(descriptor.value, seen), enumerable: true, writable: true, configurable: true });
    }
    if (Array.isArray(value))
        for (let i = 0; i < value.length; i++)
            if (!Object.hasOwn(value, i))
                throw Error('Die ursprüngliche Eingabe ist lückenhaft.');
    seen.delete(value as object);
    return result;
}
function freeze(value: unknown): void {
    if (!value || typeof value !== 'object')
        return;
    for (const key of Object.keys(value))
        freeze((value as Row)[key]);
    Object.freeze(value);
}
function frozenOriginal(value: unknown, seen = new Set<object>()): boolean {
    if (!value || typeof value !== 'object')
        return true;
    if (!Object.isFrozen(value) || seen.has(value))
        return false;
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        if (!('value' in descriptor) || !frozenOriginal(descriptor.value, seen))
            return false;
    }
    seen.delete(value);
    return true;
}
function captureForm(input: ClientIntakeFormData): ClientIntakeFormData {
    const form = clone(input);
    if (!object(form) || !Array.isArray(form.intakeDocuments) || typeof form.intakeContractType !== 'string'
        || typeof form.intakeAssignmentEnabled !== 'boolean')
        throw Error('Die ganze ursprüngliche Dokumenteneingabe ist nicht bestätigt.');
    const keys = new Set<string>();
    for (const doc of form.intakeDocuments) {
        if (!object(doc) || typeof doc.templateKey !== 'string' || !doc.templateKey || keys.has(doc.templateKey)
            || !['privacy_consent', 'assignment_declaration', 'client_contract', 'additional_consent'].includes(String(doc.documentType))
            || !['not_started', 'preview_open', 'pending_signature', 'signed', 'declined', 'skipped_optional', 'finalized', 'revoked', 'replaced'].includes(String(doc.status))
            || typeof doc.title !== 'string' || typeof doc.isRequired !== 'boolean' || !Number.isInteger(doc.version) || Number(doc.version) < 1
            || !['system', 'tenant'].includes(String(doc.source)) || !Array.isArray(doc.missingPlaceholders)
            || !doc.missingPlaceholders.every(v => typeof v === 'string') || !object(doc.signatures))
            throw Error('Ein ursprüngliches Intake-Dokument ist nicht vollständig bestätigt.');
        keys.add(doc.templateKey);
        for (const key of ['previewHtml', 'finalizedHtml', 'renderedPdfPath', 'previewOpenedAt', 'finalizedAt']) {
            if (!Object.hasOwn(doc, key) || doc[key] !== null && typeof doc[key] !== 'string')
                throw Error('Ein ursprüngliches Dokumentfeld ist nicht bestätigt.');
        }
        if (doc.tenantTemplateId !== undefined && doc.tenantTemplateId !== null && !woundUuid(doc.tenantTemplateId))
            throw Error('Die ursprüngliche native Vorlagenkennung ist nicht bestätigt.');
        for (const [role, signature] of Object.entries(doc.signatures)) {
            if (signature === undefined || signature === null)
                continue;
            if (!['client', 'employee', 'legal_representative'].includes(role) || !object(signature)
                || signature.role !== role || typeof signature.dataUrl !== 'string' || typeof signature.signedAt !== 'string'
                || signature.signerName !== undefined && signature.signerName !== null && typeof signature.signerName !== 'string') {
                throw Error('Eine ursprüngliche Signatur ist nicht verlustfrei bestätigt.');
            }
        }
    }
    freeze(form);
    return form as unknown as ClientIntakeFormData;
}
function sameOriginal(a: ClientNativeOriginalReceipt, b: ClientNativeOriginalReceipt): boolean {
    return own(a, 'scopeKey') === own(b, 'scopeKey') && own(a, 'owner') === own(b, 'owner')
        && own(a, 'recordTicket') === own(b, 'recordTicket') && own(a, 'fullTicket') === own(b, 'fullTicket')
        && own(a, 'record') === own(b, 'record') && own(a, 'full') === own(b, 'full')
        && ['key', 'tenantId', 'clientId', 'actorId', 'role'].every(key => own(own(a, 'scope'), key) === own(own(b, 'scope'), key));
}
function nativeId(result: NativeResult): string {
    const id = own(own(result, 'data'), 'id');
    if (!woundUuid(id))
        throw Error('Die zurückgegebene ursprüngliche native Zeilenkennung ist nicht bestätigt.');
    return id as string;
}
function permission(action: ClientNativeWriteAction) {
    return action === 'recovery' ? 'office.clients.edit' as const
        : action === 'delete' ? 'office.clients.delete' as const : 'office.clients.archive' as const;
}
/** One controller per mounted private parent. Preserve it across auth/read changes.
 * No release/retry/rollback API exists for an uncertain mutation. Its journal is local;
 * it is not persistent idempotency, an affected-row proof or a multi-request transaction. */
export class ClientRecordNativeWrites {
    private alive = true;
    private lifetime: object = {};
    private entries = new WeakMap<ClientNativeWriteLease, Entry>();
    private outcomes = new WeakMap<ClientNativeWriteOutcome, Attempt>();
    private unstartedInvocations = new WeakMap<ClientNativeWriteOutcome, Entry>();
    private journal = new Map<string, {
        original: ClientNativeOriginalReceipt;
        action: ClientNativeWriteAction;
        outcome: ClientNativeWriteOutcome;
    }>();
    private flight: Attempt | null = null;
    mount(): void { if (!this.alive) {
        this.alive = true;
        this.lifetime = {};
    } }
    dispose(): void { this.alive = false; }
    /** Recheck at the actual follow-up boundary; currentAtReturn is only a snapshot.
     * Neither a retained boolean nor an outcome minted by another controller grants UI access. */
    mayFollowup(lease: ClientNativeWriteLease, outcome: ClientNativeWriteOutcome): boolean {
        const attempt = this.outcomes.get(outcome);
        return !!attempt?.complete && this.entries.get(lease) === attempt.entry && this.current(attempt.entry, attempt.db);
    }
    /** Recognize only this controller's completed attempt which never began a native
     * mutation. This grants no acknowledgement, current read or follow-up authority. */
    isOwnUnstarted(lease: ClientNativeWriteLease, outcome: ClientNativeWriteOutcome): boolean {
        const attempt = this.outcomes.get(outcome), entry = this.entries.get(lease);
        const ownEntry = attempt?.entry ?? this.unstartedInvocations.get(outcome);
        if (!this.alive || !entry || ownEntry !== entry || entry.lifetime !== this.lifetime
            || !entry.used || attempt?.started || attempt?.complete || this.flight || outcome.status !== 'blocked'
            || outcome.writeStarted !== false)
            return false;
        const previous = this.journal.get(entry.ownerKey);
        return !previous || previous.outcome.status !== 'uncertain' && previous.action !== 'delete'
            && !sameOriginal(previous.original, entry.original);
    }
    capture(readCurrent: () => ClientNativeWriteAuthority | null): ClientNativeWriteLease | null {
        try {
            const source = readCurrent();
            if (!source || !['recovery', 'delete', 'archive'].includes(own(source, 'action') as string)
                || own(source, 'allowed') !== true || !own(source, 'actionTicket') || typeof own(source, 'actionTicket') !== 'object')
                return null;
            const original = own(source, 'original') as ClientNativeOriginalReceipt;
            const scope = clone(own(original, 'scope')) as ClientParentReadScope;
            if (!object(scope) || own(original, 'scopeKey') !== scope.key || !own(original, 'owner') || typeof own(original, 'owner') !== 'object'
                || !Number.isSafeInteger(own(original, 'recordTicket')) || Number(own(original, 'recordTicket')) < 1
                || !Number.isSafeInteger(own(original, 'fullTicket')) || Number(own(original, 'fullTicket')) < 1
                || !frozenOriginal(own(original, 'record')) || !frozenOriginal(own(original, 'full')))
                return null;
            captureClientParentRecord(own(original, 'record'), scope);
            captureClientParentDetail(own(original, 'full'), scope);
            const captured = Object.freeze({ scopeKey: original.scopeKey, owner: original.owner, recordTicket: original.recordTicket,
                fullTicket: original.fullTicket, record: original.record, full: original.full, scope: Object.freeze({ ...scope }) });
            const entry: Entry = { action: source.action, original: captured, actionTicket: source.actionTicket,
                readCurrent, lifetime: this.lifetime, ownerKey: JSON.stringify([scope.tenantId, scope.clientId, scope.actorId, scope.role]), used: false };
            if (!this.current(entry))
                return null;
            const lease = Object.freeze({ action: entry.action });
            this.entries.set(lease, entry);
            return lease;
        }
        catch {
            return null;
        }
    }
    private current(entry: Entry, db?: NativeDb): boolean {
        try {
            if (!this.alive || entry.lifetime !== this.lifetime || getServiceMode() !== 'supabase'
                || entry.original.scope.tenantId === DEMO_TENANT_ID || guardServiceTenant(entry.original.scope.tenantId))
                return false;
            const source = entry.readCurrent();
            if (!source || own(source, 'action') !== entry.action || own(source, 'actionTicket') !== entry.actionTicket
                || own(source, 'allowed') !== true || !sameOriginal(entry.original, own(source, 'original') as ClientNativeOriginalReceipt))
                return false;
            const scope = own(own(source, 'original'), 'scope') as ClientParentReadScope;
            if (own(scope, 'canRead') !== true || entry.action === 'recovery' && own(scope, 'canEdit') !== true
                || enforcePermission(scope.role as RoleKey, permission(entry.action)))
                return false;
            return !db || getSupabaseClient() as unknown === db;
        }
        catch {
            return false;
        }
    }
    private outcome(attempt: Attempt | null, error?: string): ClientNativeWriteOutcome {
        const steps = Object.freeze((attempt?.steps ?? []).map(step => Object.freeze({ ...step })));
        const outcome: ClientNativeWriteOutcome = Object.freeze({ status: attempt?.complete ? 'acknowledged' : attempt?.started ? 'uncertain' : 'blocked',
            writeStarted: attempt?.started ?? false, steps, currentAtReturn: !!attempt?.complete && this.current(attempt.entry, attempt.db),
            ...(error ? { error } : {}) });
        if (attempt)
            this.outcomes.set(outcome, attempt);
        return outcome;
    }
    private async step(attempt: Attempt, name: string, kind: 'read' | 'write', work: () => NativeQuery, terminal = false): Promise<NativeResult> {
        if (!this.current(attempt.entry, attempt.db))
            throw Error(blockedScope);
        const index = attempt.steps.length;
        attempt.steps.push({ name, kind, outcome: 'unresolved' });
        let result: NativeResult;
        try {
            const query = work();
            result = await new Promise<NativeResult>((resolve, reject) => {
                // Invoke the native thenable synchronously. Awaiting it directly would
                // defer dispatch until after this current-authority check.
                if (!this.current(attempt.entry, attempt.db))
                    throw Error(blockedScope);
                if (kind === 'write')
                    attempt.started = true;
                query.then(resolve, reject);
            });
        }
        catch {
            this.current(attempt.entry, attempt.db);
            throw Error(unresolved);
        }
        const error = object(result) ? Object.getOwnPropertyDescriptor(result, 'error') : undefined;
        if (!error || !('value' in error) || error.value !== null) {
            attempt.steps[index] = { name, kind, outcome: error && 'value' in error && error.value ? 'failed' : 'unresolved' };
            this.current(attempt.entry, attempt.db);
            throw Error(error && 'value' in error && error.value ? toGermanSupabaseError(error.value) : unresolved);
        }
        attempt.steps[index] = { name, kind, outcome: 'acknowledged' };
        if (terminal && kind === 'write')
            attempt.complete = true;
        // Record the actual acknowledgement first. A current-scope loss cannot undo the
        // final SDK acknowledgement; it only prevents later steps and follow-up UI.
        const current = this.current(attempt.entry, attempt.db);
        if (!current && !attempt.complete)
            throw Error(blockedScope);
        return result;
    }
    private async run(lease: ClientNativeWriteLease, action: ClientNativeWriteAction, work: (attempt: Attempt) => Promise<void>): Promise<ClientNativeWriteOutcome> {
        const entry = this.entries.get(lease);
        if (!entry || entry.action !== action || entry.used || this.flight || !this.alive || entry.lifetime !== this.lifetime)
            return this.outcome(null, blockedScope);
        const previous = this.journal.get(entry.ownerKey);
        if (previous && (previous.outcome.status === 'uncertain' || previous.action === 'delete' || sameOriginal(previous.original, entry.original))) {
            return this.outcome(null, unresolved);
        }
        entry.used = true;
        const unstarted = (error: string) => {
            const result = this.outcome(null, error);
            this.unstartedInvocations.set(result, entry);
            return result;
        };
        if (!this.current(entry))
            return unstarted(blockedScope);
        if (action === 'archive')
            return unstarted(archiveBlock);
        const db = getSupabaseClient() as unknown as NativeDb | null;
        if (!db || !this.current(entry, db))
            return unstarted(blockedScope);
        const attempt: Attempt = { entry, db, started: false, complete: false, steps: [] };
        this.flight = attempt;
        let error: string | undefined;
        try {
            await work(attempt);
        }
        catch (cause) {
            error = cause instanceof Error ? cause.message : unresolved;
        }
        const result = this.outcome(attempt, error);
        if (attempt.started)
            this.journal.set(entry.ownerKey, { original: entry.original, action, outcome: result });
        this.flight = null;
        return result;
    }
    archive(lease: ClientNativeWriteLease): Promise<ClientNativeWriteOutcome> {
        return this.run(lease, 'archive', async () => { });
    }
    delete(lease: ClientNativeWriteLease, actorDisplayName?: string | null): Promise<ClientNativeWriteOutcome> {
        const capturedName = typeof actorDisplayName === 'string' ? actorDisplayName.trim() || 'System' : 'System';
        return this.run(lease, 'delete', async (attempt) => {
            const { tenantId, clientId, actorId } = attempt.entry.original.scope, db = attempt.db;
            const client = await this.step(attempt, 'clients.status', 'read', () => db.from('clients').select('status').eq('tenant_id', tenantId).eq('id', clientId).maybeSingle());
            const status = own(own(client, 'data'), 'status');
            if (typeof status !== 'string' || !status)
                throw Error('Der ursprüngliche native Klientenstatus ist nicht bestätigt.');
            const offboarding = await this.step(attempt, 'offboarding.guard', 'read', () => db.from('client_offboarding_cases').select('id,status').eq('tenant_id', tenantId).eq('client_id', clientId).limit(1).maybeSingle());
            const offboardingRow = own(offboarding, 'data');
            if (offboardingRow !== null && !woundUuid(own(offboardingRow, 'id')))
                throw Error('Die native Offboarding-Prüfung ist nicht bestätigt.');
            // An already soft-deleted native row must retain its first deleted_at and
            // original history/audit; do not issue another deletion mutation for it.
            if (offboardingRow !== null || ['inactive', 'archived', 'deceased', REMOTE_CLIENT_DELETED_STATUS].includes(status.toLowerCase())) {
                throw Error('Ehemalige oder im Offboarding befindliche Klient:innen werden nicht gelöscht. Die Klient:innenakte bleibt revisionssicher erhalten.');
            }
            const assignments = await this.step(attempt, 'assignments.guard', 'read', () => db.from('assignments').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).not('status', 'in', '("completed","cancelled","no_show")').eq('client_id', clientId));
            const count = own(assignments, 'count');
            if (!Number.isSafeInteger(count) || Number(count) < 0)
                throw Error('Die native Einsatzanzahl ist nicht bestätigt.');
            if (Number(count) > 0)
                throw Error('Einsätze vorhanden — bitte zuerst archivieren.');
            await this.step(attempt, 'clients.softDelete', 'write', () => db.from('clients').update({ status: 'deleted', deleted_at: new Date().toISOString(), updated_by: actorId }).eq('id', clientId).eq('tenant_id', tenantId));
            await this.step(attempt, 'client_history_entries.insert', 'write', () => db.from('client_history_entries').insert({
                tenant_id: tenantId, client_id: clientId, icon: '🗑️', title: 'Klient:in gelöscht', subtitle: null,
                status: 'archiviert', actor_name: capturedName, created_at: new Date().toISOString(),
            }));
            await this.step(attempt, 'client_audit_entries.insert', 'write', () => db.from('client_audit_entries').insert({
                tenant_id: tenantId, client_id: clientId, action: 'Klient:in gelöscht', actor_name: capturedName,
                details: 'Soft-Löschung (falsch angelegt)', created_at: new Date().toISOString(),
            }), true);
        });
    }
    recover(lease: ClientNativeWriteLease, input: ClientIntakeFormData): Promise<ClientNativeWriteOutcome> {
        return this.run(lease, 'recovery', async (attempt) => {
            const form = captureForm(input);
            const { tenantId, clientId, actorId } = attempt.entry.original.scope, db = attempt.db;
            // Match the shared repository's preflight. A recovery form is not authority
            // to replace a signed original or submit a fresh signature capture.
            const retained = await this.step(attempt, 'client_intake_documents.existing', 'read', () => db.from('client_intake_documents')
                .select('id, template_key, status, preview_html, finalized_html, rendered_pdf_path, finalized_at, updated_at').eq('tenant_id', tenantId).eq('client_id', clientId));
            const rows = own(retained, 'data');
            if (!Array.isArray(rows))
                throw Error('Die gespeicherten ursprünglichen Dokumentfassungen sind nicht bestätigt.');
            const existingByKey = new Map<string, Row>();
            for (const row of rows) {
                if (!object(row) || !woundUuid(own(row, 'id')) || typeof own(row, 'template_key') !== 'string' || !own(row, 'template_key') || existingByKey.has(own(row, 'template_key') as string)
                    || typeof own(row, 'status') !== 'string' || typeof own(row, 'updated_at') !== 'string' || !own(row, 'updated_at')
                    || ['preview_html', 'finalized_html', 'rendered_pdf_path', 'finalized_at'].some(key => own(row, key) !== null && typeof own(row, key) !== 'string'))
                    throw Error('Gespeicherte ursprüngliche Dokumentfassungen sind unvollständig oder doppelt.');
                existingByKey.set(own(row, 'template_key') as string, clone(row) as Row);
            }
            for (const doc of form.intakeDocuments) {
                const existing = existingByKey.get(doc.templateKey), captures = Object.values(doc.signatures).some(signature => signature?.dataUrl);
                const finalClaim = doc.status === 'signed' || doc.status === 'finalized' || Boolean(doc.finalizedAt || doc.finalizedHtml);
                const preserved = existing && (existing.status === 'finalized' || existing.finalized_at) && Boolean((existing.finalized_html as string | null)?.trim() || (existing.preview_html as string | null)?.trim() || (existing.rendered_pdf_path as string | null)?.trim());
                if (captures || (finalClaim && !preserved))
                    throw Error('Signierte Aufnahmeunterlagen benötigen den verifizierten atomaren Serverabschluss. Das vorhandene Original bleibt erhalten.');
            }
            const documentsToSave: ClientIntakeFormData['intakeDocuments'] = [];
            for (const doc of form.intakeDocuments) {
                const existing = existingByKey.get(doc.templateKey), savedContent = (existing?.finalized_html as string | null)?.trim() || (existing?.preview_html as string | null)?.trim() || (existing?.rendered_pdf_path as string | null)?.trim();
                const incomingContent = doc.finalizedHtml?.trim() || doc.previewHtml?.trim() || doc.renderedPdfPath?.trim();
                if (savedContent && existing && ['revoked', 'replaced'].includes(doc.status)) {
                    documentsToSave.push({ ...doc, previewHtml: existing.preview_html as string | null, finalizedHtml: existing.finalized_html as string | null, renderedPdfPath: existing.rendered_pdf_path as string | null, finalizedAt: existing.finalized_at as string | null });
                    continue;
                }
                if (savedContent && (existing?.status === 'finalized' || existing?.finalized_at || !incomingContent || (['signed', 'pending_signature'].includes(String(existing?.status ?? '')) && ['not_started', 'preview_open'].includes(doc.status))))
                    continue;
                if (['finalized', 'signed', 'pending_signature'].includes(doc.status) && !incomingContent)
                    throw Error('„' + doc.title + '“ kann ohne Dokumentinhalt nicht gespeichert werden. Bitte die Vorschau erneut öffnen.');
                documentsToSave.push(doc);
            }
            if (!documentsToSave.length) {
                if (!this.current(attempt.entry, db))
                    throw Error(blockedScope);
                attempt.complete = true;
                return;
            }
            const promoted = documentsToSave.filter(doc => Boolean(doc.finalizedHtml || doc.previewHtml) && (doc.status === 'finalized' || doc.status === 'signed' || doc.status === 'pending_signature' && Boolean(doc.signatures.client?.dataUrl)));
            if (form.intakeContractType)
                await this.step(attempt, 'client_contract_selection.upsert', 'write', () => db.from('client_contract_selection').upsert({ tenant_id: tenantId, client_id: clientId, contract_type: form.intakeContractType,
                    selected_template_key: form.intakeDocuments.find(doc => doc.documentType === 'client_contract')?.templateKey ?? null, updated_by: actorId }, { onConflict: 'tenant_id,client_id' }).select('id').single());
            for (const doc of documentsToSave) {
                const existing = existingByKey.get(doc.templateKey), patch = { tenant_id: tenantId, client_id: clientId, template_key: doc.templateKey, document_type: doc.documentType, title: doc.title,
                    status: doc.status, is_required: doc.isRequired, version: doc.version, source: doc.source, tenant_template_id: doc.tenantTemplateId, preview_html: doc.previewHtml, finalized_html: doc.finalizedHtml,
                    rendered_pdf_path: doc.renderedPdfPath, missing_placeholders: doc.missingPlaceholders, preview_opened_at: doc.previewOpenedAt, finalized_at: doc.finalizedAt, updated_at: new Date().toISOString(), updated_by: actorId };
                const saved = await this.step(attempt, existing ? 'client_intake_documents.update' : 'client_intake_documents.insert', 'write', () => existing
                    ? db.from('client_intake_documents').update(patch).eq('id', existing.id).eq('tenant_id', tenantId).eq('client_id', clientId).eq('updated_at', existing.updated_at).select('id').maybeSingle()
                    : db.from('client_intake_documents').insert(patch).select('id').single());
                const documentId = nativeId(saved);
                await this.step(attempt, 'client_document_events.insert', 'write', () => db.from('client_document_events').insert({ tenant_id: tenantId, client_id: clientId, document_id: documentId,
                    event_type: doc.status === 'finalized' ? 'document_finalized' : 'document_updated', summary: doc.title + ': ' + doc.status, actor_profile_id: actorId }));
                for (const [role, signature] of Object.entries(doc.signatures)) {
                    if (!signature?.dataUrl)
                        continue;
                    await this.step(attempt, 'client_document_signatures.upsert', 'write', () => db.from('client_document_signatures').upsert({ tenant_id: tenantId, client_id: clientId, document_id: documentId,
                        signer_role: role, signature_data: signature.dataUrl, signed_at: signature.signedAt, signer_name: signature.signerName ?? null }, { onConflict: 'document_id,signer_role' }).select('id').single());
                }
            }
            const effectiveState = (doc: ClientIntakeFormData['intakeDocuments'][number] | undefined, templateKey?: string) => {
                const existing = existingByKey.get(doc?.templateKey ?? templateKey ?? '');
                return existing && (!doc || !documentsToSave.includes(doc)) ? { status: existing.status, finalizedAt: existing.finalized_at } : doc;
            };
            const privacy = effectiveState(form.intakeDocuments.find(doc => doc.templateKey === 'privacy_consent_default'), 'privacy_consent_default'), contract = effectiveState(form.intakeDocuments.find(doc => doc.documentType === 'client_contract')), assignment = effectiveState(form.intakeDocuments.find(doc => doc.templateKey === 'assignment_declaration_care_health_insurance'), 'assignment_declaration_care_health_insurance');
            await this.step(attempt, 'client_consent_status.upsert', 'write', () => db.from('client_consent_status').upsert({ tenant_id: tenantId, client_id: clientId, privacy_status: privacy?.status ?? 'not_started', contract_status: contract?.status ?? 'not_started',
                assignment_status: assignment?.status ?? (form.intakeAssignmentEnabled ? 'not_started' : 'skipped_optional'), privacy_finalized_at: privacy?.finalizedAt ?? null, contract_finalized_at: contract?.finalizedAt ?? null, updated_by: actorId }, { onConflict: 'tenant_id,client_id' }).select('id').single(), promoted.length === 0);
            for (const [index, doc] of promoted.entries()) {
                const saved = await this.step(attempt, 'promotion.intakeLookup', 'read', () => db.from('client_intake_documents').select('id').eq('tenant_id', tenantId).eq('client_id', clientId).eq('template_key', doc.templateKey).single());
                const intakeId = nativeId(saved), fileName = `${doc.templateKey}.html`, terminal = index === promoted.length - 1;
                const title = resolveOfficeDocumentTitle({ title: doc.title, fileName, documentSource: 'intake' });
                const patch = { intake_document_id: intakeId, source: 'intake', mime_type: 'text/html',
                    status: doc.status === 'finalized' ? 'abgeschlossen' : 'bestaetigt', portal_visible: true, title };
                const linked = await this.step(attempt, 'promotion.byIntake', 'read', () => db.from('client_documents').select('id').eq('tenant_id', tenantId).eq('client_id', clientId).eq('intake_document_id', intakeId).maybeSingle());
                if (own(linked, 'data') !== null) {
                    const linkedId = nativeId(linked);
                    await this.step(attempt, 'promotion.updateByIntake', 'write', () => db.from('client_documents').update(patch).eq('id', linkedId).eq('tenant_id', tenantId), terminal);
                    continue;
                }
                const existing = await this.step(attempt, 'promotion.byFile', 'read', () => db.from('client_documents').select('id, intake_document_id, source, mime_type').eq('tenant_id', tenantId).eq('client_id', clientId).eq('file_name', fileName).maybeSingle());
                if (own(existing, 'data') !== null) {
                    const existingId = nativeId(existing), retainedFile = own(existing, 'data');
                    if (own(retainedFile, 'source') !== 'intake' || own(retainedFile, 'intake_document_id') !== intakeId || own(retainedFile, 'mime_type') !== 'text/html')
                        throw Error('Der Dokumentname gehört bereits zu einer anderen Originaldatei. Die vorhandene Datei wurde nicht ersetzt.');
                    await this.step(attempt, 'promotion.linkByFile', 'write', () => db.from('client_documents').update(patch).eq('id', existingId).eq('tenant_id', tenantId), terminal);
                    continue;
                }
                // Preserve the existing insert mapping exactly. These document status labels
                // are source data conventions, not a new clinical-completion inference.
                await this.step(attempt, 'promotion.insert', 'write', () => db.from('client_documents').insert({
                    tenant_id: tenantId, client_id: clientId, title, file_name: fileName, mime_type: 'text/html',
                    category: doc.documentType === 'privacy_consent' || doc.documentType === 'additional_consent' ? 'einwilligung'
                        : doc.documentType === 'client_contract' || doc.documentType === 'assignment_declaration' ? 'vertrag' : 'sonstige',
                    status: patch.status, sensitivity: 'care', source: 'intake', intake_document_id: intakeId, portal_visible: true, uploaded_by: actorId,
                }), terminal);
                // A returned 23505 is an error, not corroboration of this original payload.
            }
        });
    }
}
