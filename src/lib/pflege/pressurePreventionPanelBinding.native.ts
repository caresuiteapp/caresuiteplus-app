// Generated native presentation from src/lib/pflege/pressurePreventionPanelBinding.web.ts. Update through scripts/port-native-workspaces.mjs.
import { PressurePreventionOriginalReader, type PressurePreventionAccess, type PressurePreventionReceipt } from "./pressurePreventionOriginals.native.ts";
import { capturePressurePreventionHistory, currentPressurePreventionHistory, currentPressurePreventionAssessment, currentPressurePreventionEvent, type PressurePreventionHistory, type PressureHistoryAssessment, type PressureHistoryEvent, type PressureHistoryField, type PressureHistoryTime } from "./pressurePreventionHistory.native.ts";
import { carePermissionOwner, sameCarePermissionOwner, type CarePermissionOwner, type CarePermissionAuth } from "../permissions/carePermissionOwner.native.ts";
import { cloneClientNativeOriginal, freezeClientNativeOriginal, type ClientNativeRow } from "../clients/clientRecordNativeOriginal.native.ts";
import { woundUuid } from './woundCareDomain';
export type PressurePreventionPanelToken = Readonly<object>;
export type PressurePreventionPanelLifetime = Readonly<object>;
type AssessmentSummary = Readonly<{
    id: string;
    classification: PressureHistoryField;
    assessor: PressureHistoryField;
    assessedAt: PressureHistoryTime;
    recordedAt: PressureHistoryTime;
}>;
type EventSummary = Readonly<{
    id: string;
    eventType: PressureHistoryField;
    author: PressureHistoryField;
    recordedAt: PressureHistoryTime;
}>;
export type PressurePreventionPanelView = Readonly<{
    stage: 'idle' | 'loading' | 'ready' | 'error' | 'blocked';
    busy: boolean;
    canRead: boolean;
    markerId: string | null;
    assessmentCount: number;
    historyCount: number;
    assessmentRows: readonly AssessmentSummary[];
    historyRows: readonly EventSummary[];
    assessmentRemaining: number;
    historyRemaining: number;
    selectedAssessment: PressureHistoryAssessment | null;
    selectedEvent: PressureHistoryEvent | null;
    expanded: boolean;
}>;
type Context = {
    access: PressurePreventionAccess;
    owner: CarePermissionOwner;
    clientId: string;
    markerId: string;
    origin: readonly unknown[];
};
type Entry = {
    getAccess: () => PressurePreventionAccess;
    reader: PressurePreventionOriginalReader;
    alive: boolean;
    closed: boolean;
    checking: boolean;
    canChecking: boolean;
    lifetime: PressurePreventionPanelLifetime | null;
    version: number;
    readTicket: number;
    anchor: Context | null;
    stage: PressurePreventionPanelView['stage'];
    receipt: PressurePreventionReceipt | null;
    history: PressurePreventionHistory | null;
    assessmentId: string | null;
    eventId: string | null;
    expanded: boolean;
    assessmentLimit: number;
    historyLimit: number;
    listeners: Set<{
        lifetime: PressurePreventionPanelLifetime;
        notify: () => void;
    }>;
};
type ViewReceipt = {
    entry: Entry;
    lifetime: PressurePreventionPanelLifetime;
    version: number;
    readTicket: number;
};
const entries = new WeakMap<PressurePreventionPanelToken, Entry>();
const views = new WeakMap<PressurePreventionPanelView, ViewReceipt>();
type PanelData = Omit<PressurePreventionPanelView, 'stage' | 'busy' | 'canRead'>;
const blank = (): PanelData => ({ markerId: null, assessmentCount: 0, historyCount: 0, assessmentRows: [], historyRows: [], assessmentRemaining: 0, historyRemaining: 0, selectedAssessment: null, selectedEvent: null, expanded: false });
const denied = () => Error('Der eigene aktuelle historische Druckverletzungsbestand ist nicht bestätigt.');
const plain = (value: unknown): value is ClientNativeRow => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function own(value: unknown, key: string, optional = false): unknown {
    if (!plain(value))
        throw denied();
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) {
        if (optional)
            return undefined;
        throw denied();
    }
    if (!('value' in descriptor) || !descriptor.enumerable)
        throw denied();
    return descriptor.value;
}
function identity(value: unknown): {
    id: string;
    roleKey?: string | null;
} | null {
    if (value === null)
        return null;
    const id = own(value, 'id'), roleKey = own(value, 'roleKey', true);
    if (typeof id !== 'string' || roleKey !== undefined && roleKey !== null && typeof roleKey !== 'string')
        throw denied();
    return { id, roleKey };
}
function captureContext(entry: Entry): Context {
    const source = entry.getAccess(), auth = own(source, 'auth'), profile = own(auth, 'profile'), session = own(auth, 'session'), p = identity(profile);
    const projected = { authReady: own(auth, 'authReady'), isAuthenticated: own(auth, 'isAuthenticated'), isLoading: own(auth, 'isLoading'), profileBootstrapError: own(auth, 'profileBootstrapError'),
        profile: p === null ? null : { ...p, tenantId: own(profile, 'tenantId') }, user: identity(own(auth, 'user')), portalSession: own(auth, 'portalSession'),
        session: session === null ? null : { user: identity(own(session, 'user')), accessToken: own(session, 'accessToken'), expiresAt: own(session, 'expiresAt') } } as CarePermissionAuth;
    const tenantId = own(source, 'tenantId'), clientId = own(source, 'clientId'), markerId = own(source, 'markerId'), can = own(source, 'can'), origin = own(source, 'permissions');
    const copy = cloneClientNativeOriginal(origin), owner = carePermissionOwner(projected, typeof tenantId === 'string' ? tenantId : null, false);
    if (!owner || owner.demo || !woundUuid(clientId) || !woundUuid(markerId) || typeof can !== 'function' || !Array.isArray(copy) || !Object.isFrozen(origin) || copy.some(key => typeof key !== 'string') || !copy.includes('pflege.plans.view'))
        throw denied();
    return { owner, clientId, markerId, origin: origin as readonly unknown[], access: { auth: projected, tenantId: owner.tenantId, clientId, markerId, can: can as PressurePreventionAccess['can'], permissions: origin as readonly unknown[] } };
}
function sameOwner(a: Context, b: Context): boolean { return sameCarePermissionOwner(a.owner, b.owner) && a.clientId === b.clientId && a.markerId === b.markerId; }
function live(entry: Entry, lifetime: PressurePreventionPanelLifetime | null = entry.lifetime): boolean { return entry.alive && !entry.closed && !!lifetime && entry.lifetime === lifetime; }
function clearData(entry: Entry): void { entry.receipt = null; entry.history = null; entry.assessmentId = null; entry.eventId = null; entry.expanded = false; entry.assessmentLimit = 6; entry.historyLimit = 6; }
function close(entry: Entry): void { if (entry.closed)
    return; entry.closed = true; entry.stage = 'blocked'; entry.version++; entry.readTicket++; clearData(entry); entry.reader.dispose(); }
function notify(entry: Entry): void {
    for (const listener of [...entry.listeners])
        if (entry.alive && listener.lifetime === entry.lifetime) {
            try {
                listener.notify();
            }
            catch { /* A presentation subscriber cannot mint an authority or revive a read. */ }
        }
}
/** The factory must use the latest actual native permission-hook origin and can, with its own future Parent receipt/lifetime.
 * This unbound helper neither opens a product gate nor supplies a clinical-wound/marker relation. */
function currentAccess(entry: Entry): PressurePreventionAccess {
    if (!live(entry) || entry.checking) {
        close(entry);
        throw denied();
    }
    entry.checking = true;
    try {
        const before = captureContext(entry);
        if (entry.anchor && !sameOwner(before, entry.anchor))
            throw denied();
        if (!entry.anchor)
            entry.anchor = before;
        const can: PressurePreventionAccess['can'] = key => {
            try {
                if (!live(entry) || entry.canChecking)
                    throw denied();
                entry.canChecking = true;
                const value: unknown = before.access.can(key);
                if (value !== true) {
                    if (value instanceof Promise)
                        void value.catch(() => { });
                    throw denied();
                }
                const after = captureContext(entry);
                if (!live(entry) || !sameOwner(after, before) || after.origin !== before.origin)
                    throw denied();
                return true;
            }
            catch {
                close(entry);
                return false;
            }
            finally {
                entry.canChecking = false;
            }
        };
        if (!live(entry))
            throw denied();
        return { ...before.access, can };
    }
    catch (error) {
        close(entry);
        throw error;
    }
    finally {
        entry.checking = false;
    }
}
export function createPressurePreventionPanelWeb(getAccess: () => PressurePreventionAccess): PressurePreventionPanelToken {
    if (typeof getAccess !== 'function')
        throw denied();
    const token = Object.freeze({});
    let entry: Entry;
    const reader = new PressurePreventionOriginalReader(() => currentAccess(entry));
    entry = { getAccess, reader, alive: false, closed: false, checking: false, canChecking: false, lifetime: null, version: 0, readTicket: 0, anchor: null, stage: 'idle', receipt: null, history: null, assessmentId: null, eventId: null,
        expanded: false, assessmentLimit: 6, historyLimit: 6, listeners: new Set() };
    entries.set(token, entry);
    return token;
}
/** Each effect attachment is an empty independent lifetime. A cleanup from an older mount cannot dispose its replacement. */
export function mountPressurePreventionPanelWeb(token: PressurePreventionPanelToken): PressurePreventionPanelLifetime | null {
    const entry = entries.get(token);
    if (!entry || entry.closed)
        return null;
    entry.reader.dispose();
    entry.reader.mount();
    entry.alive = true;
    entry.lifetime = Object.freeze({});
    entry.version++;
    entry.readTicket++;
    entry.stage = 'idle';
    clearData(entry);
    return entry.lifetime;
}
export function disposePressurePreventionPanelWeb(token: PressurePreventionPanelToken, lifetime: PressurePreventionPanelLifetime): void {
    const entry = entries.get(token);
    if (!entry || entry.lifetime !== lifetime)
        return;
    entry.alive = false;
    entry.lifetime = null;
    entry.version++;
    entry.readTicket++;
    entry.reader.dispose();
    clearData(entry);
    for (const listener of [...entry.listeners])
        if (listener.lifetime === lifetime)
            entry.listeners.delete(listener);
}
export function subscribePressurePreventionPanelWeb(token: PressurePreventionPanelToken, lifetime: PressurePreventionPanelLifetime, callback: () => void): () => void {
    const entry = entries.get(token);
    if (!entry || !entry.alive || entry.lifetime !== lifetime || typeof callback !== 'function')
        return () => { };
    const listener = { lifetime, notify: callback };
    entry.listeners.add(listener);
    return () => { entry.listeners.delete(listener); };
}
function currentData(entry: Entry, lifetime: PressurePreventionPanelLifetime): boolean {
    if (!live(entry, lifetime) || !entry.receipt || !entry.history)
        return false;
    if (!entry.reader.current(entry.receipt) || !currentPressurePreventionHistory(entry.history, entry.reader) || !live(entry, lifetime)) {
        close(entry);
        return false;
    }
    return true;
}
function currentView(token: PressurePreventionPanelToken, lifetime: PressurePreventionPanelLifetime, view: PressurePreventionPanelView): Entry | null {
    const entry = entries.get(token), receipt = views.get(view);
    if (!entry || !receipt || receipt.entry !== entry || receipt.lifetime !== lifetime || receipt.version !== entry.version || receipt.readTicket !== entry.readTicket || !live(entry, lifetime))
        return null;
    if (entry.stage === 'ready' && !currentData(entry, lifetime))
        return null;
    return live(entry, lifetime) ? entry : null;
}
/** Fresh fixed metadata only; raw marker/assessment/history and native identity never cross the token boundary. */
export function pressurePreventionPanelViewWeb(token: PressurePreventionPanelToken, lifetime: PressurePreventionPanelLifetime): PressurePreventionPanelView | null {
    const entry = entries.get(token);
    if (!entry || !entry.alive || entry.lifetime !== lifetime)
        return null;
    if (!entry.closed && entry.stage !== 'loading') {
        try {
            const access = currentAccess(entry);
            if (access.can('pflege.plans.view') !== true)
                close(entry);
        }
        catch {
            close(entry);
        }
    }
    if (entry.stage === 'ready' && !currentData(entry, lifetime))
        close(entry);
    let data: PanelData = blank();
    if (entry.stage === 'ready' && entry.history && live(entry, lifetime)) {
        const history = entry.history;
        data = { markerId: history.markerId, assessmentCount: history.assessments.length, historyCount: history.history.length,
            assessmentRows: history.assessments.slice(0, entry.assessmentLimit).map(row => ({ id: row.id, classification: row.classification, assessor: row.assessor, assessedAt: row.assessedAt, recordedAt: row.recordedAt })),
            historyRows: history.history.slice(0, entry.historyLimit).map(row => ({ id: row.id, eventType: row.eventType, author: row.author, recordedAt: row.recordedAt })),
            assessmentRemaining: Math.max(0, history.assessments.length - entry.assessmentLimit), historyRemaining: Math.max(0, history.history.length - entry.historyLimit),
            selectedAssessment: entry.assessmentId ? currentPressurePreventionAssessment(history, entry.reader, entry.assessmentId) : null,
            selectedEvent: entry.eventId ? currentPressurePreventionEvent(history, entry.reader, entry.eventId) : null, expanded: entry.expanded };
        if (!currentData(entry, lifetime))
            data = blank();
    }
    const view = freezeClientNativeOriginal({ stage: entry.stage, busy: entry.stage === 'loading', canRead: live(entry, lifetime) && entry.stage !== 'loading', ...data }) as PressurePreventionPanelView;
    // Cloning/projecting is not authority: inspect the whole private receipt again before delivery.
    if (entry.stage === 'ready' && !currentData(entry, lifetime))
        return pressurePreventionPanelViewWeb(token, lifetime);
    if (!entry.alive || entry.lifetime !== lifetime)
        return null;
    views.set(view, { entry, lifetime, version: entry.version, readTicket: entry.readTicket });
    return view;
}
export async function readPressurePreventionPanelWeb(token: PressurePreventionPanelToken, lifetime: PressurePreventionPanelLifetime, view: PressurePreventionPanelView): Promise<boolean> {
    const entry = currentView(token, lifetime, view);
    if (!entry || entry.stage === 'loading')
        return false;
    try {
        const access = currentAccess(entry);
        if (access.can('pflege.plans.view') !== true)
            return false;
    }
    catch {
        return false;
    }
    if (!live(entry, lifetime))
        return false;
    entry.stage = 'loading';
    entry.version++;
    const ticket = ++entry.readTicket;
    clearData(entry);
    notify(entry);
    if (!live(entry, lifetime) || entry.readTicket !== ticket)
        return false;
    const result = await entry.reader.read();
    if (!entry.alive || entry.lifetime !== lifetime || entry.readTicket !== ticket)
        return false;
    if (entry.closed) {
        notify(entry);
        return false;
    }
    if (!result.ok) {
        entry.stage = 'error';
        entry.version++;
        notify(entry);
        return false;
    }
    const history = capturePressurePreventionHistory(entry.reader, result.data);
    if (!history || !live(entry, lifetime) || entry.readTicket !== ticket) {
        close(entry);
        notify(entry);
        return false;
    }
    entry.receipt = result.data;
    entry.history = history;
    entry.stage = 'ready';
    entry.version++;
    notify(entry);
    return currentData(entry, lifetime);
}
export function selectPressurePreventionPanelWeb(token: PressurePreventionPanelToken, lifetime: PressurePreventionPanelLifetime, view: PressurePreventionPanelView, kind: 'assessment' | 'history', id: string): boolean {
    const entry = currentView(token, lifetime, view);
    if (!entry || entry.stage !== 'ready' || !entry.history || !woundUuid(id))
        return false;
    const row = kind === 'assessment' ? currentPressurePreventionAssessment(entry.history, entry.reader, id) : kind === 'history' ? currentPressurePreventionEvent(entry.history, entry.reader, id) : null;
    if (!row || !currentData(entry, lifetime))
        return false;
    entry.assessmentId = kind === 'assessment' ? id : null;
    entry.eventId = kind === 'history' ? id : null;
    entry.expanded = false;
    entry.version++;
    notify(entry);
    return live(entry, lifetime);
}
export function expandPressurePreventionPanelWeb(token: PressurePreventionPanelToken, lifetime: PressurePreventionPanelLifetime, view: PressurePreventionPanelView): boolean {
    const entry = currentView(token, lifetime, view);
    if (!entry || entry.stage !== 'ready' || (!entry.assessmentId && !entry.eventId) || !currentData(entry, lifetime))
        return false;
    entry.expanded = !entry.expanded;
    entry.version++;
    notify(entry);
    return live(entry, lifetime);
}
export function morePressurePreventionPanelWeb(token: PressurePreventionPanelToken, lifetime: PressurePreventionPanelLifetime, view: PressurePreventionPanelView, kind: 'assessment' | 'history'): boolean {
    const entry = currentView(token, lifetime, view);
    if (!entry || entry.stage !== 'ready' || !entry.history || !currentData(entry, lifetime))
        return false;
    if (kind === 'assessment' && entry.assessmentLimit < entry.history.assessments.length)
        entry.assessmentLimit += 6;
    else if (kind === 'history' && entry.historyLimit < entry.history.history.length)
        entry.historyLimit += 6;
    else
        return false;
    entry.version++;
    notify(entry);
    return live(entry, lifetime);
}
