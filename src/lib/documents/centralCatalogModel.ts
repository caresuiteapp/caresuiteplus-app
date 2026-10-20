import type { CentralDocumentContext, CentralDocumentDefinition, CentralDocumentField, CentralDocumentSnapshot } from '@/types/documents/centralCatalog';

export const CENTRAL_COMMON_FIELDS = new Set(['date', 'author', 'companyName', 'companyAddress', 'subjectName', 'subjectAddress', 'birthDate', 'careLevel', 'payorName', 'insuranceNumber', 'personnelNumber', 'jobTitle']);

export function newCentralDocumentId(): string {
  if (!globalThis.crypto?.randomUUID) throw new Error('Für Dokument-IDs wird eine sichere Browser-Verbindung benötigt.');
  return globalThis.crypto.randomUUID();
}

export function createCentralSnapshot(definition: CentralDocumentDefinition, context: CentralDocumentContext, author: string, id = newCentralDocumentId()): CentralDocumentSnapshot {
  const frozenContext = JSON.parse(JSON.stringify(context)) as CentralDocumentContext;
  const values: Record<string, string> = {};
  const fieldOrigins: CentralDocumentSnapshot['fieldOrigins'] = {};
  for (const field of definition.fields) {
    const source = centralStoredFieldValue(field, frozenContext, definition.key);
    values[field.key] = field.key === 'date' ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) : field.key === 'author' ? author : source || field.defaultValue || '';
    fieldOrigins[field.key] = field.key === 'date' || (!source && field.defaultValue) ? 'default' : values[field.key] ? 'stored' : 'empty';
    if (/^f0_leistungszeitraum/.test(field.key) && frozenContext.procedure?.periodOrigin === 'selected') fieldOrigins[field.key] = 'default';
    if (definition.layout === 'letter' && ['subjectName', 'subjectAddress'].includes(field.key)) { values[field.key] = ''; fieldOrigins[field.key] = 'empty'; }
  }
  return {
    definition: JSON.parse(JSON.stringify(definition)) as CentralDocumentDefinition,
    context: frozenContext, values, fieldOrigins, tableRows: definition.columns.length ? frozenContext.sourceRows?.length ? frozenContext.sourceRows.map((row) => definition.columns.map((_, index) => row[index] || '')) : [definition.columns.map(() => '')] : [],
    tableOrigin: frozenContext.sourceRows?.length ? 'stored' : 'empty', recipientSource: definition.layout === 'letter' ? 'manual' : undefined,
    sectionTexts: Object.fromEntries(definition.sections.map((s) => [s.key, s.text])),
    additionalText: '', createdAt: new Date().toISOString(), documentId: id, revision: 1,
  };
}

export function centralStoredFieldValue(field: CentralDocumentField, context: CentralDocumentContext, templateKey: string): string {
  const customKey = field.sourcePath?.match(/^(?:tenant\.)?custom\.([a-z][a-z0-9_]*)$/)?.[1];
  if (customKey) return context.custom?.[customKey] ?? '';
  const [group, name] = field.sourcePath?.split('.') ?? [];
  return (group && name ? (context[group as keyof CentralDocumentContext] as Record<string, string>)?.[name] : '') || centralProcedureValue(field.key, context, templateKey);
}

function centralProcedureValue(key: string, context: CentralDocumentContext, templateKey: string): string {
  if (templateKey === 'csdc_software_001' && key === 'cs_contact') return context.company.representativeName || '';
  if (templateKey === 'csdc_datenschutz_005' && key === 'cs_employer') return [context.company.name, context.company.address, [context.company.phone, context.company.email].filter(Boolean).join(' · '), 'Datenschutzkontakt: [individuell ergänzen]'].filter(Boolean).join('\n');
  if (/^f0_leistungszeitraum/.test(key)) return context.procedure?.period || '';
  if (key === 'f0_taetigkeit_zeitraum_und_anlass' && context.target === 'employee') return [context.employee.jobTitle, context.employee.entryDate ? `Eintritt: ${context.employee.entryDate}` : '', context.employee.exitDate ? `Austritt: ${context.employee.exitDate}` : ''].filter(Boolean).join('\n');
  if (key === 'f1_qualifikation_aufgaben_und_zustaendigkeit') return context.employee.qualification || '';
  if (key === 'f1_beginn_laufzeit_und_durchfuehrung') return context.subject.serviceStart ? `Leistungsbeginn: ${context.subject.serviceStart}` : '';
  const clinical: Record<string, string> = {
    f0_aerztliche_anordnung_und_gueltiger_planstand: 'medicationReference', f1_arzneimittel_dosierung_und_applikationsweg: 'medicationDetails',
    f0_lokalisation_wundart_und_entstehung: 'woundLocation', f1_laenge_breite_tiefe_und_messverfahren: 'woundMeasurements',
    f2_wundgrund_wundrand_und_wundumgebung: 'woundCondition', f3_exsudat_geruch_schmerz_und_infektionszeichen: 'woundSymptoms',
    f4_versorgung_material_und_anordnung: 'woundTreatment', f5_verlauf_fotoverweis_und_naechste_kontrolle: 'woundFollowup',
  };
  if (clinical[key]) return context.procedure?.[clinical[key]] || '';
  return '';
}

/** Refresh stored values without replacing the user's edits or changing the assigned record. */
export function refreshCentralSnapshot(snapshot: CentralDocumentSnapshot, context: CentralDocumentContext, author: string): CentralDocumentSnapshot {
  if (context.tenantId !== snapshot.context.tenantId || context.target !== snapshot.context.target || context.entityId !== snapshot.context.entityId) throw new Error('Die Stammdaten gehören nicht zu dieser Akte.');
  const fresh = createCentralSnapshot(snapshot.definition, context, author, snapshot.documentId);
  if (snapshot.definition.layout === 'letter' && snapshot.recipientSource && snapshot.recipientSource !== 'manual') {
    const recipient = context[snapshot.recipientSource];
    fresh.values.subjectName = recipient.name || ''; fresh.values.subjectAddress = recipient.address || '';
    fresh.fieldOrigins.subjectName = fresh.values.subjectName ? 'stored' : 'empty'; fresh.fieldOrigins.subjectAddress = fresh.values.subjectAddress ? 'stored' : 'empty';
  }
  const values = { ...snapshot.values }; const fieldOrigins = { ...snapshot.fieldOrigins };
  for (const field of snapshot.definition.fields) {
    if (fieldOrigins[field.key] === 'manual' || field.key === 'date' || field.key === 'author') continue;
    values[field.key] = fresh.values[field.key]; fieldOrigins[field.key] = fresh.fieldOrigins[field.key];
  }
  return { ...snapshot, context: fresh.context, values, fieldOrigins, ...(snapshot.tableOrigin === 'stored' ? { tableRows: fresh.tableRows, tableOrigin: fresh.tableOrigin } : {}) };
}

export function centralMissingFields(snapshot: CentralDocumentSnapshot): string[] {
  return snapshot.definition.fields.filter((field) => field.required && !snapshot.values[field.key]?.trim()).map((field) => field.label);
}

export function centralFileName(snapshot: CentralDocumentSnapshot): string {
  const title = snapshot.definition.title.normalize('NFKD').replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-|-$/g, '').slice(0, 75);
  return `${title}_${snapshot.documentId}_v${snapshot.revision}_ENTWURF.pdf`;
}

export function centralDocumentIntegrityLabel(hash: string): string {
  return `SHA-256 ${hash}`;
}
