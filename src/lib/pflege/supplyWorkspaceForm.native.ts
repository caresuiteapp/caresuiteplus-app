// Generated native presentation from src/lib/pflege/supplyWorkspaceForm.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { supplyKinds, supplyLabels, supplyVersion, type SupplyCommand, type SupplyContext, type SupplyKind, type SupplyRow, type SupplyState } from "./supplyWorkspaceDomain.native.ts";
import type { SupplyDraft } from "./supplyWorkspaceDraft.native.ts";
import { sameWoundJson } from './woundCareDomain.ts';
export type SupplyField = {
    key: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'time' | 'choice' | 'reference';
    options?: {
        key: string;
        label: string;
    }[];
    pool?: 'article' | 'order' | 'lot' | 'plan' | 'count' | 'movement' | 'qm' | 'document' | 'device' | 'key' | 'person';
};
export type SupplyOption = {
    id: string;
    label: string;
    value: unknown;
};
const text = (key: string, label: string): SupplyField => ({ key, label, type: 'text' });
const number = (key: string, label: string): SupplyField => ({ key, label, type: 'number' });
const ref = (key: string, label: string, pool: SupplyField['pool']): SupplyField => ({ key, label, type: 'reference', pool });
const date = (key: string, label: string): SupplyField => ({ key, label, type: 'date' });
const time = (key: string, label: string): SupplyField => ({ key, label, type: 'time' });
const choice = (key: string, label: string, pairs: [
    string,
    string
][]): SupplyField => ({ key, label, type: 'choice', options: pairs.map(([key, label]) => ({ key, label })) });
const doc = () => ref('document', 'Beleg aus der Pflegeakte', 'document');
const asset = () => ref('asset', 'Gerät aus dem Inventar', 'device');
const plan = () => [ref('planId', 'Hygienezuordnung für diese Tätigkeit', 'plan'), text('activity', 'Tatsächliche Tätigkeit'), text('site', 'Tatsächlicher Einsatzort')];
export function supplyFields(kind: SupplyKind): SupplyField[] {
    switch (kind) {
        case 'article': return [text('name', 'Artikelbezeichnung'), text('unit', 'Kleinste Mengeneinheit, zum Beispiel Stück oder Milliliter'), number('minimum', 'Mindestbestand in dieser Einheit'), text('supplier', 'Lieferant')];
        case 'hygiene_plan': return [ref('qm', 'Aktuelle freigegebene QM-Fassung', 'qm'), text('activity', 'Tätigkeit'), text('site', 'Einsatzort'), text('protection', 'Festgelegte Schutzmaßnahmen'), date('validFrom', 'Gültig ab'), date('validUntil', 'Gültig bis'), ref('responsible', 'Zuständige aktive Person', 'person')];
        case 'infection': return [choice('status', 'Tatsächlich dokumentierter Befundstatus', [['suspected', 'Verdacht'], ['confirmed', 'Bestätigter Befund'], ['ruled_out', 'Ausgeschlossen laut Befund']]), text('organism', 'Erreger / MRE-Typ laut Originalbefund'), doc(), ref('planId', 'Zugeordnete Schutzmaßnahmen', 'plan'), time('observedAt', 'Ursprünglicher Befundzeitpunkt'), text('limitations', 'Offene Angaben und Grenzen des Befunds')];
        case 'order': return [ref('articleId', 'Artikel', 'article'), number('quantity', 'Bestellte Menge'), text('supplier', 'Tatsächlicher Lieferant'), text('reference', 'Bestellreferenz')];
        case 'receipt': return [ref('orderId', 'Bestellung mit offener Menge', 'order'), number('quantity', 'Tatsächlich eingegangene Menge'), text('batch', 'Charge / Loskennung'), date('expiry', 'Verfallsdatum der Charge'), text('location', 'Tatsächlicher Lagerort beim Pflegefall'), doc()];
        case 'consume': return [ref('lotId', 'Charge für diesen Pflegefall', 'lot'), number('quantity', 'Tatsächlich verbrauchte Menge'), ...plan(), ref('execution', 'Eigenständiger Tätigkeitsbeleg aus der Akte', 'document')];
        case 'hold':
        case 'release_lot': return [ref('lotId', 'Charge', 'lot'), text('reason', kind === 'hold' ? 'Tatsächlicher Sperr- oder Rückrufgrund' : 'Grund und Nachweis der ausdrücklichen Freigabe'), doc()];
        case 'dispose': return [ref('lotId', 'Charge', 'lot'), number('quantity', 'Tatsächlich entsorgte Menge'), text('method', 'Entsorgungsverfahren'), doc()];
        case 'count': return [ref('lotId', 'Zu zählende Charge', 'lot'), number('counted', 'Tatsächlich gezählte Menge')];
        case 'approve_count': return [ref('countId', 'Noch nicht gebuchter Zählbeleg einer anderen Person', 'count'), text('reason', 'Prüfung der Abweichung und Freigabegrund')];
        case 'reverse_stock': return [ref('targetId', 'Ursprüngliche Mengenbuchung', 'movement'), text('reason', 'Tatsächlicher Berichtigungsgrund')];
        case 'device_check': return [asset(), choice('type', 'Art der tatsächlich erfolgten Prüfung', [['maintenance', 'Wartung'], ['inspection', 'Prüfung'], ['calibration', 'Kalibrierung']]), choice('result', 'Tatsächliches Prüfergebnis', [['passed', 'Bestanden laut Beleg'], ['failed', 'Nicht bestanden']]), time('dueAt', 'Nächste Prüffälligkeit laut Beleg'), doc()];
        case 'device_training': return [asset(), text('instructor', 'Einweisende Person / Stelle laut Beleg'), doc()];
        case 'device_release':
        case 'device_use': return [asset(), ...plan()];
        case 'cleaning': return [asset(), text('method', 'Tatsächliches Reinigungs- oder Desinfektionsverfahren'), text('agent', 'Tatsächlich verwendetes Mittel'), choice('result', 'Ergebnis', [['passed', 'Anforderungen laut Beleg erfüllt'], ['failed', 'Anforderungen nicht erfüllt']]), text('deviation', 'Tatsächliche Abweichungen, sonst ausdrücklich keine'), doc()];
        case 'housekeeping': return [choice('category', 'Leistungsbereich', [['cleaning', 'Haushaltsreinigung'], ['laundry', 'Wäsche'], ['shopping', 'Einkauf'], ['meals', 'Mahlzeiten'], ['everyday_support', 'Alltagshilfe']]), text('activity', 'Eigenständige hauswirtschaftliche Tätigkeit'), text('site', 'Tatsächlicher Einsatzort'), time('startedAt', 'Tatsächlicher Beginn'), time('endedAt', 'Tatsächliches Ende'), choice('outcome', 'Tatsächliches Ergebnis', [['done', 'Durchgeführt'], ['not_done', 'Nicht durchgeführt']]), text('deviation', 'Abweichung oder Grund, sonst ausdrücklich keine'), doc()];
        case 'key': return [ref('asset', 'Schlüssel / Zugang aus dem Inventar', 'key'), choice('action', 'Tatsächlicher Vorgang', [['offer', 'Übergabe anbieten'], ['acknowledge', 'Eigene Übernahme bestätigen'], ['return', 'Eigene Rückgabe dokumentieren'], ['lost', 'Eigenen Verlust melden'], ['block', 'Tatsächliche Zugangssperre dokumentieren'], ['resolve', 'Tatsächlich abgeschlossene Verlustbearbeitung']]), ref('responsible', 'Verwahrende / vorgesehene empfangende Person', 'person'), text('reference', 'Nicht geheime Vorgangsreferenz zum Nachweis, ohne PIN oder Zugangscode'), doc()];
    }
}
export function supplyOptions(field: SupplyField, state: SupplyState, context: SupplyContext): SupplyOption[] {
    const name = (id: unknown) => state.articles.find(a => a.id === id)?.name ?? 'Artikel nicht gefunden';
    switch (field.pool) {
        case 'article': return state.articles.map(a => ({ id: a.id, label: `${a.name} · ${a.unit} · Mindestbestand ${a.minimum}`, value: a }));
        case 'order': return state.orders.filter(o => o.received < o.quantity).map(o => ({ id: o.id, label: `${o.reference} · ${name(o.articleId)} · ${o.quantity - o.received} offen`, value: o }));
        case 'lot': return state.lots.map(l => ({ id: l.id, label: `${name(l.articleId)} · Charge ${l.batch} · ${l.quantity} · ${l.held ? 'gesperrt' : 'nicht gesperrt'} · verfällt ${l.expiry} · ${l.location}`, value: l }));
        case 'plan': return state.events.filter(e => e.command.kind === 'hygiene_plan').map(e => ({ id: e.id, label: `${e.command.payload.activity} · ${e.command.payload.site} · ${e.command.payload.validFrom} bis ${e.command.payload.validUntil}`, value: e }));
        case 'count': return state.events.filter(e => e.command.kind === 'count' && e.actorId !== context.actorId && !state.events.some(a => a.command.kind === 'approve_count' && a.command.payload.countId === e.id)).map(e => ({ id: e.id, label: `${e.actorName} · gezählt ${e.command.payload.counted}, Soll ${e.command.payload.expected} · ${e.command.occurredAt}`, value: e }));
        case 'movement': return state.events.filter(e => ['receipt', 'consume', 'dispose'].includes(e.command.kind) && !state.reversed.includes(e.id)).map(e => ({ id: e.id, label: `${supplyLabels[e.command.kind]} · ${e.command.payload.quantity} · ${e.command.note} · ${e.command.occurredAt}`, value: e }));
        case 'person': return context.people.rows.map(p => ({ id: p.id, label: `${p.name} · ${p.roleKey}`, value: p }));
        default: return context.sources.rows.filter(r => field.pool === 'qm' ? r.kind === 'qm_version' : field.pool === 'document' ? r.kind === 'case_document' : r.kind === 'asset' && r.snapshot.group_key === (field.pool === 'key' ? 'keys_access' : 'devices')).map(r => ({ id: r.id, label: r.kind === 'qm_version' ? `${(r.snapshot.document as SupplyRow).title} · Fassung ${(r.snapshot.version as SupplyRow).version_number}` : String(r.snapshot.name ?? r.snapshot.title ?? 'Unbenanntes Original'), value: r }));
    }
}
export function supplyDraftSelectionCurrent(field: string, value: unknown, state: SupplyState, context: SupplyContext, kind: SupplyKind) { const f = supplyFields(kind).find(f => f.key === field); return !!f && supplyOptions(f, state, context).some(r => sameWoundJson(r.value, value)); }
export function buildSupplyCommand(draft: SupplyDraft, state: SupplyState, context: SupplyContext, requestId: string, eventId: string): SupplyCommand {
    if (!supplyKinds.includes(draft.kind))
        throw Error('Einen vorhandenen Vorgang auswählen.');
    const payload: SupplyRow = {};
    for (const field of supplyFields(draft.kind)) {
        if (field.type === 'reference') {
            const selected = draft.selected[field.key];
            if (!selected || !supplyOptions(field, state, context).some(r => r.id === selected.id && sameWoundJson(r.value, selected.value)))
                throw Error('Die aktuelle Auswahl für „' + field.label + '“ fehlt oder wurde geändert.');
            payload[field.key] = ['article', 'order', 'lot', 'plan', 'count', 'movement'].includes(field.pool ?? '') ? selected.id : structuredClone(selected.value);
        }
        else if (field.type === 'number') {
            const raw = draft.values[field.key] ?? '';
            if (!/^\d+$/.test(raw))
                throw Error('„' + field.label + '“ benötigt eine ganze Menge.');
            payload[field.key] = Number(raw);
        }
        else
            payload[field.key] = draft.values[field.key] ?? '';
    }
    if (draft.kind === 'count') {
        const lot = draft.selected.lotId?.value as SupplyRow | undefined;
        payload.expected = lot?.quantity;
        payload.lotHeadId = lot?.headId;
    }
    return { ...draft.scope, version: supplyVersion, requestId, eventId, expectedHeadId: context.history.headId, kind: draft.kind, occurredAt: draft.occurredAt, note: draft.note, payload };
}
/** New user-entered local times require an explicit choice during a repeated clock hour. */
export function supplyLocalTime(value: string) { if (!/(Z|[+-]\d{2}:\d{2})$/.test(value))
    return value; const d = new Date(value); if (!Number.isFinite(d.getTime()))
    return value; const pad = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
export function supplyTimeCandidates(value: string): {
    key: string;
    label: string;
}[] {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value))
        return [];
    const normalized = value.length === 16 ? value + ':00' : value, base = new Date(value);
    if (!Number.isFinite(base.getTime()))
        return [];
    const result: {
        key: string;
        label: string;
    }[] = [];
    for (let minutes = -120; minutes <= 120; minutes += 15) {
        const d = new Date(base.getTime() + minutes * 60000), iso = d.toISOString();
        if (supplyLocalTime(iso) !== normalized)
            continue;
        const offset = -d.getTimezoneOffset(), pad = (n: number) => String(n).padStart(2, '0');
        result.push({ key: iso, label: `UTC${offset < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}` });
    }
    return result;
}
export function supplyTimeFromInput(value: string) { const candidates = supplyTimeCandidates(value); return candidates.length === 1 ? candidates[0].key : value; }
