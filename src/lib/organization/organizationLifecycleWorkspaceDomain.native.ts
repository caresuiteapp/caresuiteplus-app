// Generated native presentation from src/lib/organization/organizationLifecycleWorkspaceDomain.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
export const organizationLifecycleVersion = '2026-10-16.1' as const;
export const organizationLifecycleKinds = ['tenant_profile_draft', 'tenant_profile_review', 'location_revision', 'location_switch_review', 'role_policy_revision', 'access_decision', 'clinical_configuration_draft', 'configuration_activation_decision', 'catalog_version_draft', 'catalog_publication_decision', 'context_transition', 'work_overview_snapshot', 'work_item_navigation_review', 'correction'] as const;
export type OrganizationLifecycleKind = (typeof organizationLifecycleKinds)[number];
export type OrganizationLifecycleSource = {
    kind: string;
    id: string;
    snapshot: Record<string, unknown>;
};
type Field = {
    key: string;
    label: string;
    type?: 'text' | 'date' | 'instant' | 'uuid' | 'sha256' | 'enum';
    values?: readonly string[];
};
type Source = {
    key: string;
    label: string;
    kinds: readonly string[];
};
export type OrganizationLifecycleDefinition = {
    group: string;
    label: string;
    right: string;
    extraRights?: readonly string[];
    sources: readonly Source[];
    fields: readonly Field[];
};
const f = (key: string, label: string, type: Field['type'] = 'text', values?: readonly string[]): Field => ({ key, label, type, ...(values ? { values } : {}) });
const s = (key: string, label: string, ...kinds: string[]): Source => ({ key, label, kinds });
const manage = 'business.tenant.manage';
export const organizationLifecycleDefinitions: Record<OrganizationLifecycleKind, OrganizationLifecycleDefinition> = {
    tenant_profile_draft: { group: 'Mandant', label: 'Mandantenstammdaten als Entwurf binden', right: manage, sources: [s('tenant', 'Mandantenoriginal', 'tenant'), s('billing', 'Abrechnungs-/IK-Original', 'tenant_billing_settings'), s('branding', 'Darstellungsoriginal', 'tenant_branding')], fields: [f('profileSha256', 'Stammdatenfingerabdruck', 'sha256'), f('changeReason', 'Änderungsgrund'), f('state', 'Entwurfsstand', 'enum', ['draft', 'incomplete', 'withdrawn'])] },
    tenant_profile_review: { group: 'Mandant', label: 'Mandantenstammdaten getrennt prüfen', right: manage, sources: [s('tenant', 'Mandantenoriginal', 'tenant'), s('draft', 'Stammdatenentwurf', 'organization_event')], fields: [f('decision', 'Prüfentscheidung', 'enum', ['pending', 'accepted_candidate', 'rejected']), f('reviewSha256', 'Prüfbeleg', 'sha256'), f('openFields', 'Offene Pflichtangaben')] },
    location_revision: { group: 'Standorte', label: 'Standort und Zuständigkeit erfassen', right: manage, sources: [s('tenant', 'Mandantenoriginal', 'tenant'), s('manager', 'Verantwortliches Profil', 'profile')], fields: [f('locationId', 'Standortkennung', 'uuid'), f('locationName', 'Standortbezeichnung'), f('scopeSha256', 'Zuständigkeits-/Dienstzeitstand', 'sha256'), f('state', 'Standortstand', 'enum', ['draft', 'active_candidate', 'inactive_candidate'])] },
    location_switch_review: { group: 'Standorte', label: 'Standortwechsel und Isolation prüfen', right: manage, sources: [s('fromLocation', 'Ausgangsstandortfassung', 'organization_event'), s('toLocation', 'Zielstandortfassung', 'organization_event'), s('assignment', 'Zuordnungsoriginal', 'tenant_user', 'profile')], fields: [f('policyVersion', 'Isolationsrichtlinie'), f('beforeSha256', 'Ausgangsbestand', 'sha256'), f('afterSha256', 'Zielbestand', 'sha256'), f('decision', 'Prüfergebnis', 'enum', ['isolated', 'blocked', 'incomplete'])] },
    role_policy_revision: { group: 'Rollen & Anmeldung', label: 'Rolle und Einzelrechte fortschreiben', right: manage, sources: [s('role', 'Rollenoriginal', 'role'), s('permission', 'Rechteoriginal', 'role_permission'), s('assignment', 'Benutzerzuordnung', 'tenant_user', 'profile')], fields: [f('policySha256', 'Rechtemenge', 'sha256'), f('scope', 'Standort-/Vertretungsumfang'), f('state', 'Regelstand', 'enum', ['draft', 'active_candidate', 'withdrawn'])] },
    access_decision: { group: 'Rollen & Anmeldung', label: 'Anmeldung oder Sperre getrennt belegen', right: manage, sources: [s('account', 'Kontooriginal', 'tenant_user'), s('profile', 'Profiloriginal', 'profile'), s('audit', 'Zugriffsoriginal', 'access_audit', 'organization_event')], fields: [f('decision', 'Zugriffsentscheidung', 'enum', ['allowed', 'blocked', 'expired', 'revoked']), f('reasonCode', 'Entscheidungsgrund'), f('decisionSha256', 'Entscheidungsbeleg', 'sha256')] },
    clinical_configuration_draft: { group: 'Fachkonfiguration', label: 'Fachkonfiguration als Fassung binden', right: manage, sources: [s('tenant', 'Mandantenoriginal', 'tenant'), s('catalog', 'Leistungskatalog', 'tenant_service_catalog', 'service_catalog'), s('module', 'Modulkonfiguration', 'tenant_module_settings')], fields: [f('configurationVersion', 'Konfigurationsfassung'), f('configurationSha256', 'Konfigurationsfingerabdruck', 'sha256'), f('validationSha256', 'Validierungsbericht', 'sha256'), f('state', 'Validierungsstand', 'enum', ['valid_candidate', 'invalid', 'incomplete'])] },
    configuration_activation_decision: { group: 'Fachkonfiguration', label: 'Aktivierung getrennt entscheiden', right: manage, sources: [s('configuration', 'Konfigurationsoriginal', 'organization_event'), s('audit', 'Prüforiginal', 'organization_event', 'access_audit')], fields: [f('decision', 'Aktivierungsentscheidung', 'enum', ['pending', 'approved_candidate', 'rejected']), f('decisionSha256', 'Entscheidungsbeleg', 'sha256'), f('limitations', 'Grenzen')] },
    catalog_version_draft: { group: 'Katalog', label: 'Katalogfassung und Gültigkeit erfassen', right: manage, sources: [s('catalog', 'Katalogoriginal', 'tenant_service_catalog', 'service_catalog'), s('service', 'Leistungspositionsoriginal', 'tenant_service_catalog', 'service_catalog_item')], fields: [f('versionLabel', 'Fassungsbezeichnung'), f('validFrom', 'Gültig ab', 'instant'), f('validUntil', 'Gültig bis', 'instant'), f('changeReason', 'Änderungsgrund'), f('catalogSha256', 'Fassungsfingerabdruck', 'sha256')] },
    catalog_publication_decision: { group: 'Katalog', label: 'Katalogveröffentlichung getrennt prüfen', right: manage, sources: [s('catalog', 'Katalogoriginal', 'tenant_service_catalog', 'service_catalog'), s('version', 'Fassungsoriginal', 'organization_event')], fields: [f('decision', 'Veröffentlichungsentscheidung', 'enum', ['pending', 'approved_candidate', 'rejected']), f('historySha256', 'Historische Bindung', 'sha256'), f('decisionSha256', 'Entscheidungsbeleg', 'sha256')] },
    context_transition: { group: 'Kontextwechsel', label: 'Organisationskontext sicher wechseln', right: manage, sources: [s('fromContext', 'Ausgangskontext', 'tenant_user', 'profile', 'organization_event'), s('toContext', 'Zielkontext', 'tenant_user', 'profile', 'organization_event'), s('draft', 'Offener Entwurf', 'organization_event')], fields: [f('generation', 'Kontextgeneration'), f('visibleBeforeSha256', 'Vorherige Anzeige', 'sha256'), f('visibleAfterSha256', 'Neue Anzeige', 'sha256'), f('draftDisposition', 'Entwurfsbehandlung', 'enum', ['isolated', 'restored_same_context', 'discarded_unsent'])] },
    work_overview_snapshot: { group: 'Arbeitsübersicht', label: 'Vollständige offene Arbeitsübersicht binden', right: manage, sources: [s('task', 'Aufgabenoriginal', 'client_task', 'qm_change_task'), s('audit', 'Rückmeldungs-/Prüforiginal', 'organization_event', 'access_audit')], fields: [f('snapshotSha256', 'Übersichtsfingerabdruck', 'sha256'), f('coverageSha256', 'Vollständigkeitsbeleg', 'sha256'), f('state', 'Übersichtsstand', 'enum', ['current', 'incomplete', 'stale'])] },
    work_item_navigation_review: { group: 'Arbeitsübersicht', label: 'Navigation zum offenen Original prüfen', right: manage, sources: [s('task', 'Aufgabenoriginal', 'client_task', 'qm_change_task'), s('snapshot', 'Übersichtsoriginal', 'organization_event')], fields: [f('route', 'Zielroute'), f('taskRevision', 'Aufgabenrevision'), f('decision', 'Prüfergebnis', 'enum', ['open_and_accessible', 'blocked', 'stale'])] },
    correction: { group: 'Berichtigung', label: 'Unveränderlichen Organisationsvorgang berichtigen', right: manage, sources: [], fields: [f('targetId', 'Zu berichtigender Vorgang', 'uuid'), f('reason', 'Berichtigungsgrund'), f('evidenceSha256', 'Berichtigungsbeleg', 'sha256')] },
};
export const organizationLifecycleReadRights = [manage] as const;
export const organizationLifecycleWorkspaceDefinitions = organizationLifecycleDefinitions;
export const organizationLifecycleWorkspaceReadRights = organizationLifecycleReadRights;
export type OrganizationLifecycleWorkspaceKind = OrganizationLifecycleKind;
export type OrganizationLifecycleCommand = {
    version: typeof organizationLifecycleVersion;
    requestId: string;
    eventId: string;
    tenantId: string;
    actorId: string;
    expectedHeadId: string | null;
    kind: OrganizationLifecycleKind;
    occurredAt: string;
    note: string;
    payload: Record<string, unknown>;
};
export type OrganizationLifecycleEvent = {
    id: string;
    sequence: number;
    previousId: string | null;
    tenantId: string;
    actorId: string;
    actorName: string;
    recordedAt: string;
    command: OrganizationLifecycleCommand;
};
export type OrganizationLifecycleHistory = {
    version: typeof organizationLifecycleVersion;
    tenantId: string;
    count: number;
    headId: string | null;
    events: OrganizationLifecycleEvent[];
};
export type OrganizationLifecycleContext = {
    version: typeof organizationLifecycleVersion;
    tenantId: string;
    actorId: string;
    loadedAt: string;
    sources: {
        count: number;
        rows: OrganizationLifecycleSource[];
    };
    history: OrganizationLifecycleHistory;
};
export type OrganizationLifecycleReceipt = {
    version: typeof organizationLifecycleVersion;
    requestId: string;
    command: OrganizationLifecycleCommand;
    event: OrganizationLifecycleEvent;
};
export type OrganizationLifecycleState = {
    headId: string | null;
    events: OrganizationLifecycleEvent[];
    corrected: string[];
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const instant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const sha = /^[0-9a-f]{64}$/;
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, label: string) => { if (typeof v !== 'string' || !v.trim())
    throw Error(`${label} fehlt.`); return v; };
const id = (v: unknown, label: string) => { const x = text(v, label); if (!uuid.test(x) || x !== x.toLowerCase())
    throw Error(`${label} ist ungültig.`); return x; };
const time = (v: unknown, label: string) => { const x = text(v, label); if (!instant.test(x) || Number.isNaN(Date.parse(x)))
    throw Error(`${label} ist ungültig.`); return x; };
export function organizationLifecycleSource(v: unknown, label = 'Originalquelle'): asserts v is OrganizationLifecycleSource { if (!object(v) || Object.keys(v).sort().join(',') !== 'id,kind,snapshot')
    throw Error(`${label} ist unvollständig.`); id(v.id, `${label}-ID`); text(v.kind, `${label}-Art`); if (!object(v.snapshot) || v.snapshot.id !== v.id)
    throw Error(`${label} stimmt nicht mit dem nativen Original überein.`); }
function validateField(value: unknown, rule: Field) { const x = text(value, rule.label); if (rule.type === 'uuid')
    id(x, rule.label); if (rule.type === 'instant')
    time(x, rule.label); if (rule.type === 'sha256' && !sha.test(x))
    throw Error(`${rule.label} ist ungültig.`); if (rule.type === 'enum' && !rule.values?.includes(x))
    throw Error(`${rule.label} hat einen unbekannten Wert.`); }
export function validateOrganizationLifecycleCommand(c: OrganizationLifecycleCommand) { if (!object(c) || c.version !== organizationLifecycleVersion)
    throw Error('Organisationsvorgang oder Version ist ungültig.'); id(c.requestId, 'Anfrage-ID'); id(c.eventId, 'Ereignis-ID'); id(c.tenantId, 'Mandant'); id(c.actorId, 'Akteur'); if (c.expectedHeadId !== null)
    id(c.expectedHeadId, 'Erwarteter Verlaufskopf'); if (!organizationLifecycleKinds.includes(c.kind))
    throw Error('Organisationsvorgang ist unbekannt.'); time(c.occurredAt, 'Tatsächlicher Vorgangszeitpunkt'); if (text(c.note, 'Nachvollziehbarer Anlass').length > 4000)
    throw Error('Anlass ist zu lang.'); if (!object(c.payload))
    throw Error('Vorgangsangaben fehlen.'); const d = organizationLifecycleDefinitions[c.kind], keys = [...d.sources.map(x => x.key), ...d.fields.map(x => x.key)].sort(); if (Object.keys(c.payload).sort().join(',') !== keys.join(','))
    throw Error('Vorgangsfelder sind unvollständig oder enthalten Fremdfelder.'); const selected: OrganizationLifecycleSource[] = []; for (const rule of d.sources) {
    const value = c.payload[rule.key];
    organizationLifecycleSource(value, rule.label);
    if (!rule.kinds.includes(value.kind))
        throw Error(`${rule.label} hat die falsche Originalart.`);
    selected.push(value);
} for (const source of selected)
    if (source.snapshot.tenant_id !== undefined && source.snapshot.tenant_id !== c.tenantId)
        throw Error('Ausgewählte Originale gehören nicht zum aktuellen Mandanten.'); if (c.kind === 'location_switch_review' && selected[0]?.id === selected[1]?.id)
    throw Error('Ein Standortwechsel benötigt zwei verschiedene Standortoriginale.'); if (c.kind === 'context_transition' && selected[0]?.id === selected[1]?.id)
    throw Error('Ein Kontextwechsel benötigt verschiedene Ausgangs- und Zieloriginale.'); for (const rule of d.fields)
    validateField(c.payload[rule.key], rule); if (c.kind === 'catalog_version_draft' && Date.parse(String(c.payload.validUntil)) <= Date.parse(String(c.payload.validFrom)))
    throw Error('Die Kataloggültigkeit ist nicht chronologisch.'); }
export const emptyOrganizationLifecycleState = (): OrganizationLifecycleState => ({ headId: null, events: [], corrected: [] });
export function applyOrganizationLifecycleCommand(state: OrganizationLifecycleState, c: OrganizationLifecycleCommand) { validateOrganizationLifecycleCommand(c); if (c.expectedHeadId !== state.headId)
    throw Error('Der Organisationsverlauf wurde zwischenzeitlich geändert.'); if (state.events.some(x => x.id === c.eventId || x.command.requestId === c.requestId))
    throw Error('Anfrage oder Ereignis ist bereits vorhanden.'); const corrected = [...state.corrected]; if (c.kind === 'correction') {
    const target = String(c.payload.targetId);
    if (!state.events.some(x => x.id === target && x.command.kind !== 'correction') || corrected.includes(target))
        throw Error('Nur ein vorhandener noch nicht berichtigter Originalvorgang kann berichtigt werden.');
    corrected.push(target);
} return { headId: c.eventId, events: [...state.events], corrected }; }
export function decodeOrganizationLifecycleHistory(value: unknown, scope: {
    tenantId: string;
}) { if (!object(value) || value.version !== organizationLifecycleVersion || value.tenantId !== scope.tenantId || !Array.isArray(value.events) || value.count !== value.events.length)
    throw Error('Der Organisationsverlauf ist unvollständig.'); let state = emptyOrganizationLifecycleState(); for (let i = 0; i < value.events.length; i++) {
    const raw = value.events[i];
    if (!object(raw) || raw.sequence !== i + 1 || raw.previousId !== state.headId || raw.tenantId !== scope.tenantId || !object(raw.command))
        throw Error('Der Organisationsverlauf ist abgeschnitten oder falsch zugeordnet.');
    const c = structuredClone(raw.command) as OrganizationLifecycleCommand;
    validateOrganizationLifecycleCommand(c);
    if (raw.id !== c.eventId || c.tenantId !== scope.tenantId)
        throw Error('Der Organisationsverlauf enthält ein fremdes Original.');
    state = applyOrganizationLifecycleCommand(state, c);
    state.events.push(structuredClone(raw) as OrganizationLifecycleEvent);
} if (value.headId !== state.headId)
    throw Error('Der Organisationsverlauf hat keinen eindeutigen Kopf.'); return { history: structuredClone(value) as OrganizationLifecycleHistory, state }; }
export function decodeOrganizationLifecycleContext(value: unknown, expected: {
    tenantId: string;
    actorId: string;
}) { if (!object(value) || Object.keys(value).sort().join(',') !== 'actorId,history,loadedAt,sources,tenantId,version' || value.version !== organizationLifecycleVersion || value.tenantId !== expected.tenantId || value.actorId !== expected.actorId || !object(value.sources) || !Array.isArray(value.sources.rows) || value.sources.count !== value.sources.rows.length)
    throw Error('Vollständige Organisationsoriginale konnten nicht bestätigt werden.'); time(value.loadedAt, 'Lesezeitpunkt'); const seen = new Set<string>(); for (const row of value.sources.rows) {
    organizationLifecycleSource(row);
    const key = `${row.kind}:${row.id}`;
    if (seen.has(key))
        throw Error('Originalquelle ist doppelt.');
    seen.add(key);
    if (row.snapshot.tenant_id !== undefined && row.snapshot.tenant_id !== expected.tenantId)
        throw Error('Originalquelle gehört zu einem anderen Mandanten.');
} decodeOrganizationLifecycleHistory(value.history, expected); return structuredClone(value) as OrganizationLifecycleContext; }
export function assertOrganizationLifecycleSelectionCurrent(c: OrganizationLifecycleCommand, context: OrganizationLifecycleContext) { validateOrganizationLifecycleCommand(c); for (const rule of organizationLifecycleDefinitions[c.kind].sources) {
    const source = c.payload[rule.key] as OrganizationLifecycleSource;
    if (!context.sources.rows.some(row => JSON.stringify(row) === JSON.stringify(source)))
        throw Error('Eine ausgewählte Organisationsgrundlage ist nicht mehr aktuell.');
} }
export function decodeOrganizationLifecycleReceipt(value: unknown, c: OrganizationLifecycleCommand) { if (!object(value) || value.version !== organizationLifecycleVersion || value.requestId !== c.requestId || !object(value.command) || JSON.stringify(value.command) !== JSON.stringify(c) || !object(value.event) || value.event.id !== c.eventId || JSON.stringify(value.event.command) !== JSON.stringify(c))
    throw Error('Die native Organisationsquittung stimmt nicht mit der gesicherten Anfrage überein.'); return structuredClone(value) as OrganizationLifecycleReceipt; }
