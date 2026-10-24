// Generated native presentation from src/lib/pflege/woundEditorRequestGuard.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { ROLE_PERMISSIONS } from '../permissions/staticRolePermissions.ts';
import { woundInstant, woundUuid } from './woundCareDomain.ts';
import { sameWoundReadOriginal } from "./woundReadOriginal.native.ts";
import type { MedicationWriteResult } from './medicationAdministrationService';
type Row = Record<string, unknown>;
export type WoundEditorAccess = {
    owner: string;
    readScope: string;
    tenantId: string;
    sourceId: string;
    woundId: string | null;
    kind: 'care' | 'lifecycle' | 'assessment' | 'treatment';
    expectedClientId?: string | null;
    canRead: boolean;
    canManage: boolean;
    linkedRead: boolean;
    linkedManage: boolean;
    liveAccess?: () => WoundEditorAccess;
};
export const isKnownWoundEditorRole = (role: unknown): role is keyof typeof ROLE_PERMISSIONS => typeof role === 'string' && Object.hasOwn(ROLE_PERMISSIONS, role);
export function woundEditorAccess(input: {
    originalOwner?: {
        tenantId: string;
        profileId: string;
        role: string;
    } | null;
    tenantId: string | null;
    profileTenantId: string | null | undefined;
    profileId: string | null | undefined;
    profileRole: string | null | undefined;
    runtimeTenantId: string | null;
    runtimeRole: string | null;
    sourceId: string;
    woundId: string | null;
    kind: WoundEditorAccess['kind'];
    action: string;
    expectedClientId?: string | null;
    canRead: boolean;
    canManage: boolean;
    readDressings?: boolean;
    linkedRead?: boolean;
    linkedManage?: boolean;
}): WoundEditorAccess {
    const owner = JSON.stringify([input.originalOwner?.tenantId ?? input.tenantId, input.originalOwner?.tenantId ?? input.profileTenantId, input.originalOwner?.profileId ?? input.profileId, input.originalOwner?.role ?? input.profileRole, input.kind, input.sourceId, input.woundId, input.action, ...(input.expectedClientId === undefined ? [] : [input.expectedClientId])]);
    const originalOwner = input.originalOwner;
    const matchesOriginal = originalOwner === undefined || !!originalOwner && woundUuid(originalOwner.tenantId) && woundUuid(originalOwner.profileId) && isKnownWoundEditorRole(originalOwner.role) && originalOwner.tenantId === input.tenantId && originalOwner.tenantId === input.profileTenantId && originalOwner.profileId === input.profileId && originalOwner.role === input.profileRole;
    const native = matchesOriginal && [input.tenantId, input.profileTenantId, input.profileId, input.sourceId].every(woundUuid) && input.tenantId === input.profileTenantId && input.runtimeTenantId === input.tenantId && isKnownWoundEditorRole(input.profileRole) && input.profileRole === input.runtimeRole && (input.woundId === null || woundUuid(input.woundId)) && (input.expectedClientId === undefined || woundUuid(input.expectedClientId));
    const canRead = native && input.canRead === true;
    return { owner, readScope: JSON.stringify([owner, input.runtimeTenantId, input.runtimeRole, canRead, input.readDressings ?? false, input.linkedRead ?? true]), tenantId: input.tenantId ?? '', sourceId: input.sourceId, woundId: input.woundId, kind: input.kind, ...(input.expectedClientId === undefined ? {} : { expectedClientId: input.expectedClientId }), canRead, canManage: canRead && input.canManage === true, linkedRead: native && input.linkedRead !== false, linkedManage: native && input.linkedManage !== false };
}
const object = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
function json(v: unknown, seen = new Set<object>()): void {
    if (v === null || typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v))
        return;
    if (!v || typeof v !== 'object' || seen.has(v) || Array.isArray(v) && Object.getPrototypeOf(v) !== Array.prototype || !Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null)
        throw Error('Ganzes geliefertes Originalformat ungültig.');
    seen.add(v);
    const keys = Reflect.ownKeys(v), data = Object.getOwnPropertyDescriptors(v);
    if (Array.isArray(v)) {
        const indices = keys.filter(key => key !== 'length');
        if (indices.length !== v.length || indices.some((key, index) => key !== String(index)))
            throw Error('Originalarray unvollständig.');
    }
    for (const key of keys) {
        if (Array.isArray(v) && key === 'length')
            continue;
        const descriptor = typeof key === 'string' ? data[key] : null;
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value'))
            throw Error('Original enthält unsupported Eigenschaften.');
        json(descriptor.value, seen);
    }
    seen.delete(v);
}
function capture(value: unknown, access: WoundEditorAccess): {
    original: unknown;
    clientId: string;
} {
    json(value);
    if (!object(value))
        throw Error('Vollständiger Originalbezug fehlt.');
    const w = object(value.wound) ? value.wound : value, root = access.kind === 'treatment' ? value.execution : w.row;
    if (!object(root) || root.id !== (access.kind === 'treatment' ? access.sourceId : access.woundId) || root.tenant_id !== access.tenantId || !woundUuid(root.client_id))
        throw Error('Nativer ursprünglicher Fallbezug geändert.');
    const clientId = root.client_id;
    if (access.expectedClientId !== undefined && clientId !== access.expectedClientId)
        throw Error('Der ursprüngliche ausgewählte Pflegefall stimmt nicht mit dem ganzen Originalbestand überein.');
    function row(r: unknown, woundScoped = false): void { if (!object(r) || !woundUuid(r.id) || r.tenant_id !== access.tenantId || r.client_id !== clientId || woundScoped && r.wound_case_id !== access.woundId || typeof r.created_at !== 'string' || woundInstant(r.created_at.replace(' ', 'T')) === null)
        throw Error('Ganzer Originalbestand ist fremd oder ungültig.'); }
    row(root);
    if (access.kind !== 'treatment' && (typeof root.updated_at !== 'string' || woundInstant(root.updated_at.replace(' ', 'T')) === null))
        throw Error('Nativer Wundkopfstand fehlt.');
    function pool(container: Row, key: string, woundScoped = false) { const values = container[key]; if (!Array.isArray(values))
        throw Error('Ganzer Originalpool fehlt.'); const ids = new Set<string>(); for (const r of values) {
        row(r, woundScoped);
        const id = (r as Row).id as string;
        if (ids.has(id.toLowerCase()))
            throw Error('Doppelte native Originalkennung.');
        ids.add(id.toLowerCase());
    } }
    if (access.kind === 'treatment') {
        pool(value, 'corrections');
        if ((value.corrections as Row[]).some(r => r.execution_id !== root.id))
            throw Error('Berichtigung gehört zu fremdem Original.');
        if (access.woundId !== null && value.dressing == null)
            throw Error('Ursprünglicher Verbandwechselbezug fehlt.');
        if (value.dressing != null) {
            row(value.dressing);
            if (!object(value.dressing) || value.dressing.execution_id !== root.id || !woundUuid(value.dressing.wound_case_id) || (access.woundId !== null && value.dressing.wound_case_id !== access.woundId))
                throw Error('Native Verbandwechselzuordnung geändert.');
        }
    }
    else {
        pool(w, 'assessments', true);
        pool(w, 'lifecycle', true);
        if (access.kind === 'care') {
            pool(value, 'plans', true);
            pool(value, 'orders');
            pool(value, 'dressings', true);
        }
        else {
            pool(value, 'corrections', true);
            if (access.kind === 'assessment' && !(w.assessments as Row[]).some(r => r.id === access.sourceId))
                throw Error('Gewähltes Originalassessment fehlt.');
        }
    }
    return { original: structuredClone(value), clientId };
}
/** Private mounted Web editor lifetime. No request is stored outside its original native owner. */
export class WoundEditorRequestGuard<P extends object> {
    private readonly owner: string;
    private readonly originalLive: unknown;
    private readonly hasLive: boolean;
    private access: WoundEditorAccess;
    private live = true;
    private epoch = 0;
    private ticket = 0;
    private clientId: string | null = null;
    private receipt: {
        source: unknown;
        original: unknown;
        epoch: number;
        ticket: number;
    } | null = null;
    private view: unknown = null;
    private blocked = true;
    private request: {
        id: string;
        payload: P;
    } | null = null;
    private acknowledged = false;
    private linked = false;
    private liveReadDenied = false;
    private rejectedReadScope: string | null = null;
    constructor(access: WoundEditorAccess) { this.owner = access.owner; this.access = access; const live = Object.getOwnPropertyDescriptor(access, 'liveAccess'); this.hasLive = 'liveAccess' in access; this.originalLive = live && Object.hasOwn(live, 'value') ? live.value : null; this.linked = access.kind === 'treatment' && access.woundId !== null; }
    update(access: WoundEditorAccess) { if (access.readScope !== this.access.readScope) {
        this.epoch++;
        this.ticket++;
        this.receipt = null;
    } this.access = access; }
    mount() { this.live = true; }
    dispose() { this.live = false; this.ticket++; this.receipt = null; }
    get readEpoch() { return this.epoch; }
    get readTicket() { return this.ticket; }
    /** Omission keeps the existing private callers' contract; an explicit unsupported
     * live reader never becomes a grant. Original request journals stay independent. */
    private currentLiveAccess(): WoundEditorAccess | null | undefined {
        try {
            const descriptor = Object.getOwnPropertyDescriptor(this.access, 'liveAccess');
            if (!this.hasLive)
                return descriptor || 'liveAccess' in this.access ? null : undefined;
            if (!descriptor)
                return null;
            if (!Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'function' || descriptor.value !== this.originalLive)
                return null;
            const value = descriptor.value();
            if (!object(value) || Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
                return null;
            const fields = Object.getOwnPropertyDescriptors(value), read = (key: string) => { const d = fields[key]; if (!d || !d.enumerable || !Object.hasOwn(d, 'value'))
                throw Error('Unsupported current native access.'); return d.value; };
            if (read('owner') !== this.owner || read('tenantId') !== this.access.tenantId || read('sourceId') !== this.access.sourceId || read('woundId') !== this.access.woundId || read('kind') !== this.access.kind || typeof read('readScope') !== 'string')
                return null;
            const expected = fields.expectedClientId;
            if ((expected !== undefined) !== Object.hasOwn(this.access, 'expectedClientId') || expected && (!expected.enumerable || !Object.hasOwn(expected, 'value') || expected.value !== this.access.expectedClientId))
                return null;
            for (const key of ['canRead', 'canManage', 'linkedRead', 'linkedManage'])
                if (typeof read(key) !== 'boolean')
                    return null;
            return { owner: read('owner'), readScope: read('readScope'), tenantId: read('tenantId'), sourceId: read('sourceId'), woundId: read('woundId'), kind: read('kind'), ...(expected ? { expectedClientId: expected.value } : {}), canRead: read('canRead'), canManage: read('canManage'), linkedRead: read('linkedRead'), linkedManage: read('linkedManage') };
        }
        catch {
            return null;
        }
    }
    private ownRead(current: WoundEditorAccess | null | undefined) {
        const allowed = this.live && this.access.owner === this.owner && this.access.canRead && (!this.linked || this.access.linkedRead) && current !== null && (current === undefined || current.canRead === true && (!this.linked || current.linkedRead === true));
        if (!allowed && current !== undefined) {
            if (!this.liveReadDenied) {
                this.epoch++;
                this.ticket++;
                this.receipt = null;
            }
            this.liveReadDenied = true;
        }
        else if (allowed)
            this.liveReadDenied = false;
        return allowed;
    }
    canRead() { return this.ownRead(this.currentLiveAccess()); }
    private currentReadScope() {
        const current = this.currentLiveAccess();
        if (!this.ownRead(current))
            return false;
        if (current !== undefined && current!.readScope !== this.access.readScope) {
            const scope = current!.readScope;
            if (this.rejectedReadScope !== scope) {
                this.epoch++;
                this.ticket++;
                this.receipt = null;
            }
            this.rejectedReadScope = scope;
            return false;
        }
        this.rejectedReadScope = null;
        return true;
    }
    private currentManage() { const current = this.currentLiveAccess(); return this.ownRead(current) && this.access.canManage && (!this.linked || this.access.linkedManage) && (current === undefined || current!.canManage === true && (!this.linked || current!.linkedManage === true)); }
    setView(source: unknown, blocked: boolean) { this.view = source; this.blocked = blocked; }
    private currentSource() { if (!this.currentReadScope() || this.blocked)
        return false; try {
        json(this.view);
        return this.currentReadScope() && !this.blocked && !!this.receipt && this.receipt.epoch === this.epoch && this.receipt.ticket === this.ticket && this.receipt.source === this.view && sameWoundReadOriginal(this.receipt.original, this.view) && this.currentReadScope();
    }
    catch {
        return false;
    } }
    canShow(epoch = this.epoch, ticket = this.ticket, source = this.view) { return epoch === this.epoch && ticket === this.ticket && source === this.view && this.currentSource(); }
    sameCurrentOriginal(source: unknown) { if (!this.currentSource())
        return false; try {
        json(source);
        return sameWoundReadOriginal(this.receipt!.original, source) && this.currentReadScope();
    }
    catch {
        return false;
    } }
    mayWrite(epoch = this.epoch, ticket = this.ticket, source = this.view) { return !this.acknowledged && !this.request && this.canShow(epoch, ticket, source) && this.currentManage(); }
    async read<T>(epoch: number, fetch: () => Promise<{
        ok: true;
        data: T;
    } | {
        ok: false;
        error: string;
    }>): Promise<{
        ok: true;
        data: T;
    } | {
        ok: false;
        error: string;
    }> {
        if (!this.currentReadScope() || epoch !== this.epoch)
            return { ok: false, error: 'Der eigene aktuelle Original-Lesebezug fehlt.' };
        const ticket = ++this.ticket;
        this.receipt = null;
        const result = await fetch();
        if (!this.currentReadScope() || epoch !== this.epoch || ticket !== this.ticket)
            return { ok: false, error: 'Der eigene Original-Lesebezug hat sich geändert.' };
        if (result.ok) {
            try {
                const captured = capture(result.data, this.access);
                if (!this.currentReadScope() || epoch !== this.epoch || ticket !== this.ticket)
                    throw Error('Aktueller eigener Original-Lesebezug fehlt.');
                if (this.clientId !== null && this.clientId !== captured.clientId)
                    throw Error('Nativer Pflegefall geändert.');
                if (this.access.kind === 'treatment' && object(result.data) && result.data.dressing != null) {
                    this.linked = true;
                    if (!this.canRead())
                        throw Error('Aktuelle eigene Wund-Leserechte fehlen.');
                }
                this.clientId = captured.clientId;
                this.receipt = { source: result.data, original: captured.original, epoch, ticket };
            }
            catch {
                return { ok: false, error: 'Vollständigen eigenen Originalbestand erneut prüfen.' };
            }
        }
        return result;
    }
    async execute(id: string, payload: P, replay: boolean, save: () => Promise<MedicationWriteResult>, epoch = this.epoch, ticket = this.ticket, source = this.view): Promise<MedicationWriteResult> {
        if (!this.canRead() || !woundUuid(id))
            return { ok: false, error: 'Für diese ursprüngliche Anfrage fehlen eigene aktuelle Leserechte.', uncertain: replay };
        try {
            json(payload);
        }
        catch {
            return { ok: false, error: 'Ganzes ursprüngliches Anfrageformat nicht bestätigt.', uncertain: replay };
        }
        if (replay) {
            if (!this.request || this.request.id !== id || !sameWoundReadOriginal(this.request.payload, payload))
                return { ok: false, error: 'Die unveränderte ursprüngliche Anfrage fehlt.', uncertain: true };
        }
        else {
            if (!this.mayWrite(epoch, ticket, source))
                return { ok: false, error: 'Aktuellen ganzen Originalstand und Schreibberechtigung zuerst bestätigen.' };
            const original = structuredClone(payload);
            if (!this.mayWrite(epoch, ticket, source))
                return { ok: false, error: 'Aktuelle eigene Schreibberechtigung hat sich geändert.' };
            this.request = { id, payload: original };
        }
        if (!this.canRead() || !replay && !this.currentManage()) {
            if (!replay)
                this.request = null;
            return { ok: false, error: 'Aktuelle eigene Rechte vor dieser ursprünglichen Anfrage fehlen.', uncertain: replay };
        }
        const result = await save();
        // A known acknowledgement or rejection keeps its actual outcome even if
        // runtime read/manage rights changed during the already authorized request.
        if (result.ok)
            this.acknowledged = true;
        if (result.ok || !replay && result.uncertain !== true)
            this.request = null;
        return result;
    }
    mayClose(epoch: number) { return !this.request && this.canRead() && epoch === this.epoch; }
}
