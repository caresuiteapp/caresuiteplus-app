// Generated native presentation from src/lib/clients/clientIntakeIdentitySession.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { ClientIntakeFormData } from '@/types/forms/clientIntakeForm';
import type { CarePermissionOwner } from "../permissions/carePermissionOwner.native.ts";
import type { IntakeBinding, IntakeIdentityDecision, IntakeIdentityGate, IntakeReservationReview } from "./clientIntakeWorkflow.native.ts";
import { getSupabaseClient } from "../supabase/client.ts";
import { isUuid } from '@/lib/validation/uuid';
export type IntakeIdentityCandidate = Readonly<{
    id: string;
    tenant_id: string;
    first_name: string;
    last_name: string;
    date_of_birth: string | null;
    insurance_number: string | null;
    status: string;
    updated_at: string;
}>;
type Input = Readonly<{
    first: string;
    last: string;
    birth: string;
    insurance: string;
    key: string;
}>;
type Review = Readonly<{
    input: Input;
    candidates: readonly IntakeIdentityCandidate[];
    signature: string;
    binding: IntakeBinding;
    generation: number;
    authority: () => boolean;
    sdk: ReturnType<typeof getSupabaseClient>;
}>;
export type IntakeIdentityView = Readonly<{
    status: 'idle' | 'loading' | 'ready' | 'approved' | 'error';
    candidates: readonly IntakeIdentityCandidate[];
    exactConflict: boolean;
    error: string | null;
}>;
type Dependencies = {
    owner: CarePermissionOwner;
    isCurrent(): boolean;
    canRead(): boolean;
    captureRead(): () => boolean;
};
type ReviewRpc = {
    rpc(name: string, args: Record<string, unknown>): Promise<{
        data: unknown;
        error: unknown;
    }>;
};
const columns = 'id,tenant_id,first_name,last_name,date_of_birth,insurance_number,status,updated_at';
const denied = 'Die aktuelle Berechtigung zur Prüfung vorhandener Personen ist nicht bestätigt.';
const stale = 'Die Angaben oder der Aktenbestand haben sich geändert. Bitte prüfen Sie die vorhandenen Personen erneut.';
const unavailable = 'Vorhandene Personen konnten nicht vollständig geprüft werden. Ihre Eingaben bleiben als Entwurf erhalten.';
const invalidInput = 'Bitte tragen Sie Vorname, Nachname und ein gültiges Geburtsdatum ein.';
const tooMany = 'Zu viele mögliche Personen. Bitte grenzen Sie die Angaben ein und prüfen Sie erneut.';
const safeError = (error: unknown) => error instanceof Error && [denied, stale, unavailable, invalidInput, tooMany].includes(error.message) ? error.message : unavailable;
const noCandidates = Object.freeze([]) as readonly IntakeIdentityCandidate[];
const lower = (value: string) => value.trim().toLocaleLowerCase('de-DE');
const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');
function calendar(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && value.slice(0, 4) !== '0000'
        && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
function inputOf(form: ClientIntakeFormData): Input {
    const first = form.firstName.trim(), last = form.lastName.trim(), birth = form.dateOfBirth.trim(), insurance = form.insuranceNumber.trim();
    if (!first || !last || first.length > 150 || last.length > 150 || insurance.length > 150 || !calendar(birth)) {
        throw Error(invalidInput);
    }
    return Object.freeze({ first, last, birth, insurance, key: JSON.stringify([first, last, birth, insurance]) });
}
function fieldsKey(form: ClientIntakeFormData): string {
    return JSON.stringify([form.firstName, form.lastName, form.dateOfBirth, form.insuranceNumber]);
}
function candidate(value: unknown, tenantId: string): IntakeIdentityCandidate {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw Error(unavailable);
    const record = value as Record<string, unknown>, clean: Record<string, unknown> = {};
    for (const key of columns.split(',')) {
        const descriptor = Object.getOwnPropertyDescriptor(record, key);
        if (!descriptor || !('value' in descriptor))
            throw Error(unavailable);
        clean[key] = descriptor.value;
    }
    if (!isUuid(clean.id) || clean.tenant_id !== tenantId || typeof clean.first_name !== 'string' || typeof clean.last_name !== 'string'
        || !(clean.date_of_birth === null || typeof clean.date_of_birth === 'string' && calendar(clean.date_of_birth))
        || !(clean.insurance_number === null || typeof clean.insurance_number === 'string')
        || typeof clean.status !== 'string' || !['lead', 'active', 'paused', 'inactive', 'archived', 'deceased', 'blocked', 'deleted'].includes(clean.status)
        || typeof clean.updated_at !== 'string' || !/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})$/.test(clean.updated_at)
        || !Number.isFinite(Date.parse(clean.updated_at)))
        throw Error(unavailable);
    return Object.freeze({ id: clean.id, tenant_id: tenantId, first_name: clean.first_name, last_name: clean.last_name,
        date_of_birth: clean.date_of_birth, insurance_number: clean.insurance_number, status: clean.status, updated_at: clean.updated_at });
}
const signature = (rows: readonly IntakeIdentityCandidate[]) => JSON.stringify(rows);
const exact = (row: IntakeIdentityCandidate, input: Input) => lower(row.first_name) === lower(input.first) && lower(row.last_name) === lower(input.last) && row.date_of_birth === input.birth
    || !!input.insurance && row.insurance_number !== null && lower(row.insurance_number) === lower(input.insurance);
/** Live SELECT-only identity review. It mints no location, clinical or server acceptance evidence. */
export class ClientIntakeIdentitySession implements IntakeIdentityGate {
    private readonly deps: Dependencies;
    private disposed = false;
    private generation = 0;
    private fields: string | null = null;
    private reviewState: Review | null = null;
    private choice: {
        review: Review;
        decision: IntakeIdentityDecision;
        claimedId: string | null;
    } | null = null;
    private state: IntakeIdentityView['status'] = 'idle';
    private error: string | null = null;
    private ticket: object | null = null;
    private reservation: IntakeReservationReview | null = null;
    constructor(deps: Dependencies) { this.deps = deps; }
    dispose(): void { this.disposed = true; this.invalidate(); }
    syncInput(form: ClientIntakeFormData): void {
        const next = fieldsKey(form);
        if (this.fields !== next) {
            this.fields = next;
            this.invalidate();
        }
    }
    private invalidate(): void {
        this.generation++;
        this.reviewState = null;
        this.choice = null;
        this.ticket = null;
        this.reservation = null;
        this.state = 'idle';
        this.error = null;
    }
    private current(): boolean { return !this.disposed && this.deps.isCurrent() && this.deps.canRead(); }
    private guard(): void { if (!this.current())
        throw Error(denied); }
    private own(review: Review): boolean {
        return this.current() && review.authority() && getSupabaseClient() === review.sdk
            && this.reviewState === review && review.generation === this.generation;
    }
    view(): IntakeIdentityView {
        if (!this.current())
            return { status: 'idle', candidates: noCandidates, exactConflict: false, error: null };
        if (this.reviewState && !this.own(this.reviewState))
            this.invalidate();
        const review = this.reviewState;
        return { status: this.state, candidates: review?.candidates ?? noCandidates,
            exactConflict: !!review?.candidates.some(row => exact(row, review.input)), error: this.error };
    }
    private async read(input: Input, binding: IntakeBinding, stillCurrent: () => boolean): Promise<readonly IntakeIdentityCandidate[]> {
        this.guard();
        const db = getSupabaseClient(), owner = this.deps.owner;
        if (!db || owner.demo || !owner.accessToken)
            throw Error(unavailable);
        const guard = () => { this.guard(); if (!stillCurrent() || getSupabaseClient() !== db)
            throw Error(stale); };
        const session = async () => {
            guard();
            const result = await db.auth.getSession();
            guard();
            const live = result.data.session;
            if (result.error || !live || live.user.id !== owner.profileId || live.access_token !== owner.accessToken
                || live.expires_at !== undefined && (!Number.isFinite(live.expires_at) || live.expires_at * 1000 <= Date.now()))
                throw Error(denied);
        };
        await session();
        const authenticated = await db.auth.getUser(owner.accessToken);
        guard();
        if (authenticated.error || authenticated.data.user?.id !== owner.profileId)
            throw Error(denied);
        const all = new Map<string, IntakeIdentityCandidate>();
        const searches = [{ field: 'last_name', pattern: `%${escapeLike(input.last)}%` },
            ...(input.insurance ? [{ field: 'insurance_number', pattern: escapeLike(input.insurance) }] : [])];
        for (const search of searches) {
            let cursor: string | null = null;
            for (let page = 0;; page++) {
                if (page >= 100 || all.size > 5000)
                    throw Error(tooMany);
                guard();
                let query = db.from('clients').select(columns).eq('tenant_id', owner.tenantId)
                    .ilike(search.field, search.pattern).order('id', { ascending: true }).limit(100);
                if (binding.clientId)
                    query = query.neq('id', binding.clientId);
                if (cursor !== null)
                    query = query.gt('id', cursor);
                const result = await query;
                guard();
                if (result.error || !Array.isArray(result.data) || result.data.length > 100)
                    throw Error(unavailable);
                if (result.data.length === 0)
                    break; // A short page can be a server cap.
                for (const value of result.data) {
                    const row = candidate(value, owner.tenantId);
                    if (row.id.toLowerCase() === binding.clientId?.toLowerCase() || cursor !== null && row.id.toLowerCase() <= cursor.toLowerCase()
                        || (search.field === 'last_name' ? !lower(row.last_name).includes(lower(input.last))
                            : row.insurance_number === null || lower(row.insurance_number) !== lower(input.insurance)))
                        throw Error(unavailable);
                    const previous = all.get(row.id.toLowerCase());
                    if (previous && signature([previous]) !== signature([row]))
                        throw Error(stale);
                    all.set(row.id.toLowerCase(), row);
                    cursor = row.id;
                }
            }
        }
        await session();
        guard();
        return Object.freeze([...all.values()].sort((a, b) => a.id.localeCompare(b.id)));
    }
    async review(form: ClientIntakeFormData, binding: IntakeBinding): Promise<boolean> {
        this.syncInput(form);
        const generation = this.generation, ticket = {}, authority = this.deps.captureRead(), sdk = getSupabaseClient();
        this.ticket = ticket;
        this.reviewState = null;
        this.choice = null;
        this.reservation = null;
        this.state = 'loading';
        this.error = null;
        try {
            const input = inputOf(form);
            const candidates = await this.read(input, binding, () => authority() && getSupabaseClient() === sdk && this.generation === generation && this.ticket === ticket);
            this.guard();
            if (this.generation !== generation || this.ticket !== ticket)
                return false;
            this.reviewState = Object.freeze({ input, candidates, signature: signature(candidates), binding: Object.freeze({ ...binding }), generation, authority, sdk });
            this.state = 'ready';
            return true;
        }
        catch (error) {
            if (this.current() && this.generation === generation && this.ticket === ticket) {
                this.state = 'error';
                this.error = safeError(error);
            }
            return false;
        }
    }
    approveNew(reason: string): boolean {
        const review = this.reviewState;
        if (!review || !this.own(review))
            return false;
        if (review.candidates.some(row => exact(row, review.input))) {
            this.error = 'Es gibt übereinstimmende Identitätsmerkmale. Bitte prüfen Sie die vorhandene Akte; eine zweite Anlage ist gesperrt.';
            return false;
        }
        if (review.candidates.length > 0 && (reason.trim().length < 10 || reason.trim().length > 1000)) {
            this.error = 'Bitte begründen Sie, weshalb es sich um eine andere Person handelt (10 bis 1.000 Zeichen).';
            return false;
        }
        const decision = Object.freeze({ resolution: review.binding.allocation === 'existing' ? 'continue_draft' as const : 'create_distinct' as const,
            inputKey: review.input.key, candidateCount: review.candidates.length,
            reason: reason.trim() || 'Keine passenden Personen im gelesenen Bestand.' });
        this.reservation = null;
        this.choice = { review, decision, claimedId: review.binding.clientId };
        this.state = 'approved';
        this.error = null;
        return true;
    }
    permits(form: ClientIntakeFormData, binding: IntakeBinding): boolean {
        const choice = this.choice;
        if (!choice || !this.own(choice.review) || this.state !== 'approved')
            return false;
        try {
            return inputOf(form).key === choice.review.input.key
                && (choice.claimedId === null ? binding.allocation === 'new' : binding.clientId === choice.claimedId)
                && binding.stage === 'ready';
        }
        catch {
            return false;
        }
    }
    decision(): IntakeIdentityDecision | null { return this.choice && this.own(this.choice.review) ? this.choice.decision : null; }
    reservationReview(): IntakeReservationReview | null {
        return this.reservation && this.choice && this.own(this.choice.review)
            && Date.parse(this.reservation.expiresAt) > Date.now() ? this.reservation : null;
    }
    rejectReservation(): void { this.invalidate(); }
    async assertCurrent(form: ClientIntakeFormData, binding: IntakeBinding): Promise<void> {
        const choice = this.choice;
        if (!choice || !this.permits(form, binding))
            throw Error(stale);
        let rows: readonly IntakeIdentityCandidate[];
        try {
            rows = await this.read(choice.review.input, binding, () => this.choice === choice && this.own(choice.review));
        }
        catch (error) {
            if (this.choice === choice)
                this.invalidate();
            throw Error(safeError(error));
        }
        if (!this.permits(form, binding) || signature(rows) !== choice.review.signature) {
            this.invalidate();
            throw Error(stale);
        }
        if (binding.allocation === 'new') {
            if (!isUuid(binding.clientId))
                throw Error(stale);
            const db = getSupabaseClient(), owner = this.deps.owner;
            if (!db || db !== choice.review.sdk)
                throw Error(stale);
            const { input } = choice.review;
            this.reservation = null;
            try {
                const result = await (db as unknown as ReviewRpc).rpc('web_prepare_client_intake_identity_review', {
                    p_tenant_id: owner.tenantId, p_actor_profile_id: owner.profileId,
                    p_request_id: binding.clientId,
                    p_identity: { first_name: input.first, last_name: input.last, date_of_birth: input.birth, insurance_number: input.insurance || null },
                    p_candidates: rows, p_reason: choice.decision.reason,
                });
                if (!this.permits(form, binding) || getSupabaseClient() !== db || result.error
                    || !result.data || typeof result.data !== 'object' || Array.isArray(result.data))
                    throw Error(stale);
                const data = result.data as Record<string, unknown>;
                if (!isUuid(data.review_id) || data.request_id !== binding.clientId || data.tenant_id !== owner.tenantId
                    || data.actor_profile_id !== owner.profileId || data.resolution !== 'create_distinct'
                    || data.candidate_count !== rows.length || typeof data.prepared_at !== 'string' || typeof data.expires_at !== 'string'
                    || !Number.isFinite(Date.parse(data.prepared_at)) || !Number.isFinite(Date.parse(data.expires_at))
                    || Date.parse(data.prepared_at) > Date.now() + 60000 || Date.parse(data.expires_at) <= Date.now()
                    || Date.parse(data.expires_at) - Date.parse(data.prepared_at) > 300000
                    || Date.parse(data.expires_at) <= Date.parse(data.prepared_at))
                    throw Error(stale);
                this.reservation = Object.freeze({ id: data.review_id, requestId: binding.clientId,
                    tenantId: owner.tenantId, actorId: owner.profileId, inputKey: input.key,
                    candidateCount: rows.length, preparedAt: data.prepared_at, expiresAt: data.expires_at });
            }
            catch (error) {
                if (this.choice === choice)
                    this.invalidate();
                throw Error(safeError(error));
            }
        }
        choice.claimedId = binding.clientId;
    }
    async selectExisting(clientId: string, form: ClientIntakeFormData, binding: IntakeBinding): Promise<IntakeIdentityDecision> {
        const review = this.reviewState;
        if (!review || !this.own(review) || binding.allocation !== 'new' || !isUuid(clientId)
            || inputOf(form).key !== review.input.key)
            throw Error(stale);
        const selected = review.candidates.find(row => row.id === clientId);
        if (!selected || selected.status === 'deleted')
            throw Error('Diese Akte kann nicht aus dem geprüften Bestand geöffnet werden.');
        let rows: readonly IntakeIdentityCandidate[];
        try {
            rows = await this.read(review.input, binding, () => this.own(review));
        }
        catch (error) {
            if (this.reviewState === review)
                this.invalidate();
            throw Error(safeError(error));
        }
        if (!this.own(review) || signature(rows) !== review.signature) {
            this.invalidate();
            throw Error(stale);
        }
        return Object.freeze({ resolution: 'open_existing', inputKey: review.input.key,
            candidateCount: review.candidates.length, reason: 'Vorhandene Person ausdrücklich zum Öffnen gewählt; neue Angaben nicht übernommen.' });
    }
}
