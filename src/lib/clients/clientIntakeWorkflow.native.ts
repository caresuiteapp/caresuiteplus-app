// Generated native presentation from src/lib/clients/clientIntakeWorkflow.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeNavigator as navigator} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { ServiceResult } from '@/types';
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import { isUuid } from '@/lib/validation/uuid';
import { hasIntakeDraftContent, mergeIntakeFormWithDefaults } from './clientIntakeDraftStorage';
type Snapshot = {
    form: ClientIntakeFormData;
    stepIndex: number;
};
type Stage = 'ready' | 'draft-dispatched' | 'documents-dispatched' | 'submit-dispatched' | 'complete' | 'existing-selected';
export type IntakeBinding = Readonly<{
    clientId: string | null;
    allocation: 'new' | 'existing';
    stage: Stage;
}>;
export type IntakeWorkflowProgress = Readonly<{
    stage: Stage;
    documentsConfirmed: boolean;
    documentsRequestId: string | null;
    completionRequestId: string | null;
}>;
export type IntakeIdentityDecision = Readonly<{
    resolution: 'create_distinct' | 'continue_draft' | 'open_existing';
    inputKey: string;
    candidateCount: number;
    reason: string;
}>;
export type IntakeReservationReview = Readonly<{
    id: string;
    requestId: string;
    tenantId: string;
    actorId: string;
    inputKey: string;
    candidateCount: number;
    preparedAt: string;
    expiresAt: string;
}>;
export type IntakeIdentityGate = {
    permits(form: ClientIntakeFormData, binding: IntakeBinding): boolean;
    assertCurrent(form: ClientIntakeFormData, binding: IntakeBinding): Promise<void>;
    decision(): IntakeIdentityDecision | null;
    reservationReview?(): IntakeReservationReview | null;
    rejectReservation?(): void;
    selectExisting(clientId: string, form: ClientIntakeFormData, binding: IntakeBinding): Promise<IntakeIdentityDecision>;
};
type Journal = Snapshot & {
    version: 1;
    tenantId: string;
    actorId: string;
    revision: string;
    clientId: string | null;
    allocation: 'new' | 'existing';
    stage: Stage;
    identityDecision?: IntakeIdentityDecision | null;
    selectedExistingId?: string | null;
    identityReviewId?: string | null;
    completionRequestId?: string | null;
    documentsRequestId?: string | null;
    documentsConfirmed?: boolean;
};
type Receipt = ServiceResult<{
    id: string;
    remote?: boolean;
    reviewRevoked?: boolean;
}> | {
    ok: false;
    error: string;
    identityReviewRejected: true;
};
type Storage = {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
};
export type IntakeWorkflowDependencies = {
    tenantId: string;
    actorId: string;
    live: boolean;
    storage: Storage;
    isCurrent(): boolean;
    canWrite(): boolean;
    identity?: IntakeIdentityGate;
    allocateId(): string;
    exclusive<T>(key: string, operation: () => Promise<T>): Promise<T>;
    loadLegacy(): Promise<(Snapshot & {
        clientId?: string | null;
    }) | null>;
    clearLegacy(): Promise<void>;
    saveRemote(form: ClientIntakeFormData, options: {
        clientId: string | null;
        newClientId: string | null;
        beforeWrite(): Promise<boolean>;
        identityReview(): IntakeReservationReview | null;
    }): Promise<Receipt>;
    confirmRemote(clientId: string, form: ClientIntakeFormData, context?: {
        allocation: 'new' | 'existing';
        identityReviewId: string | null;
    }): Promise<Receipt>;
    onProgress?(progress: IntakeWorkflowProgress): void;
    saveDocuments(clientId: string, form: ClientIntakeFormData, context: {
        requestId: string;
        isCurrent(): boolean;
    }): Promise<ServiceResult<{
        requestId: string;
    }> | {
        ok: false;
        error: string;
        documentWriteRejected: true;
    }>;
    confirmDocuments(clientId: string, form: ClientIntakeFormData, context: {
        requestId: string;
        isCurrent(): boolean;
    }): Promise<ServiceResult<{
        requestId: string;
    }>>;
    complete(clientId: string | null, form: ClientIntakeFormData, isCurrent: () => boolean, context: {
        requestId: string;
        identityReviewId: string | null;
        documentsRequestId: string | null;
    }): Promise<Receipt>;
    confirmCompletion(clientId: string, requestId: string): Promise<Receipt>;
};
export type IntakeWorkflowRestore = Snapshot & {
    clientId: string | null;
    completed: boolean;
    blocked: boolean;
    selectedExistingId?: string | null;
};
const unresolved = 'Ein Speichervorgang ist noch nicht vollständig bestätigt. Die Aufnahme bleibt mit derselben Aktenkennung erhalten. Bitte prüfen Sie die bestehende Akte, bevor Sie fortfahren.';
const changed = 'Die Aufnahme hat sich in einem anderen Fenster geändert. Bitte laden Sie sie erneut.';
const authority = 'Die aktuelle Aufnahmeberechtigung ist nicht bestätigt. Bitte laden Sie die Aufnahme erneut.';
const localFailure = 'Die Aufnahme konnte auf diesem Gerät nicht zuverlässig gesichert werden. Es wurde kein weiterer Schreibvorgang begonnen.';
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
/** One local queue plus a browser-wide exclusive lock. The journal contains no session token. */
export class ClientIntakeWorkflow {
    private journal: Journal | null = null;
    private storedRaw: string | null = null;
    private tail: Promise<unknown> = Promise.resolve();
    private loaded = false;
    private disposed = false;
    private poisoned = false;
    private closing = false;
    private readonly key: string;
    private readonly deps: IntakeWorkflowDependencies;
    constructor(deps: IntakeWorkflowDependencies) {
        this.deps = deps;
        this.key = `caresuite:client-intake-web-workflow:v1:${deps.tenantId}:${deps.actorId}`;
    }
    dispose(): void { this.disposed = true; }
    binding(): IntakeBinding {
        const j = this.journal;
        return Object.freeze({ clientId: j?.clientId ?? null, allocation: j?.allocation ?? 'new', stage: j?.stage ?? 'ready' });
    }
    progress(): IntakeWorkflowProgress {
        return Object.freeze({ stage: this.journal?.stage ?? 'ready', documentsConfirmed: this.journal?.documentsConfirmed === true,
            documentsRequestId: this.journal?.documentsRequestId ?? null, completionRequestId: this.journal?.completionRequestId ?? null });
    }
    documentsMatch(form: ClientIntakeFormData): boolean {
        const packet = (input: ClientIntakeFormData) => JSON.stringify({ contractType: input.intakeContractType ?? null,
            assignmentEnabled: input.intakeAssignmentEnabled === true, documents: input.intakeDocuments });
        return !!this.journal?.documentsConfirmed && packet(this.journal.form) === packet(form);
    }
    private current = (): boolean => !this.disposed && !this.poisoned && this.deps.isCurrent();
    private requireCurrent(): void { if (!this.current())
        throw Error(authority); }
    private async write(journal: Journal): Promise<void> {
        this.requireCurrent();
        // Keep a pending state in memory even if the storage acknowledgement is lost.
        this.journal = journal;
        const raw = JSON.stringify(journal);
        try {
            await this.deps.storage.setItem(this.key, raw);
            if (await this.deps.storage.getItem(this.key) !== raw)
                throw Error(localFailure);
            this.storedRaw = raw;
            if (this.current())
                this.deps.onProgress?.(this.progress());
        }
        catch {
            this.poisoned = true;
            throw Error(localFailure);
        }
        this.requireCurrent();
    }
    private next(patch: Partial<Journal>): Journal {
        if (!this.journal)
            throw Error('Kein Aufnahmeentwurf vorhanden.');
        return { ...this.journal, ...patch, revision: this.deps.allocateId() };
    }
    private enqueue<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.tail.then(() => this.deps.exclusive(this.key, async () => {
            this.requireCurrent();
            if (await this.deps.storage.getItem(this.key) !== this.storedRaw)
                throw Error(changed);
            this.requireCurrent();
            return operation();
        }));
        this.tail = result.catch(() => { });
        return result;
    }
    private parse(raw: string): Journal {
        const value: unknown = JSON.parse(raw);
        if (!value || typeof value !== 'object' || Array.isArray(value))
            throw Error(unresolved);
        const j = value as Journal;
        if (j.version !== 1 || j.tenantId !== this.deps.tenantId || j.actorId !== this.deps.actorId
            || !isUuid(j.revision) || !['ready', 'draft-dispatched', 'documents-dispatched', 'submit-dispatched', 'complete', 'existing-selected'].includes(j.stage)
            || !['new', 'existing'].includes(j.allocation) || !Number.isSafeInteger(j.stepIndex) || j.stepIndex < 0
            || !j.form || typeof j.form !== 'object' || Array.isArray(j.form)
            || (j.clientId !== null && !(this.deps.live ? isUuid(j.clientId) : typeof j.clientId === 'string' && !!j.clientId))
            || (j.stage !== 'ready' && j.stage !== 'existing-selected' && !j.clientId && this.deps.live)
            || (j.stage === 'existing-selected' && (!isUuid(j.selectedExistingId) || j.allocation !== 'new'))
            || (j.identityReviewId !== undefined && j.identityReviewId !== null && !isUuid(j.identityReviewId))
            || (j.completionRequestId !== undefined && j.completionRequestId !== null && !isUuid(j.completionRequestId))
            || (j.documentsRequestId != null && !isUuid(j.documentsRequestId))
            || (j.documentsConfirmed !== undefined && typeof j.documentsConfirmed !== 'boolean')
            || (j.documentsConfirmed === true && !isUuid(j.documentsRequestId))
            || (j.allocation === 'existing' && !j.clientId))
            throw Error(unresolved);
        return { ...j, form: mergeIntakeFormWithDefaults(j.form) };
    }
    async load(): Promise<IntakeWorkflowRestore | null> {
        // Load is queued too: a slow initial storage read cannot race the first save.
        const result = this.tail.then(async () => {
            this.requireCurrent();
            this.storedRaw = await this.deps.storage.getItem(this.key);
            this.requireCurrent();
            if (this.storedRaw !== null)
                this.journal = this.parse(this.storedRaw);
            else {
                const legacy = await this.deps.loadLegacy();
                this.requireCurrent();
                if (legacy)
                    this.journal = {
                        ...copy(legacy), version: 1, tenantId: this.deps.tenantId, actorId: this.deps.actorId,
                        revision: this.deps.allocateId(), clientId: legacy.clientId ?? null,
                        allocation: legacy.clientId ? 'existing' : 'new', stage: 'ready',
                    };
            }
            this.loaded = true;
            this.deps.onProgress?.(this.progress());
            const j = this.journal;
            return j ? { form: copy(j.form), stepIndex: j.stepIndex, clientId: j.clientId,
                completed: j.stage === 'complete', blocked: !['ready', 'complete', 'existing-selected'].includes(j.stage),
                ...(j.selectedExistingId ? { selectedExistingId: j.selectedExistingId } : {}) } : null;
        });
        this.tail = result.catch(() => { this.poisoned = true; });
        return result;
    }
    private requireReady(): void {
        this.requireCurrent();
        if (!this.deps.canWrite())
            throw Error(authority);
        if (!this.loaded)
            throw Error('Der gespeicherte Entwurf wird noch geladen.');
        if (this.journal && this.journal.stage !== 'ready')
            throw Error(unresolved);
    }
    private async saveNow(snapshot: Snapshot): Promise<{
        id: string | null;
        remote: boolean;
    }> {
        this.requireReady();
        if (!hasIntakeDraftContent(snapshot))
            throw Error('Kein Entwurf zum Speichern.');
        const previous = this.journal;
        const packetKey = (form: ClientIntakeFormData) => JSON.stringify({ contractType: form.intakeContractType ?? null,
            assignmentEnabled: form.intakeAssignmentEnabled === true, documents: form.intakeDocuments });
        const unchangedDocuments = previous && packetKey(previous.form) === packetKey(snapshot.form);
        const clientId = previous?.clientId ?? (this.deps.live ? this.deps.allocateId() : null);
        if (this.deps.live && !isUuid(clientId))
            throw Error(localFailure);
        await this.write({
            ...snapshot, version: 1, tenantId: this.deps.tenantId, actorId: this.deps.actorId,
            revision: this.deps.allocateId(), clientId, allocation: previous?.allocation ?? 'new', stage: 'ready',
            ...(this.deps.identity ? { identityDecision: this.deps.identity.decision() } : {}),
            identityReviewId: previous?.identityReviewId ?? null,
            documentsRequestId: unchangedDocuments ? previous.documentsRequestId ?? null : null,
            documentsConfirmed: unchangedDocuments && previous.documentsConfirmed === true || false,
        });
        if (!this.deps.live)
            return { id: clientId, remote: false };
        // New Web intake keeps the complete draft local until the user has reviewed
        // current candidates and explicitly chosen new-person creation/continuation.
        if (this.deps.identity && !this.deps.identity.permits(snapshot.form, this.binding()))
            return { id: clientId, remote: false };
        const result = await this.deps.saveRemote(copy(snapshot.form), {
            clientId: this.journal!.allocation === 'existing' ? clientId : null,
            newClientId: this.journal!.allocation === 'new' ? clientId : null,
            beforeWrite: async () => {
                if (this.deps.identity)
                    await this.deps.identity.assertCurrent(snapshot.form, this.binding());
                const review = this.deps.identity?.reservationReview?.();
                await this.write(this.next({ stage: 'draft-dispatched', ...(review ? { identityReviewId: review.id } : {}) }));
                return this.current() && this.deps.canWrite();
            },
            identityReview: () => this.deps.identity?.reservationReview?.() ?? null,
        });
        this.requireCurrent();
        if (!this.deps.canWrite())
            throw Error(authority);
        if (!result.ok) {
            if ('identityReviewRejected' in result && result.identityReviewRejected === true
                && this.journal!.allocation === 'new' && this.journal!.stage === 'draft-dispatched') {
                this.deps.identity?.rejectReservation?.();
                await this.write(this.next({ stage: 'ready', identityReviewId: null, identityDecision: null }));
                throw Error(result.error);
            }
            throw Error(this.journal!.stage === 'ready' ? result.error : unresolved);
        }
        if (result.data.id !== clientId || this.journal!.stage !== 'draft-dispatched')
            throw Error(unresolved);
        await this.write(this.next({ allocation: 'existing', stage: 'ready' }));
        if (snapshot.form.intakeDocuments.length && !this.journal!.documentsConfirmed) {
            const requestId = this.deps.allocateId();
            if (!isUuid(requestId))
                throw Error(localFailure);
            await this.write(this.next({ stage: 'documents-dispatched', documentsRequestId: requestId, documentsConfirmed: false }));
            const documents = await this.deps.saveDocuments(clientId!, copy(snapshot.form), {
                requestId, isCurrent: () => this.current() && this.deps.canWrite(),
            });
            this.requireCurrent();
            if (!this.deps.canWrite())
                throw Error(authority);
            if (!documents.ok) {
                if ('documentWriteRejected' in documents && documents.documentWriteRejected === true) {
                    await this.write(this.next({ stage: 'ready', documentsRequestId: null, documentsConfirmed: false }));
                }
                throw Error(unresolved);
            }
            if (documents.data.requestId !== requestId)
                throw Error(unresolved);
            await this.write(this.next({ stage: 'ready', documentsConfirmed: true }));
        }
        return { id: clientId, remote: true };
    }
    async save(snapshot: Snapshot): Promise<Receipt> {
        if (this.closing)
            return { ok: false, error: 'Die Aufnahme wird bereits abgeschlossen.' };
        const captured = copy(snapshot);
        try {
            const saved = await this.enqueue(() => this.saveNow(captured));
            return { ok: true, data: { id: saved.id ?? '', ...(this.deps.identity ? { remote: saved.remote } : {}) } };
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : unresolved };
        }
    }
    async recover(): Promise<Receipt> {
        try {
            return await this.enqueue(async () => {
                if (!this.deps.canWrite())
                    throw Error(authority);
                const j = this.journal;
                if (!this.loaded || !j || !j.clientId)
                    throw Error(unresolved);
                if (j.stage === 'documents-dispatched') {
                    if (!isUuid(j.documentsRequestId))
                        throw Error(unresolved);
                    const documents = await this.deps.confirmDocuments(j.clientId, copy(j.form), {
                        requestId: j.documentsRequestId, isCurrent: () => this.current() && this.deps.canWrite(),
                    });
                    this.requireCurrent();
                    if (!this.deps.canWrite() || !documents.ok || documents.data.requestId !== j.documentsRequestId)
                        throw Error(unresolved);
                    await this.write(this.next({ stage: 'ready', documentsConfirmed: true }));
                    return { ok: true, data: { id: j.clientId } };
                }
                if (j.stage === 'submit-dispatched') {
                    if (!isUuid(j.completionRequestId))
                        throw Error(unresolved);
                    const completion = await this.deps.confirmCompletion(j.clientId, j.completionRequestId);
                    this.requireCurrent();
                    if (!this.deps.canWrite() || !completion.ok || completion.data.id !== j.clientId)
                        throw Error(unresolved);
                    await this.write(this.next({ stage: 'complete', allocation: 'existing' }));
                    try {
                        await this.deps.clearLegacy();
                    }
                    catch { /* Complete journal remains authoritative. */ }
                    return { ok: true, data: { id: j.clientId } };
                }
                if (j.stage !== 'draft-dispatched')
                    throw Error(unresolved);
                const receipt = await this.deps.confirmRemote(j.clientId, copy(j.form), {
                    allocation: j.allocation, identityReviewId: j.identityReviewId ?? null,
                });
                this.requireCurrent();
                if (!this.deps.canWrite())
                    throw Error(authority);
                if (!receipt.ok || receipt.data.id !== j.clientId)
                    throw Error(unresolved);
                if (receipt.data.reviewRevoked === true) {
                    if (j.allocation !== 'new' || !isUuid(j.identityReviewId))
                        throw Error(unresolved);
                    this.deps.identity?.rejectReservation?.();
                    await this.write(this.next({ stage: 'ready', identityReviewId: null, identityDecision: null }));
                    return { ok: true, data: { id: j.clientId, remote: false, reviewRevoked: true } };
                }
                // A draft receipt does not confirm signed-document persistence.
                await this.write(this.next({ stage: 'ready', allocation: 'existing' }));
                return { ok: true, data: { id: j.clientId } };
            });
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : unresolved };
        }
    }
    async finish(snapshot: Snapshot): Promise<Receipt> {
        if (this.closing)
            return { ok: false, error: 'Die Aufnahme wird bereits abgeschlossen.' };
        this.closing = true;
        const captured = copy(snapshot);
        try {
            return await this.enqueue(async () => {
                const saved = await this.saveNow(captured);
                if (this.deps.live && !saved.remote)
                    throw Error('Bitte prüfen Sie vorhandene Personen und bestätigen Sie Ihre Auswahl, bevor Sie die Aufnahme abschließen.');
                const id = saved.id;
                const reviewId = this.journal?.identityReviewId ?? null;
                if (this.deps.live && this.deps.identity && !isUuid(reviewId))
                    throw Error(unresolved);
                const documentsRequestId = this.journal?.documentsRequestId ?? null;
                if (this.deps.live && captured.form.intakeDocuments.length && (!isUuid(documentsRequestId) || !this.journal?.documentsConfirmed))
                    throw Error(unresolved);
                const requestId = this.journal?.completionRequestId ?? this.deps.allocateId();
                if (!isUuid(requestId))
                    throw Error(localFailure);
                await this.write(this.next({ stage: 'submit-dispatched', completionRequestId: requestId }));
                const result = await this.deps.complete(id, copy(captured.form), () => this.current() && this.deps.canWrite(), {
                    requestId, identityReviewId: reviewId, documentsRequestId,
                });
                this.requireCurrent();
                if (!this.deps.canWrite() || !result.ok || !result.data.id || (this.deps.live && result.data.id !== id))
                    throw Error(unresolved);
                // Completion is durable before legacy cleanup. Reload never starts a second intake.
                await this.write(this.next({ stage: 'complete', clientId: result.data.id, allocation: 'existing' }));
                try {
                    await this.deps.clearLegacy();
                }
                catch { /* The complete journal remains authoritative. */ }
                this.requireCurrent();
                return result;
            });
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : unresolved };
        }
        finally {
            this.closing = false;
        }
    }
    async openExisting(clientId: string, snapshot: Snapshot): Promise<Receipt> {
        if (this.closing)
            return { ok: false, error: 'Die Aufnahme wird bereits bearbeitet.' };
        this.closing = true;
        const captured = copy(snapshot);
        try {
            return await this.enqueue(async () => {
                this.requireCurrent();
                if (!this.loaded || !this.deps.canWrite() || !this.deps.identity || !isUuid(clientId))
                    throw Error(authority);
                const binding = this.binding();
                if (binding.allocation !== 'new' || !['ready', 'existing-selected'].includes(binding.stage))
                    throw Error(unresolved);
                const decision = await this.deps.identity.selectExisting(clientId, captured.form, binding);
                this.requireCurrent();
                await this.write({ ...captured, version: 1, tenantId: this.deps.tenantId, actorId: this.deps.actorId,
                    revision: this.deps.allocateId(), clientId: binding.clientId, allocation: 'new', stage: 'existing-selected',
                    identityDecision: decision, selectedExistingId: clientId });
                return { ok: true, data: { id: clientId, remote: false } };
            });
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : unresolved };
        }
        finally {
            this.closing = false;
        }
    }
    async discard(): Promise<ServiceResult<null>> {
        if (this.closing)
            return { ok: false, error: 'Die Aufnahme wird bereits abgeschlossen.' };
        this.closing = true;
        try {
            return await this.enqueue(async () => {
                if (!this.loaded)
                    throw Error('Der gespeicherte Entwurf wird noch geladen.');
                const j = this.journal;
                if (j && j.stage !== 'complete' && (!['ready', 'existing-selected'].includes(j.stage) || this.deps.live && j.clientId && j.allocation === 'existing')) {
                    throw Error('Dieser Entwurf gehört bereits zu einer Akte. Bitte prüfen oder bearbeiten Sie die bestehende Aufnahme.');
                }
                await this.deps.clearLegacy();
                this.requireCurrent();
                await this.deps.storage.removeItem(this.key);
                this.requireCurrent();
                this.storedRaw = null;
                this.journal = null;
                return { ok: true, data: null };
            });
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : unresolved };
        }
        finally {
            this.closing = false;
        }
    }
}
/** Web Locks coordinate this browser profile; independent devices still need server constraints. */
export async function withIntakeBrowserLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    if (typeof navigator === 'undefined' || !navigator.locks)
        throw Error('Dieser Browser kann die Aufnahme nicht sicher zwischen Fenstern koordinieren. Bitte verwenden Sie einen aktuellen Browser.');
    return navigator.locks.request(key, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
        if (!lock)
            throw Error('Die Aufnahme wird gerade in einem anderen Fenster gespeichert. Bitte warten Sie kurz.');
        return operation();
    });
}
