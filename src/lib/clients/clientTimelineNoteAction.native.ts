// Generated native presentation from src/lib/clients/clientTimelineNoteAction.web.ts. Update through scripts/port-native-workspaces.mjs.
import { woundUuid } from '../pflege/woundCareDomain.ts';
import { cloneClientNativeOriginal, freezeClientNativeOriginal } from "./clientRecordNativeOriginal.native.ts";
/** Opaque private Parentreceipt capture. No raw sidecar or shared DTO extension. */
export type ClientTimelineReadCapture = Readonly<{
    tenantId: string;
    clientId: string;
    owner: object;
    key: string;
    assertCurrentRead: () => void;
}>;
export type ClientTimelineNoteCapture = ClientTimelineReadCapture & Readonly<{
    actorName: string | null;
    assertCurrentWrite: () => void;
}>;
export type ClientTimelineNotePayload = Readonly<{
    tenant_id: string;
    client_id: string;
    event_type: 'notiz';
    icon: '📝';
    title: string;
    subtitle: 'Manuelle Notiz';
    status: 'aktiv';
    actor_name: string | null;
    is_internal: false;
    metadata: null;
}>;
export type ClientTimelineNoteAcknowledgement = Readonly<{
    nativeId: string;
    nativeOriginal?: Readonly<Record<string, unknown>>;
}>;
export type ClientTimelineNoteResult = ({
    ok: true;
} & ClientTimelineNoteAcknowledgement) | {
    ok: false;
    error: string;
    uncertain: boolean;
};
export type ClientTimelineNoteAttempt = Readonly<{
    capture: ClientTimelineNoteCapture;
    payload: ClientTimelineNotePayload;
    draft: string;
    version: number;
}>;
export const CLIENT_TIMELINE_NOTE_UNCERTAIN = 'Der Ausgang der Notizspeicherung ist nicht sicher bestätigt. Die Originalnotiz bleibt erhalten und wird nicht automatisch wiederholt.';
export function assertClientTimelineCapture(capture: ClientTimelineReadCapture, write = false): void {
    if (!capture || Object.getPrototypeOf(capture) !== Object.prototype)
        throw Error('Der eigene aktuelle Aktenbezug fehlt.');
    const allowed = ['tenantId', 'clientId', 'owner', 'key', 'assertCurrentRead', 'actorName', 'assertCurrentWrite'];
    if (Reflect.ownKeys(capture).some(key => typeof key !== 'string' || !allowed.includes(key)
        || !Object.getOwnPropertyDescriptor(capture, key)?.enumerable || !('value' in Object.getOwnPropertyDescriptor(capture, key)!)))
        throw Error('Der private Aktenbezug enthält ungeklärte Belegfelder.');
    if (!['tenantId', 'clientId', 'owner', 'key', 'assertCurrentRead', ...(write ? ['actorName', 'assertCurrentWrite'] : [])].every(key => Object.hasOwn(capture, key)))
        throw Error('Der eigene aktuelle Aktenbezug fehlt.');
    if (!woundUuid(capture.tenantId) || !woundUuid(capture.clientId) || !capture.owner || typeof capture.owner !== 'object'
        || typeof capture.key !== 'string' || !capture.key || typeof capture.assertCurrentRead !== 'function')
        throw Error('Der eigene aktuelle Aktenbezug fehlt.');
    const value: unknown = capture.assertCurrentRead();
    if (value !== undefined) {
        if (value instanceof Promise)
            void value.catch(() => { });
        throw Error('Der Aktenbezug ist nicht synchron bestätigt.');
    }
    if (write) {
        const note = capture as ClientTimelineNoteCapture;
        if (typeof note.assertCurrentWrite !== 'function' || note.actorName !== null && typeof note.actorName !== 'string')
            throw Error('Das aktuelle Notizrecht fehlt.');
        const allowed: unknown = note.assertCurrentWrite();
        if (allowed !== undefined) {
            if (allowed instanceof Promise)
                void allowed.catch(() => { });
            throw Error('Das Notizrecht ist nicht synchron bestätigt.');
        }
    }
}
/** Parent-owned controller. Retain its store across tab unmounts and A→B→A; not browser restart persistence. */
export class ClientTimelineNoteController {
    private listeners = new Set<() => void>();
    private draft = '';
    private version = 0;
    private flight: ClientTimelineNoteAttempt | null = null;
    private uncertain: ClientTimelineNoteAttempt | null = null;
    private acknowledged: ClientTimelineNoteAttempt | null = null;
    private warning: string | null = null;
    private acknowledgement: ClientTimelineNoteAcknowledgement | null = null;
    subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
    private notify(): void { for (const listener of this.listeners)
        listener(); }
    snapshot() {
        return Object.freeze({ draft: this.draft, version: this.version, busy: !!this.flight, uncertain: !!this.uncertain,
            acknowledged: !!this.acknowledged, acknowledgement: this.acknowledgement, error: this.warning, original: this.flight ?? this.uncertain ?? this.acknowledged });
    }
    change(value: string, expectedVersion: number): boolean {
        if (typeof value !== 'string' || value === this.draft || expectedVersion !== this.version || this.flight || this.uncertain)
            return false;
        this.draft = value;
        this.version++;
        this.warning = null;
        this.notify();
        return true;
    }
    begin(capture: ClientTimelineNoteCapture, expectedVersion: number): ClientTimelineNoteAttempt | null {
        if (expectedVersion !== this.version || this.flight || this.uncertain || !this.draft.trim())
            return null;
        try {
            assertClientTimelineCapture(capture, true);
        }
        catch {
            return null;
        }
        // A fresh receipt alone never turns an unchanged acknowledged draft into a new note.
        if (this.acknowledged && (this.version === this.acknowledged.version
            || this.acknowledged.capture.owner === capture.owner && this.acknowledged.capture.key === capture.key))
            return null;
        const frozenCapture = Object.freeze({ ...capture });
        const payload: ClientTimelineNotePayload = Object.freeze({ tenant_id: capture.tenantId, client_id: capture.clientId,
            event_type: 'notiz', icon: '📝', title: this.draft.trim(), subtitle: 'Manuelle Notiz', status: 'aktiv',
            actor_name: capture.actorName, is_internal: false, metadata: null });
        const attempt = Object.freeze({ capture: frozenCapture, payload, draft: this.draft, version: this.version });
        this.flight = attempt;
        this.warning = null;
        this.notify();
        return attempt;
    }
    finish(attempt: ClientTimelineNoteAttempt, result: ClientTimelineNoteResult): {
        acknowledged: boolean;
        mayFollowup: boolean;
    } {
        if (this.flight !== attempt)
            return { acknowledged: false, mayFollowup: false };
        this.flight = null;
        if (!result.ok) {
            if (result.uncertain)
                this.uncertain = attempt;
            this.warning = result.uncertain ? CLIENT_TIMELINE_NOTE_UNCERTAIN : result.error;
            this.notify();
            return { acknowledged: false, mayFollowup: false };
        }
        if (!woundUuid(result.nativeId)) {
            this.uncertain = attempt;
            this.warning = CLIENT_TIMELINE_NOTE_UNCERTAIN;
            this.notify();
            return { acknowledged: false, mayFollowup: false };
        }
        try {
            this.acknowledgement = freezeClientNativeOriginal(cloneClientNativeOriginal({ nativeId: result.nativeId,
                ...(Object.hasOwn(result, 'nativeOriginal') ? { nativeOriginal: result.nativeOriginal } : {}) }));
        }
        catch {
            this.uncertain = attempt;
            this.warning = CLIENT_TIMELINE_NOTE_UNCERTAIN;
            this.notify();
            return { acknowledged: false, mayFollowup: false };
        }
        this.acknowledged = attempt;
        let current = false;
        try {
            assertClientTimelineCapture(attempt.capture, true);
            current = this.version === attempt.version && this.draft === attempt.draft;
        }
        catch { /* Keep known acknowledgement and original draft. */ }
        if (current) {
            this.draft = '';
            this.version++;
            this.warning = null;
        }
        else
            this.warning = 'Die Notizspeicherung wurde bestätigt. Der Aktenbezug hat sich geändert; die Originalnotiz bleibt lokal erhalten.';
        this.notify();
        return { acknowledged: true, mayFollowup: current };
    }
}
export class ClientTimelineNoteControllerStore {
    private notes = new Map<string, ClientTimelineNoteController>();
    forOwner(nativeOwnerKey: string): ClientTimelineNoteController {
        if (typeof nativeOwnerKey !== 'string' || !nativeOwnerKey)
            throw Error('Der native Notizbesitzer fehlt.');
        let controller = this.notes.get(nativeOwnerKey);
        if (!controller) {
            controller = new ClientTimelineNoteController();
            this.notes.set(nativeOwnerKey, controller);
        }
        return controller;
    }
}
