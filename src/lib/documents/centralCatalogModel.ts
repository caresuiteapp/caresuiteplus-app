import type { CentralDocumentContext, CentralDocumentDefinition, CentralDocumentSnapshot } from '@/types/documents/centralCatalog';

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
    const [group, name] = field.sourcePath?.split('.') ?? [];
    const source = group && name ? (frozenContext[group as keyof CentralDocumentContext] as Record<string, string>)?.[name] : '';
    values[field.key] = field.key === 'date' ? new Date().toISOString().slice(0, 10) : field.key === 'author' ? author : source || field.defaultValue || '';
    fieldOrigins[field.key] = field.key === 'date' || (!source && field.defaultValue) ? 'default' : values[field.key] ? 'stored' : 'empty';
  }
  return {
    definition: JSON.parse(JSON.stringify(definition)) as CentralDocumentDefinition,
    context: frozenContext, values, fieldOrigins, tableRows: definition.columns.length ? [definition.columns.map(() => '')] : [],
    sectionTexts: Object.fromEntries(definition.sections.map((s) => [s.key, s.text])),
    additionalText: '', createdAt: new Date().toISOString(), documentId: id, revision: 1,
  };
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
