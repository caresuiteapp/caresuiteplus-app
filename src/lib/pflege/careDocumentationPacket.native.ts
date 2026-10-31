// Generated native presentation from src/lib/pflege/careDocumentationPacket.web.ts. Update through scripts/port-native-workspaces.mjs.
import { cloneClientNativeOriginal, freezeClientNativeOriginal } from "../clients/clientRecordNativeOriginal.native.ts";
export type CareDocumentationKind = 'care_report' | 'planned_service' | 'refusal' | 'incident' | 'structured_protocol' | 'control' | 'external';
export type CareDocumentationAction = 'create' | 'correct' | 'confirm';
export type CareDocumentationHistoryItem = Readonly<{
    id: string;
    revision: number;
    previousId: string | null;
    occurredAt: string;
    recordedAt: string;
    recordedBy: string;
    recordedByName: string;
    payload: CareDocumentationEntry;
    correctionReason: string;
    contentFingerprint: string;
}>;
export type CareDocumentationOriginal = Readonly<{
    id: string;
    tenantId: string;
    clientId: string;
    rootId: string;
    headId: string;
    revision: number;
    kind: CareDocumentationKind;
    recordedAt: string;
    occurredAt: string;
    createdAt: string;
    recordedBy: string;
    recordedByName: string;
    payload: CareDocumentationEntry;
    signature: CareDocumentationConfirmation | null;
    contentFingerprint: string;
    history: readonly CareDocumentationHistoryItem[];
    voided: boolean;
}>;
export type CareDocumentationConfirmation = Readonly<{
    personId: string;
    personName: string;
    role: string;
    scope: string;
    basis: string;
    confirmedAt: string;
    contentFingerprint: string;
}>;
export type CareDocumentationEntry = Readonly<{
    kind: CareDocumentationKind;
    title: string;
    occurredAt: string;
    observation: string;
    intervention: string;
    result: string;
    plannedService: null | Readonly<{
        planVersionId: string;
        visitId: string;
        outcome: 'performed' | 'partial' | 'not_performed';
        reason: string;
        reaction: string;
    }>;
    refusal: null | Readonly<{
        measure: string;
        statedReason: string;
        consultation: string;
        followUp: string;
    }>;
    incident: null | Readonly<{
        incidentType: string;
        people: string;
        measures: string;
        forwardedTo: string;
        closureState: 'open' | 'closed';
        closureEvidence: string;
    }>;
    protocol: null | Readonly<{
        protocolType: string;
        fields: ReadonlyArray<{
            key: string;
            label: string;
            value: string;
            unit: string;
        }>;
        specialistVersion: string;
    }>;
    control: null | Readonly<{
        cause: string;
        frequency: string;
        responsible: string;
        dueAt: string;
        resultState: 'pending' | 'documented' | 'not_performed';
        result: string;
        nonPerformanceReason: string;
    }>;
    external: null | Readonly<{
        source: string;
        author: string;
        receivedAt: string;
        eventAt: string;
        review: string;
    }>;
}>;
export type CareDocumentationPacket = Readonly<{
    schemaVersion: '1';
    action: CareDocumentationAction;
    requestId: string;
    tenantId: string;
    clientId: string;
    actorId: string;
    expectedHeadId: string | null;
    expectedRevision: number;
    entry: CareDocumentationEntry | null;
    correctionReason: string;
    confirmation: CareDocumentationConfirmation | null;
    original: CareDocumentationOriginal | null;
}>;
/** Exact calendar/offset validation; milliseconds alone cannot order native PostgreSQL instants. */
export function careDocumentationInstantMicros(value: unknown): bigint | null {
    if (typeof value !== 'string')
        return null;
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):?(\d{2}))$/);
    if (!m)
        return null;
    const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]), hour = Number(m[4]), minute = Number(m[5]), second = Number(m[6]);
    if (year < 1 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59 || Number(m[10] ?? 0) > 23 || Number(m[11] ?? 0) > 59)
        return null;
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    date.setUTCHours(hour, minute, second, 0);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
        return null;
    const offset = m[8] === 'Z' ? 0 : (Number(m[10]) * 60 + Number(m[11])) * (m[9] === '+' ? 1 : -1);
    return BigInt(date.getTime() - offset * 60000) * 1000n + BigInt((m[7] ?? '').padEnd(6, '0'));
}
const instant = (value: unknown): value is string => careDocumentationInstantMicros(value) !== null;
const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const text = (value: unknown, min = 0, max = 4000): value is string => typeof value === 'string' && value.trim().length >= min && value.length <= max;
const clone = <T>(value: T): T => cloneClientNativeOriginal(value);
const exact = (value: unknown, keys: string): boolean => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === keys.split(',').sort().join(',');
const stable = (value: unknown): string => JSON.stringify(value, (_key, item: unknown) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, (item as Record<string, unknown>)[key]])) : item);
const unique = (values: readonly {
    key: string;
}[]) => new Set(values.map(value => value.key)).size === values.length;
const kinds = new Set<CareDocumentationKind>(['care_report', 'planned_service', 'refusal', 'incident', 'structured_protocol', 'control', 'external']);
export function blankCareDocumentationEntry(kind: CareDocumentationKind, occurredAt = new Date().toISOString()): CareDocumentationEntry {
    return { kind, title: '', occurredAt, observation: '', intervention: '', result: '',
        plannedService: kind === 'planned_service' ? { planVersionId: '', visitId: '', outcome: 'performed', reason: '', reaction: '' } : null,
        refusal: kind === 'refusal' ? { measure: '', statedReason: '', consultation: '', followUp: '' } : null,
        incident: kind === 'incident' ? { incidentType: '', people: '', measures: '', forwardedTo: '', closureState: 'open', closureEvidence: '' } : null,
        protocol: kind === 'structured_protocol' ? { protocolType: '', fields: [{ key: 'value', label: 'Mess- oder Beobachtungswert', value: '', unit: '' }], specialistVersion: '' } : null,
        control: kind === 'control' ? { cause: '', frequency: '', responsible: '', dueAt: '', resultState: 'pending', result: '', nonPerformanceReason: '' } : null,
        external: kind === 'external' ? { source: '', author: '', receivedAt: '', eventAt: '', review: '' } : null };
}
export function careDocumentationEntryIssue(value: unknown): string | null {
    try {
        return entryIssue(clone(value));
    }
    catch {
        return 'Das Dokumentationsoriginal enthält ungeklärte Felder oder ein nicht prüfbares Format.';
    }
}
function entryIssue(value: unknown): string | null {
    const entry = value as CareDocumentationEntry;
    if (!exact(entry, 'kind,title,occurredAt,observation,intervention,result,plannedService,refusal,incident,protocol,control,external') || !kinds.has(entry.kind) || !text(entry.title, 3, 300) || !instant(entry.occurredAt)
        || !text(entry.observation, 1, 8000) || !text(entry.intervention, 0, 8000) || !text(entry.result, 0, 8000))
        return 'Grundangaben, tatsächlicher Ereigniszeitpunkt und Beobachtung vollständig dokumentieren.';
    if (entry.kind === 'planned_service') {
        const detail = entry.plannedService;
        if (!detail || !exact(detail, 'planVersionId,visitId,outcome,reason,reaction') || !isUuid(detail.planVersionId) || !isUuid(detail.visitId) || !['performed', 'partial', 'not_performed'].includes(detail.outcome) || !text(detail.reason, 0, 2000) || !text(detail.reaction, 0, 2000))
            return 'Geplante Leistung benötigt Planfassung, Einsatz und tatsächliches Ergebnis.';
        if (detail.outcome !== 'performed' && (!text(detail.reason, 3, 2000) || !text(detail.reaction, 3, 2000)))
            return 'Teilweise oder nicht erbrachte Leistung benötigt Grund und konkrete Reaktion.';
    }
    else if (entry.plannedService !== null)
        return 'Leistungsbezug gehört nur zur geplanten Leistungsdokumentation.';
    if (entry.kind === 'refusal') {
        const detail = entry.refusal;
        if (!detail || !exact(detail, 'measure,statedReason,consultation,followUp') || !text(detail.measure, 3, 2000) || !text(detail.statedReason, 1, 2000) || !text(detail.consultation, 3, 4000) || !text(detail.followUp, 3, 4000))
            return 'Ablehnung benötigt Maßnahme, geäußerten Grund, Beratung und weiteres Vorgehen.';
        if (/\b(durchgef[uü]hrt|erbracht|erfolgreich)\b/i.test(entry.result))
            return 'Eine Ablehnung darf keinen positiven Durchführungsnachweis erzeugen.';
    }
    else if (entry.refusal !== null)
        return 'Ablehnungsangaben gehören nur zur ausdrücklichen Ablehnung.';
    if (entry.kind === 'incident') {
        const detail = entry.incident;
        if (!detail || !exact(detail, 'incidentType,people,measures,forwardedTo,closureState,closureEvidence') || !text(detail.incidentType, 3, 300) || !text(detail.people, 3, 2000) || !text(detail.measures, 3, 4000) || !text(detail.forwardedTo, 1, 2000) || !text(detail.closureEvidence, 0, 4000) || !['open', 'closed'].includes(detail.closureState) || detail.closureState === 'closed' && !text(detail.closureEvidence, 3, 4000))
            return 'Besonderes Ereignis benötigt Art, Beteiligte, Maßnahmen, Weitergabe und einen nachvollziehbaren Abschlussstand.';
    }
    else if (entry.incident !== null)
        return 'Ereignisangaben gehören nur zum besonderen Ereignis.';
    if (entry.kind === 'structured_protocol') {
        const detail = entry.protocol;
        if (!detail || !exact(detail, 'protocolType,fields,specialistVersion') || !text(detail.protocolType, 3, 200) || !text(detail.specialistVersion, 1, 200) || !Array.isArray(detail.fields) || !detail.fields.length || detail.fields.length > 100 || !unique(detail.fields) || detail.fields.some(field => !exact(field, 'key,label,value,unit') || !text(field.key, 1, 100) || !text(field.label, 1, 200) || !text(field.value, 1, 2000) || !text(field.unit, 0, 80)))
            return 'Strukturiertes Protokoll benötigt Typ, Fachfassung und eindeutige ausgefüllte Felder.';
    }
    else if (entry.protocol !== null)
        return 'Protokollfelder gehören nur zum strukturierten Protokoll.';
    if (entry.kind === 'control') {
        const detail = entry.control;
        if (!detail || !exact(detail, 'cause,frequency,responsible,dueAt,resultState,result,nonPerformanceReason') || !text(detail.cause, 3, 2000) || !text(detail.frequency, 1, 500) || !text(detail.responsible, 1, 500) || !instant(detail.dueAt) || !text(detail.result, 0, 4000) || !text(detail.nonPerformanceReason, 0, 4000) || !['pending', 'documented', 'not_performed'].includes(detail.resultState))
            return 'Kontrollauftrag benötigt Anlass, Frequenz, Zuständigkeit, Frist und Ergebnisstatus.';
        if (detail.resultState === 'documented' && !text(detail.result, 1, 4000) || detail.resultState === 'not_performed' && !text(detail.nonPerformanceReason, 3, 4000))
            return 'Kontrollauftrag benötigt Ergebnis oder dokumentierte Nichterfüllung.';
    }
    else if (entry.control !== null)
        return 'Kontrollangaben gehören nur zum Kontrollauftrag.';
    if (entry.kind === 'external') {
        const detail = entry.external;
        if (!detail || !exact(detail, 'source,author,receivedAt,eventAt,review') || !text(detail.source, 3, 1000) || !text(detail.author, 1, 500) || !instant(detail.receivedAt) || !instant(detail.eventAt) || !text(detail.review, 3, 4000))
            return 'Fremddokumentation benötigt Quelle, Autor, Eingangs- und Ereigniszeit sowie eigene Prüfung.';
        if (/\bselbst durchgef[uü]hrt\b/i.test(entry.result))
            return 'Ein externer Befund darf nicht als eigene Durchführung gekennzeichnet werden.';
    }
    else if (entry.external !== null)
        return 'Fremdbezug gehört nur zur externen Dokumentation.';
    return null;
}
export function careDocumentationOriginalIssue(value: unknown, context: {
    tenantId: string;
    clientId: string;
}): string | null {
    try {
        const tenant = Object.getOwnPropertyDescriptor(context, 'tenantId'), client = Object.getOwnPropertyDescriptor(context, 'clientId');
        if (!tenant || !client || !('value' in tenant) || !('value' in client) || !tenant.enumerable || !client.enumerable)
            return 'Vollständiges unverändertes Dokumentationsoriginal fehlt.';
        return originalIssue(clone(value), { tenantId: tenant.value, clientId: client.value });
    }
    catch {
        return 'Vollständiges unverändertes Dokumentationsoriginal fehlt.';
    }
}
function originalIssue(value: unknown, context: {
    tenantId: string;
    clientId: string;
}): string | null {
    const original = value as CareDocumentationOriginal;
    if (!exact(original, 'id,tenantId,clientId,rootId,headId,revision,kind,recordedAt,occurredAt,createdAt,recordedBy,recordedByName,payload,signature,contentFingerprint,history,voided') || ![original.id, original.rootId, original.headId, original.recordedBy, original.tenantId, original.clientId].every(isUuid) || original.tenantId !== context.tenantId || original.clientId !== context.clientId || !Number.isSafeInteger(original.revision) || original.revision < 1 || original.revision >= 2000 || !kinds.has(original.kind) || !instant(original.recordedAt) || !instant(original.occurredAt) || !instant(original.createdAt) || !text(original.recordedByName, 1, 500) || !/^sha256:[0-9a-f]{64}$/.test(original.contentFingerprint) || !Array.isArray(original.history) || original.history.length !== original.revision || typeof original.voided !== 'boolean' || careDocumentationEntryIssue(original.payload))
        return 'Vollständiges unverändertes Dokumentationsoriginal fehlt.';
    const seen = new Set<string>();
    let precedingRecorded: bigint | null = null;
    for (let index = 0; index < original.history.length; index++) {
        const item = original.history[index];
        if (!exact(item, 'id,revision,previousId,occurredAt,recordedAt,recordedBy,recordedByName,payload,correctionReason,contentFingerprint') || !isUuid(item.id) || seen.has(item.id.toLowerCase()) || item.revision !== index + 1 || (index === 0 ? item.previousId !== null : item.previousId !== original.history[index - 1].id) || !instant(item.occurredAt) || !instant(item.recordedAt) || !isUuid(item.recordedBy) || !text(item.recordedByName, 1, 500) || !text(item.correctionReason, index ? 10 : 0, 2000) || !/^sha256:[0-9a-f]{64}$/.test(item.contentFingerprint) || careDocumentationEntryIssue(item.payload) || item.payload.kind !== original.kind || item.payload.occurredAt !== item.occurredAt || index === 0 && item.correctionReason !== '')
            return 'Original- und Nachtragshistorie ist abgeschnitten, doppelt oder widersprüchlich.';
        const recorded = careDocumentationInstantMicros(item.recordedAt)!, occurred = careDocumentationInstantMicros(item.occurredAt)!;
        if (recorded < occurred || precedingRecorded !== null && recorded < precedingRecorded)
            return 'Ereignis- und Erfassungszeitpunkte der Originalhistorie widersprechen sich.';
        precedingRecorded = recorded;
        seen.add(item.id.toLowerCase());
    }
    if (original.history[0].id !== original.rootId || original.history.at(-1)?.id !== original.headId || original.id !== original.headId || original.history.at(-1)?.contentFingerprint !== original.contentFingerprint)
        return 'Aktueller Kopf stimmt nicht mit der vollständigen Fassungshistorie überein.';
    const latest = original.history.at(-1)!;
    if (original.payload.kind !== original.kind || original.payload.occurredAt !== original.occurredAt || stable(original.payload) !== stable(latest.payload) || original.recordedBy !== latest.recordedBy || original.recordedByName !== latest.recordedByName || original.recordedAt !== latest.recordedAt || careDocumentationInstantMicros(original.createdAt) !== careDocumentationInstantMicros(original.recordedAt))
        return 'Dokumentationskopf und Originalinhalt widersprechen sich.';
    return original.signature !== null && careDocumentationConfirmationIssue(original.signature, original) ? 'Bestätigungsoriginal ist nicht vollständig gebunden.' : null;
}
export function careDocumentationConfirmationIssue(value: unknown, original?: CareDocumentationOriginal): string | null {
    try {
        return confirmationIssue(clone(value), original === undefined ? undefined : clone(original));
    }
    catch {
        return 'Bestätigungsoriginal ist nicht vollständig gebunden.';
    }
}
function confirmationIssue(value: unknown, original?: CareDocumentationOriginal): string | null {
    const confirmation = value as CareDocumentationConfirmation;
    if (!exact(confirmation, 'personId,personName,role,scope,basis,confirmedAt,contentFingerprint') || !isUuid(confirmation.personId) || !text(confirmation.personName, 2, 300) || !text(confirmation.role, 2, 300) || !text(confirmation.scope, 3, 2000) || !text(confirmation.basis, 3, 2000) || !instant(confirmation.confirmedAt) || !/^sha256:[0-9a-f]{64}$/.test(confirmation.contentFingerprint))
        return 'Bestätigung benötigt Person, Rolle, Umfang, Grundlage, Zeitpunkt und Inhaltsbindung.';
    if (original && confirmation.contentFingerprint !== original.contentFingerprint)
        return 'Bestätigung gehört nicht zur unveränderten Inhaltsfassung.';
    return null;
}
export function makeCareDocumentationPacket(input: Omit<CareDocumentationPacket, 'schemaVersion'>): CareDocumentationPacket {
    const packet = { schemaVersion: '1' as const, ...clone(input) };
    const issue = careDocumentationPacketIssue(packet);
    if (issue)
        throw Error(issue);
    return freezeClientNativeOriginal(packet);
}
export function careDocumentationPacketIssue(value: unknown): string | null {
    try {
        return packetIssue(clone(value));
    }
    catch {
        return 'Dokumentationsanfrage enthält ungeklärte Felder oder ein nicht prüfbares Format.';
    }
}
function packetIssue(value: unknown): string | null {
    const packet = value as CareDocumentationPacket;
    if (!exact(packet, 'schemaVersion,action,requestId,tenantId,clientId,actorId,expectedHeadId,expectedRevision,entry,correctionReason,confirmation,original') || packet.schemaVersion !== '1' || !['create', 'correct', 'confirm'].includes(packet.action) || ![packet.requestId, packet.tenantId, packet.clientId, packet.actorId].every(isUuid) || !Number.isSafeInteger(packet.expectedRevision) || packet.expectedRevision < 0 || packet.expectedRevision >= 2000)
        return 'Dokumentationsanfrage ist nicht vollständig gebunden.';
    if (packet.action === 'create')
        return packet.expectedHeadId !== null || packet.expectedRevision !== 0 || packet.original !== null || packet.confirmation !== null || packet.correctionReason !== '' || !packet.entry ? 'Neue Dokumentation darf kein erfundenes Original oder eine Bestätigung enthalten.' : careDocumentationEntryIssue(packet.entry);
    if (!packet.original || careDocumentationOriginalIssue(packet.original, { tenantId: packet.tenantId, clientId: packet.clientId }) || packet.expectedHeadId !== packet.original.headId || packet.expectedRevision !== packet.original.revision)
        return 'Korrektur oder Bestätigung benötigt den vollständig gelesenen aktuellen Originalkopf.';
    if (packet.action === 'correct') {
        if (!packet.entry || careDocumentationEntryIssue(packet.entry) || packet.entry.kind !== packet.original.kind || !text(packet.correctionReason, 10, 2000) || packet.confirmation !== null)
            return 'Korrektur benötigt gleichartige neue Fassung, konkreten Grund und vollständiges Original.';
        if (stable(packet.entry) === stable(packet.original.payload))
            return 'Korrektur muss sich vom unveränderten Original unterscheiden.';
    }
    else if (packet.entry !== null || packet.correctionReason || careDocumentationConfirmationIssue(packet.confirmation, packet.original))
        return 'Bestätigung darf Inhalt nicht ändern und muss exakt an die aktuelle Fassung gebunden sein.';
    return null;
}
