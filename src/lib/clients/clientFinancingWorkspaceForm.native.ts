// Generated native presentation from src/lib/clients/clientFinancingWorkspaceForm.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeStructuredClone as structuredClone} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { clientFinancingWorkspaceVersion, validateClientFinancingCommand, type ClientFinancingCommand, type ClientFinancingContext, type ClientFinancingKind, type ClientFinancingSource, type ClientFinancingState } from "./clientFinancingWorkspaceDomain.native.ts";
export type ClientFinancingField = {
    key: string;
    label: string;
    placeholder?: string;
};
export type ClientFinancingSourceField = {
    key: string;
    label: string;
    kinds: readonly string[];
};
export type ClientFinancingDraft = {
    version: typeof clientFinancingWorkspaceVersion;
    scope: {
        tenantId: string;
        clientId: string;
        actorId: string;
    };
    headId: string | null;
    kind: ClientFinancingKind;
    occurredAt: string;
    note: string;
    values: Record<string, string>;
    selected: Record<string, {
        id: string;
        value: ClientFinancingSource;
    }>;
};
const configs: Record<ClientFinancingKind, {
    group: string;
    fields: ClientFinancingField[];
    sources: ClientFinancingSourceField[];
}> = {
    contract_basis: { group: 'Vertrag', sources: [{ key: 'contract', label: 'Nativer Vertrag', kinds: ['contract'] }, { key: 'document', label: 'Originaldokument', kinds: ['document'] }], fields: [['partner', 'Vertragspartner'], ['serviceBasis', 'Leistungsgrundlage'], ['validFrom', 'Vertragsbeginn', 'JJJJ-MM-TT'], ['versionLabel', 'Vertragsfassung']].map(([key, label, placeholder]) => ({ key, label, placeholder })) },
    financing_path: { group: 'Finanzierung', sources: [{ key: 'basis', label: 'Originalgrundlage', kinds: ['contract', 'document', 'decision'] }], fields: [['financingKind', 'Finanzierungsart (sgb_xi / sgb_v / private / other)'], ['payer', 'Kostenträger / Privatperson'], ['validFrom', 'Gültig ab', 'JJJJ-MM-TT'], ['status', 'Status (draft / active / ended / cancelled)']].map(([key, label, placeholder]) => ({ key, label, placeholder })) },
    approval_application: { group: 'Genehmigung', sources: [{ key: 'path', label: 'Finanzierungsweg', kinds: ['financing_path'] }, { key: 'document', label: 'Antragsoriginal', kinds: ['document', 'decision'] }], fields: [['applicationOn', 'Antragsdatum', 'JJJJ-MM-TT'], ['requestedFrom', 'Beantragt ab', 'JJJJ-MM-TT'], ['requestedUntil', 'Beantragt bis', 'JJJJ-MM-TT'], ['reference', 'Antragsreferenz']].map(([key, label, placeholder]) => ({ key, label, placeholder })) },
    approval_decision: { group: 'Genehmigung', sources: [{ key: 'path', label: 'Finanzierungsweg', kinds: ['financing_path'] }, { key: 'application', label: 'Konkreter Antrag', kinds: ['approval'] }, { key: 'document', label: 'Entscheidungsoriginal', kinds: ['document', 'decision'] }], fields: [['decision', 'Entscheidung (approved / declined / withdrawn)'], ['decidedOn', 'Entschieden am', 'JJJJ-MM-TT'], ['approvedFrom', 'Genehmigt ab', 'JJJJ-MM-TT'], ['approvedUntil', 'Genehmigt bis', 'JJJJ-MM-TT']].map(([key, label, placeholder]) => ({ key, label, placeholder })) },
    tariff_position: { group: 'Tarif & Betrag', sources: [{ key: 'path', label: 'Finanzierungsweg', kinds: ['financing_path'] }, { key: 'agreement', label: 'Tarifvereinbarung', kinds: ['contract', 'document', 'tariff'] }], fields: [['serviceCode', 'Leistungscode'], ['unit', 'Einheit'], ['unitPrice', 'Preis in EUR'], ['validFrom', 'Gültig ab', 'JJJJ-MM-TT'], ['roundingRule', 'Rundungsregel']].map(([key, label, placeholder]) => ({ key, label, placeholder })) },
    calculation: { group: 'Tarif & Betrag', sources: [{ key: 'path', label: 'Finanzierungsweg', kinds: ['financing_path'] }, { key: 'tariff', label: 'Konkrete Tarifposition', kinds: ['tariff'] }], fields: [['quantity', 'Menge'], ['baseAmount', 'Grundbetrag EUR'], ['surcharge', 'Zuschlag EUR'], ['totalAmount', 'Gesamtbetrag EUR'], ['calculationRule', 'Berechnungs- und Rundungsregel']].map(([key, label]) => ({ key, label })) },
    budget_basis: { group: 'Budget & Anspruch', sources: [{ key: 'path', label: 'Finanzierungsweg', kinds: ['financing_path'] }, { key: 'decision', label: 'Individueller Bescheid', kinds: ['document', 'decision'] }], fields: [['serviceType', 'Leistungsart'], ['allocatedAmount', 'Anspruchsbetrag EUR'], ['validFrom', 'Anspruch ab', 'JJJJ-MM-TT'], ['validUntil', 'Anspruch bis', 'JJJJ-MM-TT']].map(([key, label, placeholder]) => ({ key, label, placeholder })) },
    budget_consumption: { group: 'Budget & Anspruch', sources: [{ key: 'budget', label: 'Konkrete Anspruchsgrundlage', kinds: ['budget'] }, { key: 'service', label: 'Tatsächlicher Leistungs-/Belegoriginal', kinds: ['service', 'proof', 'visit'] }], fields: [['eventKind', 'Ereignis (usage / correction / cancellation)'], ['amount', 'Betrag EUR'], ['serviceOn', 'Leistungsdatum', 'JJJJ-MM-TT'], ['evidence', 'Verbrauchs-/Stornobeleg']].map(([key, label, placeholder]) => ({ key, label, placeholder })) },
    estimate_version: { group: 'Angebot', sources: [{ key: 'path', label: 'Finanzierungsweg', kinds: ['financing_path'] }, { key: 'tariff', label: 'Tarifposition', kinds: ['tariff'] }, { key: 'document', label: 'Ausgegebenes Angebotsdokument', kinds: ['document'] }], fields: [['versionLabel', 'Angebotsfassung'], ['payerAmount', 'Kostenträgeranteil EUR'], ['selfPayAmount', 'Eigenanteil EUR'], ['serviceFrom', 'Leistung ab', 'JJJJ-MM-TT'], ['serviceUntil', 'Leistung bis', 'JJJJ-MM-TT'], ['fingerprint', 'Inhaltsfingerabdruck']].map(([key, label, placeholder]) => ({ key, label, placeholder })) },
    estimate_decision: { group: 'Angebot', sources: [{ key: 'estimate', label: 'Konkrete Angebotsfassung', kinds: ['estimate'] }, { key: 'document', label: 'Entscheidungsnachweis', kinds: ['document'] }], fields: [['decision', 'Entscheidung (accepted / declined)'], ['decidingPerson', 'Entscheidende Person / Rolle'], ['decidedAt', 'Tatsächlicher Entscheidungszeitpunkt'], ['evidence', 'Entscheidungsbeleg']].map(([key, label]) => ({ key, label })) },
    contract_change: { group: 'Vertragsverlauf', sources: [{ key: 'contract', label: 'Bisherige Vertragsfassung', kinds: ['contract'] }, { key: 'document', label: 'Änderungsoriginal', kinds: ['document'] }], fields: [['effectiveOn', 'Wirksam ab', 'JJJJ-MM-TT'], ['reason', 'Änderungsgrund'], ['consequences', 'Konkrete Folgen'], ['versionLabel', 'Neue Vertragsfassung']].map(([key, label, placeholder]) => ({ key, label, placeholder })) },
    contract_closure: { group: 'Vertragsverlauf', sources: [{ key: 'contract', label: 'Zu schließende Vertragsfassung', kinds: ['contract'] }, { key: 'document', label: 'Schließungsoriginal', kinds: ['document'] }], fields: [['effectiveOn', 'Schließung wirksam am', 'JJJJ-MM-TT'], ['reason', 'Schließungsgrund'], ['consequences', 'Folgen für geplante/alte Leistungen']].map(([key, label, placeholder]) => ({ key, label, placeholder })) },
    combination_review: { group: 'Regelprüfung', sources: [{ key: 'path', label: 'Finanzierungsweg', kinds: ['financing_path'] }, { key: 'rule', label: 'Datumsgültige Kombinationsregel', kinds: ['combination_rule'] }], fields: [['serviceA', 'Erste Leistungsart'], ['serviceB', 'Zweite Leistungsart'], ['serviceOn', 'Leistungsdatum', 'JJJJ-MM-TT'], ['outcome', 'Ergebnis (allowed / prohibited / surcharge_required)'], ['ruleReference', 'Konkrete Regelreferenz']].map(([key, label, placeholder]) => ({ key, label, placeholder })) },
    entitlement_version: { group: 'Budget & Anspruch', sources: [{ key: 'path', label: 'Finanzierungsweg', kinds: ['financing_path'] }, { key: 'decision', label: 'Individueller Bescheid', kinds: ['document', 'decision'] }], fields: [['entitlementKind', 'Anspruchsart (money / hours / days / units)'], ['unit', 'Einheit'], ['quantity', 'Anspruchsmenge'], ['validFrom', 'Gültig ab', 'JJJJ-MM-TT'], ['validUntil', 'Gültig bis', 'JJJJ-MM-TT'], ['fingerprint', 'Grundlagenfingerabdruck']].map(([key, label, placeholder]) => ({ key, label, placeholder })) },
    correction: { group: 'Berichtigung', sources: [], fields: [['targetId', 'Zu berichtigende Ereignis-ID'], ['reason', 'Berichtigungsgrund']].map(([key, label]) => ({ key, label })) },
};
export const clientFinancingGroups = [...new Set(Object.values(configs).map(value => value.group))];
export const clientFinancingKindsForGroup = (group: string) => (Object.keys(configs) as ClientFinancingKind[]).filter(kind => configs[kind].group === group);
export const clientFinancingFields = (kind: ClientFinancingKind) => configs[kind].fields;
export const clientFinancingSourceFields = (kind: ClientFinancingKind) => configs[kind].sources;
export const clientFinancingSourceOptions = (field: ClientFinancingSourceField, context: ClientFinancingContext) => context.sources.rows.filter(row => field.kinds.includes(row.kind)).map(row => ({ id: row.id, label: [String(row.snapshot.title ?? row.snapshot.contract_number ?? row.snapshot.payer_name ?? row.snapshot.service_code ?? row.snapshot.reference ?? row.kind), String(row.snapshot.version ?? ''), row.id].filter(Boolean).join(' · '), value: row }));
export function buildClientFinancingCommand(draft: ClientFinancingDraft, state: ClientFinancingState, requestId: string, eventId: string): ClientFinancingCommand {
    const payload: Record<string, unknown> = { ...draft.values };
    for (const [key, selection] of Object.entries(draft.selected))
        payload[key] = structuredClone(selection.value);
    const command: ClientFinancingCommand = { version: clientFinancingWorkspaceVersion, requestId, eventId, tenantId: draft.scope.tenantId, clientId: draft.scope.clientId, actorId: draft.scope.actorId, expectedHeadId: state.headId, kind: draft.kind, occurredAt: draft.occurredAt, note: draft.note, payload };
    validateClientFinancingCommand(command);
    return command;
}
