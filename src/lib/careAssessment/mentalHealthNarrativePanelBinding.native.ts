// Generated native presentation from src/lib/careAssessment/mentalHealthNarrativePanelBinding.web.ts. Update through scripts/port-native-workspaces.mjs.
import { MentalHealthOriginalReader, currentMentalHealthOriginalsWeb, isCurrentMentalHealthOriginalContextWeb, type MentalHealthAccess, type MentalHealthReceipt, type MentalHealthRawOriginals } from "./mentalHealthOriginals.native.ts";
import { captureMentalHealthNarrativeHistory, currentMentalHealthNarrativeHistory, type MentalHealthNarrativeHistory, type MentalHistoryField, type MentalHistoryTime, type MentalHistoryTexts } from "./mentalHealthNarrativeHistory.native.ts";
import { carePermissionOwner, sameCarePermissionOwner, type CarePermissionOwner, type CarePermissionAuth } from "../permissions/carePermissionOwner.native.ts";
import { cloneClientNativeOriginal, freezeClientNativeOriginal, type ClientNativeRow } from "../clients/clientRecordNativeOriginal.native.ts";
import { woundUuid } from '../pflege/woundCareDomain';
import { getSupabaseClient } from "../supabase/client.ts";
export type MentalHealthNarrativePanelToken = Readonly<object>;
export type MentalHealthNarrativePanelLifetime = Readonly<object>;
type TopicSummary = Readonly<{
    id: string;
    topicKey: MentalHistoryField;
    recordedAt: MentalHistoryTime;
}>;
type MeasureSummary = Readonly<{
    id: string;
    title: MentalHistoryField;
    recordedAt: MentalHistoryTime;
}>;
export type MentalPanelAccess = Omit<MentalHealthAccess, 'can'> & {
    can: (key: 'pflege.plans.view' | 'office.clients.view_sensitive') => boolean;
};
export type MentalPanelTopic = Readonly<{
    id: string;
    fields: Readonly<Record<'person_perspective' | 'resources' | 'wishes' | 'habits_biography', MentalHistoryField>>;
    informationSources: MentalHistoryTexts;
    recordedAt: MentalHistoryTime;
    updatedAt: MentalHistoryTime;
}>;
export type MentalPanelMeasure = Readonly<{
    id: string;
    fields: Readonly<Record<string, MentalHistoryField>>;
    recordedAt: MentalHistoryTime;
    updatedAt: MentalHistoryTime;
    reviewAgreement: MentalHistoryTime;
}>;
export type MentalHealthNarrativePanelView = Readonly<{
    stage: 'idle' | 'loading' | 'ready' | 'error' | 'blocked';
    busy: boolean;
    canRead: boolean;
    assessmentId: string | null;
    topicCount: number;
    measureCount: number;
    topicRows: readonly TopicSummary[];
    measureRows: readonly MeasureSummary[];
    topicRemaining: number;
    measureRemaining: number;
    communicationSupport: MentalHistoryField | null;
    selectedTopic: MentalPanelTopic | null;
    selectedMeasure: MentalPanelMeasure | null;
    expanded: boolean;
}>;
type Context = {
    access: MentalPanelAccess;
    owner: CarePermissionOwner;
    clientId: string;
    assessmentId: string;
    origin: readonly unknown[];
};
type Entry = {
    getAccess: () => MentalPanelAccess;
    reader: MentalHealthOriginalReader;
    alive: boolean;
    closed: boolean;
    checking: boolean;
    canChecking: boolean;
    lifetime: MentalHealthNarrativePanelLifetime | null;
    version: number;
    readTicket: number;
    anchor: Context | null;
    stage: MentalHealthNarrativePanelView['stage'];
    receipt: MentalHealthReceipt | null;
    originals: MentalHealthRawOriginals | null;
    history: MentalHealthNarrativeHistory | null;
    topicId: string | null;
    measureId: string | null;
    expanded: boolean;
    topicLimit: number;
    measureLimit: number;
    listeners: Set<{
        lifetime: MentalHealthNarrativePanelLifetime;
        notify: () => void;
    }>;
};
type ViewReceipt = {
    entry: Entry;
    lifetime: MentalHealthNarrativePanelLifetime;
    version: number;
    readTicket: number;
};
const entries = new WeakMap<MentalHealthNarrativePanelToken, Entry>();
const views = new WeakMap<MentalHealthNarrativePanelView, ViewReceipt>();
type PanelData = Omit<MentalHealthNarrativePanelView, 'stage' | 'busy' | 'canRead'>;
const blank = (): PanelData => ({ assessmentId: null, topicCount: 0, measureCount: 0, topicRows: [], measureRows: [], topicRemaining: 0, measureRemaining: 0, communicationSupport: null, selectedTopic: null, selectedMeasure: null, expanded: false });
const denied = () => Error('Der eigene aktuelle vertrauliche narrative Quellenbestand ist nicht bestätigt.');
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
    const tenantId = own(source, 'tenantId'), clientId = own(source, 'clientId'), assessmentId = own(source, 'assessmentId'), can = own(source, 'can'), origin = own(source, 'permissions');
    const copy = cloneClientNativeOriginal(origin), owner = carePermissionOwner(projected, typeof tenantId === 'string' ? tenantId : null, false);
    if (!owner || owner.demo || !woundUuid(clientId) || !woundUuid(assessmentId) || typeof can !== 'function' || !Array.isArray(copy) || !Object.isFrozen(origin) || copy.some(key => typeof key !== 'string') || !copy.includes('pflege.plans.view') || !copy.includes('office.clients.view_sensitive'))
        throw denied();
    return { owner, clientId, assessmentId, origin: origin as readonly unknown[], access: { auth: projected, tenantId: owner.tenantId, clientId, assessmentId, can: can as MentalPanelAccess['can'], permissions: origin as readonly unknown[] } };
}
function sameOwner(a: Context, b: Context): boolean { return sameCarePermissionOwner(a.owner, b.owner) && a.clientId === b.clientId && a.assessmentId === b.assessmentId; }
function live(entry: Entry, lifetime: MentalHealthNarrativePanelLifetime | null = entry.lifetime): boolean { return entry.alive && !entry.closed && !!lifetime && entry.lifetime === lifetime; }
function clearData(entry: Entry): void { entry.receipt = null; entry.originals = null; entry.history = null; entry.topicId = null; entry.measureId = null; entry.expanded = false; entry.topicLimit = 6; entry.measureLimit = 6; }
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
 * Both actual native keys are an additional local display restriction, not SIS-RLS parity or psychiatric need-to-know.
 * This unbound helper opens no product gate and grants no clinical diagnosis, contact, protection or case-specific authority. */
function currentAccess(entry: Entry): MentalHealthAccess {
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
        const can: MentalHealthAccess['can'] = key => {
            try {
                if (!live(entry) || entry.canChecking)
                    throw denied();
                entry.canChecking = true;
                for (const required of ['pflege.plans.view', 'office.clients.view_sensitive'] as const) {
                    const value: unknown = before.access.can(required);
                    if (value !== true) {
                        if (value instanceof Promise)
                            void value.catch(() => { });
                        throw denied();
                    }
                    const checked = captureContext(entry);
                    if (!live(entry) || !sameOwner(checked, before) || checked.origin !== before.origin)
                        throw denied();
                }
                if (key !== 'pflege.plans.view')
                    throw denied();
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
export function createMentalHealthNarrativePanelWeb(getAccess: () => MentalPanelAccess): MentalHealthNarrativePanelToken {
    if (typeof getAccess !== 'function')
        throw denied();
    const token = Object.freeze({});
    let entry: Entry;
    const reader = new MentalHealthOriginalReader(() => currentAccess(entry));
    entry = { getAccess, reader, alive: false, closed: false, checking: false, canChecking: false, lifetime: null, version: 0, readTicket: 0, anchor: null, stage: 'idle', receipt: null, originals: null, history: null, topicId: null, measureId: null,
        expanded: false, topicLimit: 6, measureLimit: 6, listeners: new Set() };
    entries.set(token, entry);
    return token;
}
/** Each effect attachment is an empty independent lifetime. A cleanup from an older mount cannot dispose its replacement. */
export function mountMentalHealthNarrativePanelWeb(token: MentalHealthNarrativePanelToken): MentalHealthNarrativePanelLifetime | null {
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
export function disposeMentalHealthNarrativePanelWeb(token: MentalHealthNarrativePanelToken, lifetime: MentalHealthNarrativePanelLifetime): void {
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
export function subscribeMentalHealthNarrativePanelWeb(token: MentalHealthNarrativePanelToken, lifetime: MentalHealthNarrativePanelLifetime, callback: () => void): () => void {
    const entry = entries.get(token);
    if (!entry || !entry.alive || entry.lifetime !== lifetime || typeof callback !== 'function')
        return () => { };
    const listener = { lifetime, notify: callback };
    entry.listeners.add(listener);
    return () => { entry.listeners.delete(listener); };
}
function currentData(entry: Entry, lifetime: MentalHealthNarrativePanelLifetime): boolean {
    if (!live(entry, lifetime) || !entry.receipt || !entry.originals || !entry.history)
        return false;
    try {
        const access = currentAccess(entry), db = getSupabaseClient();
        // The fixed context verifier checks this exact private rawpointer before and after its own
        // gates. Its actual reader access still requires both plans.view and view_sensitive.
        if (!db || !isCurrentMentalHealthOriginalContextWeb(entry.reader, entry.receipt, entry.originals, { auth: access.auth, tenantId: access.tenantId, clientId: access.clientId, assessmentId: access.assessmentId, sdk: db })
            || !currentMentalHealthNarrativeHistory(entry.history, entry.reader) || !live(entry, lifetime))
            throw denied();
        return true;
    }
    catch {
        close(entry);
        return false;
    }
}
function currentView(token: MentalHealthNarrativePanelToken, lifetime: MentalHealthNarrativePanelLifetime, view: MentalHealthNarrativePanelView): Entry | null {
    const entry = entries.get(token), receipt = views.get(view);
    if (!entry || !receipt || receipt.entry !== entry || receipt.lifetime !== lifetime || receipt.version !== entry.version || receipt.readTicket !== entry.readTicket || !live(entry, lifetime))
        return null;
    if (entry.stage === 'ready' && !currentData(entry, lifetime))
        return null;
    return live(entry, lifetime) ? entry : null;
}
/** Fresh fixed metadata only; raw assessment/topic/measure and native identity never cross the token boundary. */
export function mentalHealthNarrativePanelViewWeb(token: MentalHealthNarrativePanelToken, lifetime: MentalHealthNarrativePanelLifetime): MentalHealthNarrativePanelView | null {
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
        const topic = entry.topicId ? history.topics.find(row => row.id === entry.topicId) : null, measure = entry.measureId ? history.measures.find(row => row.id === entry.measureId) : null;
        data = { assessmentId: history.assessmentId, topicCount: history.topics.length, measureCount: history.measures.length,
            topicRows: history.topics.slice(0, entry.topicLimit).map(row => ({ id: row.id, topicKey: row.fields.topic_key, recordedAt: row.recordedAt })),
            measureRows: history.measures.slice(0, entry.measureLimit).map(row => ({ id: row.id, title: row.fields.title, recordedAt: row.recordedAt })),
            topicRemaining: Math.max(0, history.topics.length - entry.topicLimit), measureRemaining: Math.max(0, history.measures.length - entry.measureLimit),
            communicationSupport: topic ? history.person.fields.communication_support : null,
            selectedTopic: topic ? { id: topic.id, fields: { person_perspective: topic.fields.person_perspective, resources: topic.fields.resources, wishes: topic.fields.wishes, habits_biography: topic.fields.habits_biography }, informationSources: topic.informationSources, recordedAt: topic.recordedAt, updatedAt: topic.updatedAt } : null,
            selectedMeasure: measure ? { id: measure.id, fields: Object.fromEntries(['title', 'related_topic_key', 'related_risk_key', 'personal_goal', 'intervention', 'timing', 'frequency', 'person_contribution', 'relatives_contribution'].map(key => [key, measure.fields[key]])), recordedAt: measure.recordedAt, updatedAt: measure.updatedAt, reviewAgreement: measure.reviewAgreement } : null,
            expanded: entry.expanded };
        if (!currentData(entry, lifetime))
            data = blank();
    }
    const view = freezeClientNativeOriginal({ stage: entry.stage, busy: entry.stage === 'loading', canRead: live(entry, lifetime) && entry.stage !== 'loading', ...data }) as MentalHealthNarrativePanelView;
    // Cloning/projecting is not authority: inspect the whole private receipt again before delivery.
    if (entry.stage === 'ready' && !currentData(entry, lifetime))
        return mentalHealthNarrativePanelViewWeb(token, lifetime);
    if (!entry.alive || entry.lifetime !== lifetime)
        return null;
    views.set(view, { entry, lifetime, version: entry.version, readTicket: entry.readTicket });
    return view;
}
export async function readMentalHealthNarrativePanelWeb(token: MentalHealthNarrativePanelToken, lifetime: MentalHealthNarrativePanelLifetime, view: MentalHealthNarrativePanelView): Promise<boolean> {
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
    const originals = currentMentalHealthOriginalsWeb(entry.reader, result.data), history = captureMentalHealthNarrativeHistory(entry.reader, result.data);
    if (!originals || !history || currentMentalHealthOriginalsWeb(entry.reader, result.data) !== originals || !live(entry, lifetime) || entry.readTicket !== ticket) {
        close(entry);
        notify(entry);
        return false;
    }
    entry.receipt = result.data;
    entry.originals = originals;
    entry.history = history;
    entry.stage = 'ready';
    entry.version++;
    notify(entry);
    return currentData(entry, lifetime);
}
export function selectMentalHealthNarrativePanelWeb(token: MentalHealthNarrativePanelToken, lifetime: MentalHealthNarrativePanelLifetime, view: MentalHealthNarrativePanelView, kind: 'topic' | 'measure', id: string): boolean {
    const entry = currentView(token, lifetime, view);
    if (!entry || entry.stage !== 'ready' || !entry.history || !woundUuid(id))
        return false;
    const row = kind === 'topic' ? entry.history.topics.find(row => row.id === id) : kind === 'measure' ? entry.history.measures.find(row => row.id === id) : null;
    if (!row || !currentData(entry, lifetime))
        return false;
    entry.topicId = kind === 'topic' ? id : null;
    entry.measureId = kind === 'measure' ? id : null;
    entry.expanded = false;
    entry.version++;
    notify(entry);
    return live(entry, lifetime);
}
export function expandMentalHealthNarrativePanelWeb(token: MentalHealthNarrativePanelToken, lifetime: MentalHealthNarrativePanelLifetime, view: MentalHealthNarrativePanelView): boolean {
    const entry = currentView(token, lifetime, view);
    if (!entry || entry.stage !== 'ready' || (!entry.topicId && !entry.measureId) || !currentData(entry, lifetime))
        return false;
    entry.expanded = !entry.expanded;
    entry.version++;
    notify(entry);
    return live(entry, lifetime);
}
export function moreMentalHealthNarrativePanelWeb(token: MentalHealthNarrativePanelToken, lifetime: MentalHealthNarrativePanelLifetime, view: MentalHealthNarrativePanelView, kind: 'topic' | 'measure'): boolean {
    const entry = currentView(token, lifetime, view);
    if (!entry || entry.stage !== 'ready' || !entry.history || !currentData(entry, lifetime))
        return false;
    if (kind === 'topic' && entry.topicLimit < entry.history.topics.length)
        entry.topicLimit += 6;
    else if (kind === 'measure' && entry.measureLimit < entry.history.measures.length)
        entry.measureLimit += 6;
    else
        return false;
    entry.version++;
    notify(entry);
    return live(entry, lifetime);
}
