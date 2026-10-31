// Generated native presentation from src/lib/pflege/caseHandoverDomain.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { controlHistory, type ControlSource } from './clinicalControlDomain.ts';
import { decodeControlSnapshot, type ControlRecord } from './clinicalControlGateway.ts';
import { decodeControlSources } from './clinicalControlRuntime.ts';
import { sameWoundJson, woundInstant, woundUuid } from './woundCareDomain.ts';
/** Private Web contract. Original JSON and native microseconds are never normalized. */
export const caseHandoverVersion = '2026-10-16.1' as const;
export type NativeRow = Record<string, unknown>;
export type CaseRecipient = {
    id: string;
    tenantId: string;
    name: string;
    roleKey: string;
    updatedAt: string;
};
export type NativeCollection<T> = {
    count: number;
    rows: T[];
};
export type CaseHandoverContext = {
    version: typeof caseHandoverVersion;
    tenantId: string;
    clientId: string;
    actorId: string;
    loadedAt: string;
    client: NativeRow;
    contacts: NativeCollection<NativeRow>;
    risks: NativeCollection<NativeRow>;
    documents: NativeCollection<NativeRow>;
    sources: ControlSource[];
    controls: ControlRecord[];
    recipients: NativeCollection<CaseRecipient>;
};
export type ReviewedCaseDocument = {
    document: NativeRow;
    source: string;
    documentDate: string;
    readable: true;
    correctCase: true;
    note: string;
};
export type HandoverContent = {
    title: string;
    priority: 'normal' | 'important' | 'urgent' | 'critical';
    summary: string;
    client: NativeRow;
    sources: ControlSource[];
    documents: ReviewedCaseDocument[];
    tasks: ControlRecord[];
    recipients: CaseRecipient[];
    emergency: {
        contacts: NativeRow[];
        risks: NativeRow[];
        plans: ControlSource[];
        accessNote: string;
        limitations: string;
        reviewed: true;
    };
};
type CommandIdentity = {
    version: typeof caseHandoverVersion;
    requestId: string;
    eventId: string;
    tenantId: string;
    clientId: string;
    actorId: string;
    handoverId: string;
    expectedHeadId: string | null;
};
export type PublishCaseHandover = CommandIdentity & {
    kind: 'publish';
    reason: string;
    content: HandoverContent;
};
export type AcknowledgeCaseHandover = CommandIdentity & {
    kind: 'acknowledge';
    statement: string;
};
export type CloseCaseHandover = CommandIdentity & {
    kind: 'close';
    statement: string;
    taskSnapshots: ControlRecord[];
};
export type CaseHandoverCommand = PublishCaseHandover | AcknowledgeCaseHandover | CloseCaseHandover;
export type CaseHandoverEvent = {
    id: string;
    requestId: string;
    tenantId: string;
    clientId: string;
    handoverId: string;
    headId: string;
    kind: CaseHandoverCommand['kind'];
    actorId: string;
    actorName: string;
    recordedAt: string;
    command: CaseHandoverCommand;
};
export type CaseHandoverHistory = {
    version: typeof caseHandoverVersion;
    tenantId: string;
    clientId: string;
    handoverId: string;
    count: number;
    events: CaseHandoverEvent[];
};
export type CaseHandoverReceipt = {
    version: typeof caseHandoverVersion;
    requestId: string;
    command: CaseHandoverCommand;
    event: CaseHandoverEvent;
};
export type CaseHandoverState = {
    head: CaseHandoverEvent & {
        command: PublishCaseHandover;
    };
    revision: number;
    acknowledgements: CaseHandoverEvent[];
    pendingRecipients: CaseRecipient[];
    closure: CaseHandoverEvent | null;
    events: CaseHandoverEvent[];
};
export function handoverObject(v: unknown): v is NativeRow { return !!v && typeof v === 'object' && !Array.isArray(v); }
function exact(v: unknown, keys: string[]): v is NativeRow {
    return handoverObject(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
}
function fail(message: string): never { throw Error(message); }
function text(v: unknown, max = 8000, empty = false): v is string {
    return typeof v === 'string' && v.length <= max && (empty || !!v.trim()) && !v.includes('\u0000');
}
function id(v: unknown): v is string { return woundUuid(v) && v === v.toLowerCase(); }
function instant(v: unknown): v is string { return typeof v === 'string' && woundInstant(v) !== null; }
function date(v: unknown): v is string {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v))
        return false;
    const parsed = new Date(v + 'T12:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
}
const identityKeys = ['version', 'requestId', 'eventId', 'tenantId', 'clientId', 'actorId', 'handoverId', 'expectedHeadId'];
const recipientRoles = new Set(['business_admin', 'business_manager', 'nurse', 'caregiver', 'counselor']);
export const caseDocumentMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'text/plain'] as const;
function assertJson(v: unknown, maxBytes = 600000) {
    const visit = (x: unknown, depth = 0): void => {
        if (depth > 40)
            fail('Die Originaldaten sind zu tief verschachtelt.');
        if (x === null || typeof x === 'string' || typeof x === 'boolean' || typeof x === 'number' && Number.isFinite(x))
            return;
        if (Array.isArray(x)) {
            if (Reflect.ownKeys(x).length !== x.length + 1)
                fail('Die Originaldaten enthalten eine unvollständige Liste.');
            for (let i = 0; i < x.length; i++) {
                const d = Object.getOwnPropertyDescriptor(x, String(i));
                if (!d || !('value' in d) || !d.enumerable)
                    fail('Die Originalliste ist unvollständig.');
                visit(d.value, depth + 1);
            }
            return;
        }
        if (!handoverObject(x) || Object.getPrototypeOf(x) !== Object.prototype)
            fail('Die Originaldaten enthalten keinen einfachen JSON-Wert.');
        for (const key of Reflect.ownKeys(x)) {
            if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key))
                fail('Die Originaldaten enthalten einen ungültigen Schlüssel.');
            const d = Object.getOwnPropertyDescriptor(x, key);
            if (!d || !('value' in d) || !d.enumerable)
                fail('Die Originaldaten sind nicht vollständig lesbar.');
            visit(d.value, depth + 1);
        }
    };
    visit(v);
    const encoded = JSON.stringify(v);
    if (!encoded || encoded.length > maxBytes || !sameWoundJson(JSON.parse(encoded), v))
        fail('Die Originaldaten sind nicht vollständig als JSON darstellbar.');
}
function unique<T>(rows: T[], key: (r: T) => string, label: string) {
    if (new Set(rows.map(key)).size !== rows.length)
        fail(`${label} sind doppelt vorhanden.`);
}
function nativeRow(v: unknown, tenantId: string, clientId: string): asserts v is NativeRow {
    if (!handoverObject(v) || !id(v.id) || v.tenant_id !== tenantId || v.client_id !== clientId)
        fail('Originalbeleg gehört nicht zu dieser Pflegeakte.');
    assertJson(v);
}
function nativeRows(v: unknown, tenantId: string, clientId: string): NativeRow[] {
    if (!exact(v, ['count', 'rows']) || !Array.isArray(v.rows) || v.count !== v.rows.length || !Number.isSafeInteger(v.count))
        fail('Der Originalbestand ist unvollständig.');
    v.rows.forEach(row => nativeRow(row, tenantId, clientId));
    unique(v.rows, r => String(r.id), 'Originalbelege');
    return structuredClone(v.rows);
}
function recipient(v: unknown, tenantId: string): asserts v is CaseRecipient {
    if (!exact(v, ['id', 'tenantId', 'name', 'roleKey', 'updatedAt']) || !id(v.id) || v.tenantId !== tenantId ||
        !text(v.name, 2000) || typeof v.roleKey !== 'string' || !recipientRoles.has(v.roleKey) || !instant(v.updatedAt))
        fail('Die aktive Empfangsperson ist nicht bestätigt.');
}
function controls(v: unknown, tenantId: string, clientId: string, now: number): ControlRecord[] {
    if (!Array.isArray(v))
        fail('Die vollständigen Auftragsverläufe fehlen.');
    return decodeControlSnapshot({ version: '2026-10-09.1', tenantId, clientId, count: v.length, tasks: v }, tenantId, clientId, now);
}
function sources(v: unknown, tenantId: string, clientId: string): ControlSource[] {
    if (!Array.isArray(v))
        fail('Die Originalquellen fehlen.');
    return decodeControlSources({ version: '2026-10-09.1', tenantId, clientId, count: v.length, sources: v }, tenantId, clientId);
}
export function decodeCaseHandoverContext(v: unknown, scope: {
    tenantId: string;
    clientId: string;
    actorId: string;
}, now = Date.now()): CaseHandoverContext {
    if (![scope.tenantId, scope.clientId, scope.actorId].every(id))
        fail('Der native Fallkontext ist ungültig.');
    if (!exact(v, ['version', 'tenantId', 'clientId', 'actorId', 'loadedAt', 'client', 'contacts', 'risks', 'documents', 'sources', 'controls', 'recipients']) ||
        v.version !== caseHandoverVersion || v.tenantId !== scope.tenantId || v.clientId !== scope.clientId || v.actorId !== scope.actorId || !instant(v.loadedAt) ||
        !handoverObject(v.client) || v.client.id !== scope.clientId || v.client.tenant_id !== scope.tenantId)
        fail('Der aktuelle Fallkontext fehlt oder ist fremd.');
    assertJson(v, 12000000);
    const contacts = nativeRows(v.contacts, scope.tenantId, scope.clientId), risks = nativeRows(v.risks, scope.tenantId, scope.clientId);
    const documents = nativeRows(v.documents, scope.tenantId, scope.clientId);
    if (!exact(v.recipients, ['count', 'rows']) || !Array.isArray(v.recipients.rows) || v.recipients.count !== v.recipients.rows.length)
        fail('Die Empfangspersonen konnten nicht vollständig gelesen werden.');
    v.recipients.rows.forEach(p => recipient(p, scope.tenantId));
    unique(v.recipients.rows as CaseRecipient[], p => p.id, 'Empfangspersonen');
    return structuredClone({ ...v, contacts: { count: contacts.length, rows: contacts }, risks: { count: risks.length, rows: risks },
        documents: { count: documents.length, rows: documents }, sources: sources(v.sources, scope.tenantId, scope.clientId),
        controls: controls(v.controls, scope.tenantId, scope.clientId, now) }) as CaseHandoverContext;
}
export function validateHandoverContent(v: unknown, tenantId: string, clientId: string, now = Date.now()): asserts v is HandoverContent {
    if (!exact(v, ['title', 'priority', 'summary', 'client', 'sources', 'documents', 'tasks', 'recipients', 'emergency']) ||
        !text(v.title, 200) || !text(v.summary, 8000) || !['normal', 'important', 'urgent', 'critical'].includes(String(v.priority)) ||
        !handoverObject(v.client) || v.client.id !== clientId || v.client.tenant_id !== tenantId)
        fail('Titel, Anlass oder Pflegefall der Übergabe fehlen.');
    assertJson(v);
    const selectedSources = sources(v.sources, tenantId, clientId);
    const selectedTasks = controls(v.tasks, tenantId, clientId, now);
    if (selectedTasks.some(t => controlHistory(t.task, t.events, now).status !== 'open'))
        fail('Nur tatsächlich offene Originalaufträge können neu zugeordnet werden.');
    if (!Array.isArray(v.recipients) || v.recipients.length < 1 || v.recipients.length > 30)
        fail('Mindestens eine berechtigte Empfangsperson auswählen.');
    v.recipients.forEach(p => recipient(p, tenantId));
    unique(v.recipients as CaseRecipient[], p => p.id, 'Empfangspersonen');
    if (!Array.isArray(v.documents) || v.documents.length > 50)
        fail('Die Dokumentenauswahl ist ungültig.');
    for (const doc of v.documents) {
        if (!exact(doc, ['document', 'source', 'documentDate', 'readable', 'correctCase', 'note']) || doc.readable !== true || doc.correctCase !== true ||
            !text(doc.source, 1000) || !date(doc.documentDate) || !text(doc.note, 4000, true))
            fail('Dokumentherkunft, Datum, Lesbarkeit und richtige Fallzuordnung ausdrücklich prüfen.');
        nativeRow(doc.document, tenantId, clientId);
        if (!caseDocumentMimeTypes.includes(doc.document.mime_type as typeof caseDocumentMimeTypes[number]) || doc.document.status !== 'aktiv' ||
            !text(doc.document.title, 2000) || !instant(doc.document.updated_at))
            fail('Dieses Dokument ist nicht als lesbare aktive Fassung übernehmbar.');
    }
    unique(v.documents as ReviewedCaseDocument[], d => String(d.document.id), 'Dokumente');
    const e = v.emergency;
    if (!exact(e, ['contacts', 'risks', 'plans', 'accessNote', 'limitations', 'reviewed']) || e.reviewed !== true ||
        !text(e.accessNote, 2000) || !text(e.limitations, 4000) || !Array.isArray(e.contacts) || !Array.isArray(e.risks))
        fail('Notfallinformationen einschließlich unbekannter oder fehlender Angaben ausdrücklich prüfen.');
    e.contacts.forEach(r => nativeRow(r, tenantId, clientId));
    e.risks.forEach(r => nativeRow(r, tenantId, clientId));
    unique(e.contacts as NativeRow[], r => String(r.id), 'Kontakte');
    unique(e.risks as NativeRow[], r => String(r.id), 'Risiken');
    const plans = sources(e.plans, tenantId, clientId);
    if (plans.some(p => p.kind !== 'care_plan'))
        fail('Nur tatsächlich hinterlegte Pflegepläne dürfen als Planbezug ausgewählt werden.');
    if (!selectedSources.length && !v.documents.length && !selectedTasks.length && !e.contacts.length && !e.risks.length && !plans.length)
        fail('Mindestens einen tatsächlichen Aktenbeleg auswählen.');
}
/** Membership means exact original equality, not just a matching user-supplied ID. */
export function assertHandoverSelectionCurrent(content: HandoverContent, context: CaseHandoverContext, now = Date.now()) {
    validateHandoverContent(content, context.tenantId, context.clientId, now);
    if (!sameWoundJson(content.client, context.client))
        fail('Die Stammdaten haben sich geändert. Fallinformationen erneut prüfen.');
    const member = <T>(chosen: T[], pool: T[], key: (r: T) => string, label: string) => {
        for (const item of chosen)
            if (!pool.some(r => key(r) === key(item) && sameWoundJson(r, item)))
                fail(`${label} wurden geändert oder sind nicht mehr zugänglich. Auswahl erneut prüfen.`);
    };
    member(content.sources, context.sources, r => r.kind + ':' + r.id, 'Quellen');
    member(content.emergency.plans, context.sources, r => r.kind + ':' + r.id, 'Planbezüge');
    member(content.documents.map(d => d.document), context.documents.rows, r => String(r.id), 'Dokumente');
    member(content.emergency.contacts, context.contacts.rows, r => String(r.id), 'Kontakte');
    member(content.emergency.risks, context.risks.rows, r => String(r.id), 'Risiken');
    member(content.tasks, context.controls, r => r.task.id, 'Aufträge');
    member(content.recipients, context.recipients.rows, r => r.id, 'Empfangspersonen');
}
export function validateCaseHandoverCommand(v: unknown, now = Date.now()): asserts v is CaseHandoverCommand {
    if (!handoverObject(v) || v.version !== caseHandoverVersion || !['publish', 'acknowledge', 'close'].includes(String(v.kind)) ||
        !['requestId', 'eventId', 'tenantId', 'clientId', 'actorId', 'handoverId'].every(k => id(v[k])) ||
        !(v.expectedHeadId === null || id(v.expectedHeadId)))
        fail('Die Übergabeanfrage ist ungültig.');
    if (v.requestId === v.eventId || v.handoverId === v.eventId)
        fail('Anfrage, Übergabe und Ereignis benötigen getrennte Kennungen.');
    if (v.kind === 'publish') {
        if (!exact(v, [...identityKeys, 'kind', 'reason', 'content']) || !text(v.reason, 4000, v.expectedHeadId === null))
            fail('Eine neue Fassung benötigt einen nachvollziehbaren Änderungsgrund.');
        validateHandoverContent(v.content, v.tenantId as string, v.clientId as string, now);
    }
    else {
        if (v.expectedHeadId === null || !exact(v, [...identityKeys, 'kind', 'statement', ...(v.kind === 'close' ? ['taskSnapshots'] : [])]) || !text(v.statement, 4000))
            fail('Die genaue Fassung und eine tatsächliche Rückmeldung fehlen.');
        if (v.kind === 'close')
            controls(v.taskSnapshots, v.tenantId as string, v.clientId as string, now);
    }
    assertJson(v, 750000);
}
export function decodeCaseHandoverEvent(v: unknown, command?: CaseHandoverCommand, now = Date.now()): CaseHandoverEvent {
    if (!exact(v, ['id', 'requestId', 'tenantId', 'clientId', 'handoverId', 'headId', 'kind', 'actorId', 'actorName', 'recordedAt', 'command']) || !instant(v.recordedAt) || !text(v.actorName, 2000))
        fail('Der native Ereignisbeleg fehlt.');
    validateCaseHandoverCommand(v.command, now);
    const c = v.command;
    if (v.id !== c.eventId || v.requestId !== c.requestId || v.tenantId !== c.tenantId || v.clientId !== c.clientId || v.handoverId !== c.handoverId ||
        v.actorId !== c.actorId || v.kind !== c.kind || v.headId !== (c.kind === 'publish' ? c.eventId : c.expectedHeadId) || command && !sameWoundJson(command, c))
        fail('Anfrage und nativer Ereignisbeleg stimmen nicht überein.');
    return structuredClone(v) as CaseHandoverEvent;
}
export function decodeCaseHandoverReceipt(v: unknown, command: CaseHandoverCommand, now = Date.now()): CaseHandoverReceipt {
    if (!exact(v, ['version', 'requestId', 'command', 'event']) || v.version !== caseHandoverVersion || v.requestId !== command.requestId || !sameWoundJson(v.command, command))
        fail('Eine passende native Speicherquittung liegt noch nicht vor.');
    return { version: caseHandoverVersion, requestId: command.requestId, command: structuredClone(command), event: decodeCaseHandoverEvent(v.event, command, now) };
}
export function handoverTaskFollowUps(content: HandoverContent, current: ControlRecord[], tenantId: string, clientId: string, now = Date.now()) {
    const native = controls(current, tenantId, clientId, now);
    return content.tasks.map(original => {
        const present = native.find(r => r.task.id === original.task.id);
        return { original, current: present ?? null, state: present ? controlHistory(present.task, present.events, now) : null,
            changed: !!present && !sameWoundJson(original, present), accessible: !!present };
    });
}
export function assertHandoverClosable(state: CaseHandoverState, taskSnapshots: ControlRecord[], now = Date.now()) {
    if (state.closure)
        fail('Die Kommunikation zu dieser Übergabe ist bereits geschlossen.');
    if (state.pendingRecipients.length)
        fail('Der Empfang ist noch nicht von allen adressierten Personen bestätigt.');
    const c = state.head.command;
    const tasks = handoverTaskFollowUps(c.content, taskSnapshots, c.tenantId, c.clientId, now);
    if (tasks.length !== taskSnapshots.length || tasks.some(t => !t.accessible || t.state?.status === 'open'))
        fail('Zugeordnete Versorgungsaufträge fehlen oder sind noch offen. Im Originalauftrag weiterbearbeiten.');
}
export function decodeCaseHandoverHistory(v: unknown, scope: {
    tenantId: string;
    clientId: string;
    handoverId: string;
}, now = Date.now()): CaseHandoverState {
    if (!exact(v, ['version', 'tenantId', 'clientId', 'handoverId', 'count', 'events']) || v.version !== caseHandoverVersion ||
        v.tenantId !== scope.tenantId || v.clientId !== scope.clientId || v.handoverId !== scope.handoverId || !Array.isArray(v.events) ||
        v.count !== v.events.length || !v.events.length)
        fail('Der vollständige Übergabeverlauf fehlt.');
    let head: CaseHandoverState['head'] | null = null, revision = 0, acknowledgements: CaseHandoverEvent[] = [], closure: CaseHandoverEvent | null = null;
    let at: bigint | null = null;
    const events: CaseHandoverEvent[] = [], requests = new Set<string>(), ids = new Set<string>();
    for (const raw of v.events) {
        const e = decodeCaseHandoverEvent(raw, undefined, now), c = e.command;
        const time = woundInstant(e.recordedAt)!;
        if (c.tenantId !== scope.tenantId || c.clientId !== scope.clientId || c.handoverId !== scope.handoverId || ids.has(e.id) || requests.has(e.requestId) || at !== null && time < at || closure)
            fail('Die Übergabehistorie ist widersprüchlich oder abgeschnitten.');
        if (c.kind === 'publish') {
            if (c.expectedHeadId !== (head?.id ?? null))
                fail('Eine Übergabefassung fehlt in der Kette.');
            head = e as CaseHandoverState['head'];
            revision++;
            acknowledgements = [];
        }
        else {
            if (!head || c.expectedHeadId !== head.id)
                fail('Rückmeldung gehört nicht zur zu diesem Zeitpunkt aktuellen Fassung.');
            if (c.kind === 'acknowledge') {
                if (!head.command.content.recipients.some(p => p.id === c.actorId) || acknowledgements.some(a => a.actorId === c.actorId))
                    fail('Der Empfang ist fremd oder doppelt bestätigt.');
                acknowledgements.push(e);
            }
            else {
                const state = { head, revision, acknowledgements, pendingRecipients: head.command.content.recipients.filter(p => !acknowledgements.some(a => a.actorId === p.id)), closure, events };
                assertHandoverClosable(state, c.taskSnapshots, now);
                closure = e;
            }
        }
        ids.add(e.id);
        requests.add(e.requestId);
        events.push(e);
        at = time;
    }
    if (!head)
        fail('Die ursprüngliche Übergabefassung fehlt.');
    return { head, revision, acknowledgements, pendingRecipients: head.command.content.recipients.filter(p => !acknowledgements.some(a => a.actorId === p.id)), closure, events };
}
/** Safe, human-readable emergency excerpt. This does not establish clinical validity. */
export function caseEmergencyExcerpt(content: HandoverContent, recordedAt: string): string {
    validateHandoverContent(content, String(content.client.tenant_id), String(content.client.id));
    if (!instant(recordedAt))
        fail('Der belegte Stand der Notfallinformationen fehlt.');
    const escape = (v: unknown) => String(v ?? 'nicht hinterlegt').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));
    const fields = (r: NativeRow, names: string[]) => names.filter(k => r[k] !== undefined && r[k] !== null && r[k] !== '').map(k => `${escape(r[k])}`).join(' · ');
    const list = (values: string[]) => values.length ? `<ul>${values.map(x => `<li>${x}</li>`).join('')}</ul>` : '<p>Keine geprüfte Angabe in dieser Übergabe.</p>';
    return `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fallinformationen</title><style>body{font:18px/1.5 system-ui;max-width:54rem;padding:1.4rem;margin:auto;color:#152c41}h1,h2{line-height:1.25}li,p{overflow-wrap:anywhere}@media print{body{font-size:12pt}}</style><main><h1>Fallinformationen für die Übergabe</h1><p>${fields(content.client, ['first_name', 'last_name', 'date_of_birth', 'birth_date'])}</p><p>${fields(content.client, ['street', 'house_number', 'zip', 'postal_code', 'city'])}</p><p>Belegter Stand: ${escape(recordedAt)}</p><h2>Erreichbare Kontakte</h2>${list(content.emergency.contacts.map(r => fields(r, ['name', 'full_name', 'first_name', 'last_name', 'relationship', 'phone', 'mobile', 'email'])))}<h2>Dokumentierte Risiken</h2>${list(content.emergency.risks.map(r => fields(r, ['category', 'level', 'description', 'mitigation'])))}<h2>Hinterlegte Planbezüge</h2>${list(content.emergency.plans.map(p => fields(p.snapshot, ['title', 'status', 'updated_at'])))}<p>Planbezüge bescheinigen keine aktuelle medizinische Gültigkeit und sind keine Notfallanordnung.</p><h2>Zugang und Auffindbarkeit</h2><p>${escape(content.emergency.accessNote)}</p><h2>Fehlende Angaben und Prüfbedarf</h2><p>${escape(content.emergency.limitations)}</p><p>Dieser vertrauliche Auszug enthält ausschließlich die ausdrücklich geprüfte Auswahl dieser Übergabefassung.</p></main></html>`;
}
