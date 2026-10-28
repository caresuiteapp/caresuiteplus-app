// Generated native presentation from src/lib/pflege/supplyWorkspaceDomain.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { sameWoundJson, woundInstant, woundUuid } from './woundCareDomain.ts';
/** Case stock is a new ledger. Legacy inventory items never imply consumable quantities. */
export const supplyVersion = '2026-10-16.1' as const;
export type SupplyRow = Record<string, unknown>;
export type SupplyScope = {
    tenantId: string;
    clientId: string;
    actorId: string;
};
export const supplyKinds = ['article', 'hygiene_plan', 'infection', 'order', 'receipt', 'consume', 'hold', 'release_lot', 'dispose', 'count', 'approve_count', 'reverse_stock', 'device_check', 'device_training', 'device_release', 'device_use', 'cleaning', 'housekeeping', 'key'] as const;
export type SupplyKind = typeof supplyKinds[number];
export type SupplySource = {
    kind: 'qm_version' | 'asset' | 'case_document';
    id: string;
    snapshot: SupplyRow;
};
export type SupplyPerson = {
    id: string;
    tenantId: string;
    name: string;
    roleKey: string;
    updatedAt: string;
};
export type SupplyCommand = SupplyScope & {
    version: typeof supplyVersion;
    requestId: string;
    eventId: string;
    expectedHeadId: string | null;
    kind: SupplyKind;
    occurredAt: string;
    note: string;
    payload: SupplyRow;
};
export type SupplyEvent = {
    id: string;
    sequence: number;
    previousId: string | null;
    tenantId: string;
    clientId: string;
    actorId: string;
    actorName: string;
    recordedAt: string;
    command: SupplyCommand;
};
export type SupplyHistory = {
    version: typeof supplyVersion;
    tenantId: string;
    clientId: string;
    count: number;
    headId: string | null;
    events: SupplyEvent[];
};
export type SupplyReceipt = {
    version: typeof supplyVersion;
    requestId: string;
    command: SupplyCommand;
    event: SupplyEvent;
};
export type SupplyContext = SupplyScope & {
    version: typeof supplyVersion;
    loadedAt: string;
    client: SupplyRow;
    sources: {
        count: number;
        rows: SupplySource[];
    };
    people: {
        count: number;
        rows: SupplyPerson[];
    };
    history: SupplyHistory;
};
export type SupplyArticle = {
    id: string;
    name: string;
    unit: string;
    minimum: number;
    supplier: string;
};
export type SupplyOrder = {
    id: string;
    articleId: string;
    quantity: number;
    received: number;
    supplier: string;
    reference: string;
};
export type SupplyLot = {
    id: string;
    articleId: string;
    orderId: string;
    batch: string;
    expiry: string;
    location: string;
    quantity: number;
    held: boolean;
    headId: string;
};
export type SupplyState = {
    headId: string | null;
    events: SupplyEvent[];
    articles: SupplyArticle[];
    orders: SupplyOrder[];
    lots: SupplyLot[];
    reversed: string[];
};
export const supplyLabels: Record<SupplyKind, string> = {
    article: 'Artikel und Mengeneinheit', hygiene_plan: 'Hygieneplan am Einsatzort', infection: 'Infektionsstatus dokumentieren', order: 'Bestellung erfassen', receipt: 'Tatsächlichen Wareneingang buchen', consume: 'Verbrauch buchen', hold: 'Charge sperren / Rückruf', release_lot: 'Chargensperre aufheben', dispose: 'Tatsächliche Entsorgung buchen', count: 'Bestand zählen', approve_count: 'Zähldifferenz prüfen und buchen', reverse_stock: 'Mengenbuchung berichtigen', device_check: 'Geräteprüfung dokumentieren', device_training: 'Eigene Geräteeinweisung bestätigen', device_release: 'Gerät für eigene Nutzung prüfen', device_use: 'Eigene tatsächliche Gerätenutzung', cleaning: 'Reinigung / Desinfektion dokumentieren', housekeeping: 'Hauswirtschaft dokumentieren', key: 'Schlüsselübergabe und Verlustbearbeitung',
};
export const supplyBaseRights = ['office.clients.view', 'inventory.view', 'inventory.audit_view'] as const;
export function supplyWriteRights(kind: SupplyKind, payload: SupplyRow = {}): string[] {
    if (kind === 'infection')
        return ['pflege.risks.manage'];
    if (kind === 'hygiene_plan')
        return ['qm.view', 'qm.view_versions', 'pflege.plans.manage'];
    if (kind === 'housekeeping')
        return ['assist.records.create'];
    if (kind === 'key')
        return payload.action === 'return' ? ['inventory.return_manage'] : payload.action === 'lost' ? ['inventory.report_damage'] : ['block', 'resolve'].includes(String(payload.action)) ? ['inventory.manage_items'] : ['inventory.issue'];
    if (kind === 'consume' || kind === 'device_use' || kind === 'device_training')
        return ['inventory.issue'];
    return ['inventory.manage_items'];
}
export function supplyReadRights(kind: SupplyKind): string[] {
    if (kind === 'infection')
        return ['pflege.risks.view'];
    if (kind === 'hygiene_plan')
        return ['qm.view', 'qm.view_versions', 'pflege.documentation.view'];
    if (kind === 'housekeeping')
        return ['assist.records.view'];
    return [];
}
export const supplyObject = (v: unknown): v is SupplyRow => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
export const supplyId = (v: unknown): v is string => woundUuid(v) && v === v.toLowerCase();
function fail(m: string): never { throw Error(m); }
function exact(v: unknown, keys: string[]): v is SupplyRow { return supplyObject(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k)); }
export function supplyJson(value: unknown, limit = 2000000) {
    const visit = (v: unknown, depth = 0): void => {
        if (depth > 30)
            fail('Die Originaldaten sind zu tief verschachtelt.');
        if (v === null || typeof v === 'boolean' || typeof v === 'string' && !v.includes('\u0000') || typeof v === 'number' && Number.isFinite(v))
            return;
        if (Array.isArray(v)) {
            if (Reflect.ownKeys(v).length !== v.length + 1)
                fail('Die Originalliste ist unvollständig.');
            for (let i = 0; i < v.length; i++) {
                const d = Object.getOwnPropertyDescriptor(v, String(i));
                if (!d || !('value' in d) || !d.enumerable)
                    fail('Die Originalliste ist nicht vollständig lesbar.');
                visit(d.value, depth + 1);
            }
            return;
        }
        if (!supplyObject(v))
            fail('Es werden vollständige einfache JSON-Originale benötigt.');
        for (const key of Reflect.ownKeys(v)) {
            const d = Object.getOwnPropertyDescriptor(v, key);
            if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key) || !d || !d.enumerable || !('value' in d))
                fail('Die Originaldaten enthalten einen unzulässigen Schlüssel.');
            visit(d.value, depth + 1);
        }
    };
    visit(value);
    const encoded = JSON.stringify(value);
    if (!encoded || encoded.length > limit || !sameWoundJson(JSON.parse(encoded), value))
        fail('Der vollständige Originalbestand ist nicht darstellbar.');
}
function string(v: unknown, max = 4000): v is string { return typeof v === 'string' && !!v.trim() && v.length <= max && !v.includes('\u0000'); }
export function supplyDate(v: unknown): v is string { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(new Date(v + 'T12:00:00Z').getTime()) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v; }
function quantity(v: unknown, zero = false): v is number { return Number.isSafeInteger(v) && Number(v) >= (zero ? 0 : 1) && Number(v) <= 1000000000; }
function time(v: unknown): v is string { return typeof v === 'string' && woundInstant(v) !== null; }
const at = (v: string) => woundInstant(v)!;
const day = (v: string) => new Date(v).toISOString().slice(0, 10);
function requirePayload(p: SupplyRow, keys: string[]) { if (!exact(p, keys))
    fail('Die Angaben für diesen Vorgang sind unvollständig oder enthalten fremde Felder.'); }
function choice(p: SupplyRow, key: string, values: readonly string[]) { if (!values.includes(String(p[key])))
    fail('Eine eindeutige Auswahl für ' + key + ' fehlt.'); }
function words(p: SupplyRow, keys: string[]) { if (keys.some(k => !string(p[k])))
    fail('Tätigkeit, Herkunft oder Nachweis fehlen.'); }
function ids(p: SupplyRow, keys: string[]) { if (keys.some(k => !supplyId(p[k])))
    fail('Den zugehörigen Originalbeleg auswählen.'); }
function person(v: unknown, tenantId: string): asserts v is SupplyPerson {
    if (!exact(v, ['id', 'tenantId', 'name', 'roleKey', 'updatedAt']) || !supplyId(v.id) || v.tenantId !== tenantId || !string(v.name, 2000) || !['business_admin', 'business_manager', 'nurse', 'caregiver', 'counselor', 'dispatch', 'billing', 'akademie_admin'].includes(String(v.roleKey)) || !time(v.updatedAt))
        fail('Die zuständige aktive Person fehlt.');
}
function source(v: unknown, tenantId: string, clientId: string, allowed: SupplySource['kind'][]): asserts v is SupplySource {
    if (!exact(v, ['kind', 'id', 'snapshot']) || !allowed.includes(v.kind as SupplySource['kind']) || !supplyId(v.id) || !supplyObject(v.snapshot) || v.snapshot.tenant_id !== tenantId)
        fail('Der vollständige Originalbezug fehlt.');
    supplyJson(v);
    if (v.kind === 'qm_version') {
        const d = v.snapshot.document, r = v.snapshot.version;
        if (!supplyObject(d) || !supplyObject(r) || d.tenant_id !== tenantId || r.tenant_id !== tenantId || r.id !== v.id || d.current_version_id !== v.id || r.document_id !== d.id || !['approved', 'published'].includes(String(d.status)) || !['approved', 'published'].includes(String(r.status)))
            fail('Eine aktuelle freigegebene QM-Fassung auswählen.');
    }
    else if (v.snapshot.id !== v.id || v.kind === 'case_document' && (v.snapshot.client_id !== clientId || v.snapshot.status !== 'aktiv'))
        fail('Der Originalbezug gehört nicht zu diesem Fall.');
}
const medicalHousekeeping = /medikament|injektion|insulin|wund|verband|katheter|infusion|behandlungspflege|sauerstoff|kompression|absaug|tracheo|blutzucker|stoma|intimpflege|körperpflege/i;
export function validateSupplyCommand(v: unknown, now = Date.now()): asserts v is SupplyCommand {
    if (!exact(v, ['version', 'requestId', 'eventId', 'tenantId', 'clientId', 'actorId', 'expectedHeadId', 'kind', 'occurredAt', 'note', 'payload']) || v.version !== supplyVersion || !['requestId', 'eventId', 'tenantId', 'clientId', 'actorId'].every(k => supplyId(v[k])) || v.requestId === v.eventId || !(v.expectedHeadId === null || supplyId(v.expectedHeadId)) || !supplyKinds.includes(v.kind as SupplyKind) || !time(v.occurredAt) || at(v.occurredAt as string) > BigInt(Math.trunc(now)) * 1000n || !string(v.note) || !supplyObject(v.payload))
        fail('Der Fallvorgang ist ungültig. Tatsächliche Zeit und Anlass prüfen.');
    supplyJson(v);
    const p = v.payload, tenant = v.tenantId as string, client = v.clientId as string;
    switch (v.kind as SupplyKind) {
        case 'article':
            requirePayload(p, ['name', 'unit', 'minimum', 'supplier']);
            words(p, ['name', 'unit', 'supplier']);
            if (!quantity(p.minimum, true))
                fail('Der Mindestbestand muss eine ganze Menge der kleinsten Einheit sein.');
            break;
        case 'hygiene_plan':
            requirePayload(p, ['qm', 'activity', 'site', 'protection', 'validFrom', 'validUntil', 'responsible']);
            source(p.qm, tenant, client, ['qm_version']);
            words(p, ['activity', 'site', 'protection']);
            person(p.responsible, tenant);
            if (!supplyDate(p.validFrom) || !supplyDate(p.validUntil) || p.validFrom > p.validUntil)
                fail('Den tatsächlichen Gültigkeitszeitraum angeben.');
            break;
        case 'infection':
            requirePayload(p, ['status', 'organism', 'document', 'planId', 'observedAt', 'limitations']);
            choice(p, 'status', ['suspected', 'confirmed', 'ruled_out']);
            words(p, ['organism', 'limitations']);
            source(p.document, tenant, client, ['case_document']);
            ids(p, ['planId']);
            if (!time(p.observedAt) || at(p.observedAt) > at(v.occurredAt as string))
                fail('Die ursprüngliche Befundzeit fehlt oder liegt nach der Dokumentation.');
            break;
        case 'order':
            requirePayload(p, ['articleId', 'quantity', 'supplier', 'reference']);
            ids(p, ['articleId']);
            words(p, ['supplier', 'reference']);
            if (!quantity(p.quantity))
                fail('Eine positive ganze Bestellmenge angeben.');
            break;
        case 'receipt':
            requirePayload(p, ['orderId', 'quantity', 'batch', 'expiry', 'location', 'document']);
            ids(p, ['orderId']);
            words(p, ['batch', 'location']);
            source(p.document, tenant, client, ['case_document']);
            if (!quantity(p.quantity) || !supplyDate(p.expiry))
                fail('Eingangsmenge und tatsächliches Verfallsdatum angeben.');
            break;
        case 'consume':
            requirePayload(p, ['lotId', 'quantity', 'planId', 'activity', 'site', 'execution']);
            ids(p, ['lotId', 'planId']);
            words(p, ['activity', 'site']);
            source(p.execution, tenant, client, ['case_document']);
            if (!quantity(p.quantity))
                fail('Eine positive ganze Verbrauchsmenge angeben.');
            break;
        case 'hold':
        case 'release_lot':
            requirePayload(p, ['lotId', 'reason', 'document']);
            ids(p, ['lotId']);
            words(p, ['reason']);
            source(p.document, tenant, client, ['case_document']);
            break;
        case 'dispose':
            requirePayload(p, ['lotId', 'quantity', 'method', 'document']);
            ids(p, ['lotId']);
            words(p, ['method']);
            source(p.document, tenant, client, ['case_document']);
            if (!quantity(p.quantity))
                fail('Die tatsächlich entsorgte Menge fehlt.');
            break;
        case 'count':
            requirePayload(p, ['lotId', 'lotHeadId', 'expected', 'counted']);
            ids(p, ['lotId', 'lotHeadId']);
            if (!quantity(p.expected, true) || !quantity(p.counted, true))
                fail('Soll- und Ist-Menge müssen ganze Mengen sein.');
            break;
        case 'approve_count':
            requirePayload(p, ['countId', 'reason']);
            ids(p, ['countId']);
            words(p, ['reason']);
            break;
        case 'reverse_stock':
            requirePayload(p, ['targetId', 'reason']);
            ids(p, ['targetId']);
            words(p, ['reason']);
            break;
        case 'device_check':
            requirePayload(p, ['asset', 'type', 'result', 'dueAt', 'document']);
            source(p.asset, tenant, client, ['asset']);
            source(p.document, tenant, client, ['case_document']);
            choice(p, 'type', ['maintenance', 'inspection', 'calibration']);
            choice(p, 'result', ['passed', 'failed']);
            if (!time(p.dueAt) || at(p.dueAt) <= at(v.occurredAt as string))
                fail('Die nächste tatsächliche Prüffälligkeit angeben.');
            break;
        case 'device_training':
            requirePayload(p, ['asset', 'document', 'instructor']);
            source(p.asset, tenant, client, ['asset']);
            source(p.document, tenant, client, ['case_document']);
            words(p, ['instructor']);
            break;
        case 'device_release':
        case 'device_use':
            requirePayload(p, ['asset', 'planId', 'activity', 'site']);
            source(p.asset, tenant, client, ['asset']);
            ids(p, ['planId']);
            words(p, ['activity', 'site']);
            break;
        case 'cleaning':
            requirePayload(p, ['asset', 'method', 'agent', 'result', 'deviation', 'document']);
            source(p.asset, tenant, client, ['asset']);
            source(p.document, tenant, client, ['case_document']);
            words(p, ['method', 'agent', 'deviation']);
            choice(p, 'result', ['passed', 'failed']);
            break;
        case 'housekeeping':
            requirePayload(p, ['category', 'activity', 'site', 'startedAt', 'endedAt', 'outcome', 'deviation', 'document']);
            choice(p, 'category', ['cleaning', 'laundry', 'shopping', 'meals', 'everyday_support']);
            choice(p, 'outcome', ['done', 'not_done']);
            words(p, ['activity', 'site', 'deviation']);
            source(p.document, tenant, client, ['case_document']);
            if (medicalHousekeeping.test(String(p.activity)) || !time(p.startedAt) || !time(p.endedAt) || at(p.startedAt) > at(p.endedAt) || at(p.endedAt) > at(v.occurredAt as string))
                fail('Nur Hauswirtschaft und Alltagshilfe mit ihren tatsächlichen Zeiten dokumentieren.');
            break;
        case 'key':
            requirePayload(p, ['asset', 'action', 'responsible', 'reference', 'document']);
            source(p.asset, tenant, client, ['asset']);
            source(p.document, tenant, client, ['case_document']);
            person(p.responsible, tenant);
            choice(p, 'action', ['offer', 'acknowledge', 'return', 'lost', 'block', 'resolve']);
            words(p, ['reference']);
            if ((/\b(pin|passwort|kennwort|türcode|zugangscode)\b/i.test(String(p.reference)) || /^\s*[0-9]{4,12}\s*$/.test(String(p.reference))))
                fail('Nur eine nicht geheime Vorgangsreferenz speichern; keine PIN oder Zugangscodes.');
            break;
    }
}
function latest(events: SupplyEvent[], kind: SupplyKind, predicate: (p: SupplyRow, e: SupplyEvent) => boolean) { return events.findLast(e => e.command.kind === kind && predicate(e.command.payload, e)); }
export function activeSupplyPlan(state: SupplyState, planId: unknown, occurredAt: string, activity: unknown, site: unknown) {
    const plan = state.events.find(e => e.id === planId && e.command.kind === 'hygiene_plan');
    if (!plan || (plan.command.payload.validFrom as string) > day(occurredAt) || (plan.command.payload.validUntil as string) < day(occurredAt) || at(plan.command.occurredAt) > at(occurredAt) || plan.command.payload.activity !== activity || plan.command.payload.site !== site)
        fail('Der ausgewählte Hygieneplan passt nicht zu Tätigkeit, Einsatzstelle oder tatsächlichem Datum.');
    const p = plan.command.payload;
    if (latest(state.events, 'hygiene_plan', q => q.activity === p.activity && q.site === p.site)?.id !== plan.id)
        fail('Für Tätigkeit und Einsatzstelle liegt eine neuere Hygienezuordnung vor.');
    return plan;
}
function assetId(p: SupplyRow) { return (p.asset as SupplySource).id; }
export function assertSupplyDeviceReady(state: SupplyState, c: SupplyCommand, requireRelease: boolean, now = Date.now()) {
    const p = c.payload, asset = p.asset as SupplySource, match = (q: SupplyRow) => assetId(q) === asset.id;
    if (asset.snapshot.group_key !== 'devices' || !['available', 'assigned', 'in_use', 'reserved', 'returned'].includes(String(asset.snapshot.status)) || ['damaged', 'unusable', 'lost', 'unknown'].includes(String(asset.snapshot.condition)))
        fail('Der native Gerätebestand erlaubt keine bestätigte eigene Nutzung.');
    activeSupplyPlan(state, p.planId, c.occurredAt, p.activity, p.site);
    const check = latest(state.events, 'device_check', match), training = latest(state.events, 'device_training', (q, e) => match(q) && e.actorId === c.actorId), cleaning = latest(state.events, 'cleaning', match), used = latest(state.events, 'device_use', match);
    if (!check || check.command.payload.result !== 'passed' || at(check.command.payload.dueAt as string) <= at(c.occurredAt) || at(check.command.payload.dueAt as string) <= BigInt(Math.trunc(now)) * 1000n || !training || !cleaning || cleaning.command.payload.result !== 'passed' || used && cleaning.sequence < used.sequence || [check, training, cleaning].some(e => !sameWoundJson(e.command.payload.asset, asset) || at(e.command.occurredAt) > at(c.occurredAt)))
        fail('Aktuelle Prüfung, eigene Einweisung und Reinigung müssen einzeln mit derselben Gerätefassung belegt sein.');
    if (requireRelease) {
        const released = latest(state.events, 'device_release', (q, e) => match(q) && e.actorId === c.actorId);
        if (!released || [check, training, cleaning, ...(used ? [used] : [])].some(e => e.sequence > released.sequence) || !sameWoundJson(released.command.payload, p) || at(released.command.occurredAt) > at(c.occurredAt))
            fail('Vor dieser eigenen Nutzung die aktuellen Nachweise ausdrücklich freigeben.');
    }
}
/** Replaying originals never promotes a procurement, acknowledgement or stock move to care. */
export function applySupplyCommand(previous: SupplyState, c: SupplyCommand, now = Date.now()): SupplyState { return foldSupplyCommand(previous, c, now, true); }
function foldSupplyCommand(previous: SupplyState, c: SupplyCommand, now: number, copy: boolean): SupplyState {
    validateSupplyCommand(c, now);
    if (c.expectedHeadId !== previous.headId || previous.events.some(e => e.id === c.eventId || e.command.requestId === c.requestId))
        fail('Der Fallbestand wurde geändert oder die Anfrage ist bereits enthalten. Neu laden.');
    const s: SupplyState = copy ? structuredClone(previous) : previous, p = c.payload;
    const article = (id: unknown) => s.articles.find(a => a.id === id) ?? fail('Der Originalartikel fehlt.');
    const lot = (id: unknown) => s.lots.find(l => l.id === id) ?? fail('Die Originalcharge fehlt.');
    const add = (l: SupplyLot, delta: number, hold = l.held) => { if (!quantity(l.quantity + delta, true))
        fail('Die Buchung würde einen negativen oder zu großen Bestand erzeugen.'); l.quantity += delta; l.headId = c.eventId; l.held = hold; };
    switch (c.kind) {
        case 'article':
            s.articles.push({ id: c.eventId, name: p.name as string, unit: p.unit as string, minimum: p.minimum as number, supplier: p.supplier as string });
            break;
        case 'infection': {
            const plan = s.events.find(e => e.id === p.planId && e.command.kind === 'hygiene_plan') ?? fail('Die tatsächlich zugeordnete Schutzmaßnahme fehlt.');
            activeSupplyPlan(s, p.planId, c.occurredAt, plan.command.payload.activity, plan.command.payload.site);
            break;
        }
        case 'order':
            article(p.articleId);
            s.orders.push({ id: c.eventId, articleId: p.articleId as string, quantity: p.quantity as number, received: 0, supplier: p.supplier as string, reference: p.reference as string });
            break;
        case 'receipt': {
            const o = s.orders.find(o => o.id === p.orderId) ?? fail('Die Bestellung fehlt.');
            if (o.received + Number(p.quantity) > o.quantity)
                fail('Der tatsächliche Eingang überschreitet die offene Bestellmenge. Abweichung getrennt klären.');
            o.received += Number(p.quantity);
            s.lots.push({ id: c.eventId, articleId: o.articleId, orderId: o.id, batch: p.batch as string, expiry: p.expiry as string, location: p.location as string, quantity: p.quantity as number, held: (p.expiry as string) < day(c.occurredAt), headId: c.eventId });
            break;
        }
        case 'consume': {
            const l = lot(p.lotId);
            activeSupplyPlan(s, p.planId, c.occurredAt, p.activity, p.site);
            if (l.held || l.expiry < day(c.occurredAt) || l.expiry < day(new Date(now).toISOString()))
                fail('Gesperrte oder abgelaufene Charge darf nicht als nutzbarer Verbrauch gebucht werden.');
            add(l, -Number(p.quantity));
            break;
        }
        case 'dispose':
            add(lot(p.lotId), -Number(p.quantity));
            break;
        case 'hold': {
            const l = lot(p.lotId);
            if (l.held)
                fail('Die Charge ist bereits gesperrt.');
            l.held = true;
            l.headId = c.eventId;
            break;
        }
        case 'release_lot': {
            const l = lot(p.lotId);
            if (!l.held || l.expiry < day(c.occurredAt) || l.expiry < day(new Date(now).toISOString()))
                fail('Nur eine aktuell haltbare gesperrte Charge kann ausdrücklich freigegeben werden.');
            l.held = false;
            l.headId = c.eventId;
            break;
        }
        case 'count': {
            const l = lot(p.lotId);
            if (l.headId !== p.lotHeadId || l.quantity !== p.expected)
                fail('Die Sollmenge hat sich seit Beginn der Zählung geändert. Neu zählen.');
            break;
        }
        case 'approve_count': {
            const e = s.events.find(e => e.id === p.countId && e.command.kind === 'count') ?? fail('Der vollständige Zählbeleg fehlt.'), q = e.command.payload, l = lot(q.lotId);
            if (e.actorId === c.actorId || s.events.some(e => e.command.kind === 'approve_count' && e.command.payload.countId === p.countId))
                fail('Die Zählung benötigt eine andere prüfende Person und darf nur einmal gebucht werden.');
            if (l.headId !== q.lotHeadId || l.quantity !== q.expected)
                fail('Seit der Zählung gab es eine Bestandsänderung. Erneut zählen.');
            add(l, Number(q.counted) - l.quantity, true);
            break;
        }
        case 'reverse_stock': {
            const e = s.events.find(e => e.id === p.targetId && ['receipt', 'consume', 'dispose'].includes(e.command.kind)) ?? fail('Nur eine ursprüngliche Mengenbuchung kann berichtigt werden.');
            if (s.reversed.includes(e.id))
                fail('Diese Mengenbuchung wurde bereits berichtigt.');
            const q = e.command.payload, l = lot(e.command.kind === 'receipt' ? e.id : q.lotId);
            add(l, (e.command.kind === 'receipt' ? -1 : 1) * Number(q.quantity), true);
            if (e.command.kind === 'receipt')
                s.orders.find(o => o.id === l.orderId)!.received -= Number(q.quantity);
            s.reversed.push(e.id);
            break;
        }
        case 'device_check':
        case 'device_training':
        case 'cleaning':
            if ((p.asset as SupplySource).snapshot.group_key !== 'devices')
                fail('Ein tatsächliches Gerät auswählen.');
            break;
        case 'device_release':
            assertSupplyDeviceReady(s, c, false, now);
            break;
        case 'device_use':
            assertSupplyDeviceReady(s, c, true, now);
            break;
        case 'key': {
            if ((p.asset as SupplySource).snapshot.group_key !== 'keys_access')
                fail('Ein tatsächliches Schlüssel- oder Zugangsobjekt auswählen.');
            const old = latest(s.events, 'key', q => assetId(q) === assetId(p)), action = p.action, responsible = p.responsible as SupplyPerson;
            const prior = old?.command.payload.action, holder = old?.command.payload.responsible as SupplyPerson | undefined;
            if (action === 'offer') {
                if (prior && !['return', 'resolve'].includes(String(prior)))
                    fail('Dieser Schlüssel hat noch einen offenen Verwahrungsvorgang.');
            }
            else {
                if (!old || !holder || assetId(p) !== assetId(old.command.payload) || responsible.id !== holder.id)
                    fail('Schlüssel und ursprüngliche verwahrende Person müssen übereinstimmen.');
                const permitted = action === 'acknowledge' ? prior === 'offer' && c.actorId === holder.id : action === 'return' ? prior === 'acknowledge' && c.actorId === holder.id : action === 'lost' ? prior === 'acknowledge' && c.actorId === holder.id : action === 'block' ? prior === 'lost' : action === 'resolve' ? prior === 'block' : false;
                if (!permitted)
                    fail('Diese Schlüsselaktion passt nicht zur eigenen Verwahrung oder zur bisherigen Verlustbearbeitung.');
            }
            break;
        }
    }
    s.headId = c.eventId;
    return s;
}
export function emptySupplyState(): SupplyState { return { headId: null, events: [], articles: [], orders: [], lots: [], reversed: [] }; }
export function decodeSupplyHistory(v: unknown, scope: Pick<SupplyScope, 'tenantId' | 'clientId'>, now = Date.now()): {
    history: SupplyHistory;
    state: SupplyState;
} {
    if (!exact(v, ['version', 'tenantId', 'clientId', 'count', 'headId', 'events']) || v.version !== supplyVersion || v.tenantId !== scope.tenantId || v.clientId !== scope.clientId || !Array.isArray(v.events) || v.count !== v.events.length || v.events.length > 10000)
        fail('Der vollständige Fallbuchungsverlauf fehlt.');
    supplyJson(v, 12000000);
    let state = emptySupplyState();
    const requests = new Set<string>();
    let recorded: bigint | null = null;
    for (const original of v.events) {
        if (!exact(original, ['id', 'sequence', 'previousId', 'tenantId', 'clientId', 'actorId', 'actorName', 'recordedAt', 'command']) || !supplyId(original.id) || original.tenantId !== scope.tenantId || original.clientId !== scope.clientId || original.sequence !== state.events.length + 1 || original.previousId !== state.headId || !string(original.actorName, 2000) || !time(original.recordedAt) || at(original.recordedAt) > BigInt(Math.trunc(now)) * 1000n || recorded !== null && at(original.recordedAt) < recorded)
            fail('Die Originalereigniskette ist abgeschnitten oder widersprüchlich.');
        const e = original as unknown as SupplyEvent, c = e.command;
        validateSupplyCommand(c, Number(at(e.recordedAt) / 1000n) + 1);
        if (c.eventId !== e.id || c.tenantId !== e.tenantId || c.clientId !== e.clientId || c.actorId !== e.actorId || requests.has(c.requestId) || at(c.occurredAt) > at(e.recordedAt))
            fail('Die Originalanfrage passt nicht zum gespeicherten Ereignis.');
        // Historical validity is evaluated at its original record time, never at today's stock expiry.
        state = foldSupplyCommand(state, c, Number(at(e.recordedAt) / 1000n) + 1, false);
        state.events.push(structuredClone(e));
        requests.add(c.requestId);
        recorded = at(e.recordedAt);
    }
    if (v.headId !== state.headId)
        fail('Der gemeldete Kopf passt nicht zur vollständigen Originalhistorie.');
    return { history: structuredClone(v) as SupplyHistory, state };
}
export function decodeSupplyContext(v: unknown, scope: SupplyScope, now = Date.now()): SupplyContext {
    if (!exact(v, ['version', 'tenantId', 'clientId', 'actorId', 'loadedAt', 'client', 'sources', 'people', 'history']) || v.version !== supplyVersion || !Object.entries(scope).every(([k, x]) => supplyId(x) && v[k] === x) || !time(v.loadedAt) || !supplyObject(v.client) || v.client.id !== scope.clientId || v.client.tenant_id !== scope.tenantId || !exact(v.sources, ['count', 'rows']) || !Array.isArray(v.sources.rows) || v.sources.count !== v.sources.rows.length || !exact(v.people, ['count', 'rows']) || !Array.isArray(v.people.rows) || v.people.count !== v.people.rows.length)
        fail('Der vollständige aktuelle Fallkontext ist nicht bestätigt.');
    supplyJson(v, 16000000);
    const seen = new Set<string>();
    for (const r of v.sources.rows) {
        source(r, scope.tenantId, scope.clientId, ['asset', 'qm_version', 'case_document']);
        const k = r.kind + ':' + r.id;
        if (seen.has(k))
            fail('Originalquellen sind doppelt vorhanden.');
        seen.add(k);
    }
    const people = new Set<string>();
    for (const p of v.people.rows) {
        person(p, scope.tenantId);
        if (people.has(p.id))
            fail('Zuständige Personen sind doppelt vorhanden.');
        people.add(p.id);
    }
    decodeSupplyHistory(v.history, scope, now);
    return structuredClone(v) as SupplyContext;
}
export function assertSupplySelectionCurrent(c: SupplyCommand, context: SupplyContext) {
    validateSupplyCommand(c);
    if (c.tenantId !== context.tenantId || c.clientId !== context.clientId || c.actorId !== context.actorId || c.expectedHeadId !== context.history.headId)
        fail('Fall, Konto oder Bestandsfassung wurden geändert.');
    for (const value of Object.values(c.payload)) {
        if (supplyObject(value) && Object.hasOwn(value, 'snapshot') && !context.sources.rows.some(r => sameWoundJson(r, value)))
            fail('Ein Originalbeleg wurde geändert oder ist nicht mehr zugänglich. Erneut auswählen.');
        if (supplyObject(value) && Object.hasOwn(value, 'roleKey') && !context.people.rows.some(r => sameWoundJson(r, value)))
            fail('Die zuständige Person wurde geändert oder ist nicht mehr zugänglich.');
    }
    const state = decodeSupplyHistory(context.history, context).state;
    if (['consume', 'infection', 'device_release', 'device_use'].includes(c.kind)) {
        const plan = state.events.find(e => e.id === c.payload.planId && e.command.kind === 'hygiene_plan');
        if (!plan || !context.sources.rows.some(r => sameWoundJson(r, plan.command.payload.qm)))
            fail('Die QM-Fassung der ausgewählten Hygienezuordnung ist nicht mehr aktuell zugänglich. Hygienezuordnung erneut prüfen.');
        const responsible = plan.command.payload.responsible as SupplyPerson;
        if (!context.people.rows.some(p => p.id === responsible.id))
            fail('Die zuständige Person des Hygieneplans ist nicht mehr aktiv zugänglich.');
    }
    applySupplyCommand(state, c);
}
export function decodeSupplyReceipt(v: unknown, command: SupplyCommand): SupplyReceipt {
    if (!exact(v, ['version', 'requestId', 'command', 'event']) || v.version !== supplyVersion || v.requestId !== command.requestId || !sameWoundJson(v.command, command) || !exact(v.event, ['id', 'sequence', 'previousId', 'tenantId', 'clientId', 'actorId', 'actorName', 'recordedAt', 'command']))
        fail('Die native Quittung passt nicht zur gesicherten Anfrage.');
    const e = v.event;
    if (e.id !== command.eventId || e.previousId !== command.expectedHeadId || e.tenantId !== command.tenantId || e.clientId !== command.clientId || e.actorId !== command.actorId || !Number.isSafeInteger(e.sequence) || Number(e.sequence) < 1 || !string(e.actorName, 2000) || !time(e.recordedAt) || at(command.occurredAt) > at(e.recordedAt) || !sameWoundJson(e.command, command))
        fail('Die native Ereignisquittung ist widersprüchlich.');
    supplyJson(v);
    return structuredClone(v) as SupplyReceipt;
}
