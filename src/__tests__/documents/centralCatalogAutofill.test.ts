import { describe, expect, it } from 'vitest';
import { CENTRAL_DOCUMENT_CATALOG } from '@/data/seeds/documentCatalog/centralCatalog';
import { createCentralSnapshot, refreshCentralSnapshot } from '@/lib/documents/centralCatalogModel';
import { centralActualServiceRows, mapCentralContext } from '@/lib/documents/centralCatalogService';

const definition = CENTRAL_DOCUMENT_CATALOG.find((entry) => entry.key === 'csdc_einsatz_006')!;
const context = () => mapCentralContext({ tenantId: 'tenant-A', target: 'client', entityId: 'client-A', company: { name: 'Unternehmen', street: 'Parkstraße 12', postal_code: '10115', city: 'Berlin' }, subject: { first_name: 'Mara', last_name: 'Muster', care_level: 2 } });
describe('record data autofill and refresh', () => {
  it('refreshes stored values, clears removed sources and preserves individual changes', () => {
    const snapshot = createCentralSnapshot(definition, context(), 'Anna', 'doc-A');
    snapshot.values.companyName = 'Individuelle Bezeichnung'; snapshot.fieldOrigins.companyName = 'manual';
    snapshot.additionalText = 'Eigene Zusatzvereinbarung';
    const next = context(); next.company.name = 'Neuer Firmenname'; next.subject.name = 'Aktualisierte Person'; next.subject.careLevel = '';
    const refreshed = refreshCentralSnapshot(snapshot, next, 'Andere Person');
    expect(refreshed.values.companyName).toBe('Individuelle Bezeichnung'); expect(refreshed.values.subjectName).toBe('Aktualisierte Person');
    expect(refreshed.values.careLevel).toBe(''); expect(refreshed.values.author).toBe('Anna');
    expect(refreshed.additionalText).toBe('Eigene Zusatzvereinbarung'); expect(refreshed.documentId).toBe('doc-A');
    expect(() => refreshCentralSnapshot(snapshot, { ...next, entityId: 'client-B' }, 'Anna')).toThrow('nicht zu dieser Akte');
  });
  it('uses completed actual times, keeps confirmation blank and refuses planned or invalid times', () => {
    const visit = { execution_status: 'completed', actual_start_at: '2026-10-13T06:00:00Z', actual_end_at: '2026-10-13T07:30:00Z', service_name: 'Alltagsunterstützung' };
    const rows = centralActualServiceRows(definition, visit, 'Anna');
    expect(rows[0]).toEqual(['13.10.2026', '08:00', '09:30', 'Alltagsunterstützung', '90 Minuten', 'Anna', '']);
    expect(centralActualServiceRows(definition, { ...visit, execution_status: 'planned' }, 'Anna')).toEqual([]);
    expect(centralActualServiceRows(definition, { ...visit, actual_end_at: null }, 'Anna')).toEqual([]);
    expect(centralActualServiceRows(definition, { ...visit, actual_end_at: visit.actual_start_at }, 'Anna')).toEqual([]);
  });
  it('fills a stored period and table, then preserves manually edited rows on source refresh', () => {
    const data = context(); data.procedure = { period: '2026-10-01 bis 2026-10-31' }; data.sourceRows = [['13.10.2026', '08:00', '09:00', 'Leistung', '60 Minuten', 'Anna', '']];
    const snapshot = createCentralSnapshot(definition, data, 'Anna', 'doc-A');
    expect(snapshot.values.f0_leistungszeitraum).toBe(data.procedure.period); expect(snapshot.tableOrigin).toBe('stored');
    snapshot.tableRows[0][3] = 'Individuell ergänzte Leistung'; snapshot.tableOrigin = 'manual';
    const refreshed = refreshCentralSnapshot(snapshot, { ...data, sourceRows: [] }, 'Anna');
    expect(refreshed.tableRows[0][3]).toBe('Individuell ergänzte Leistung');
  });
  it('keeps company and client banking data separate', () => {
    const data = mapCentralContext({ tenantId: 'tenant-A', target: 'client', entityId: 'client-A', company: { name: 'Firma' }, settings: { iban: 'DE_COMPANY_IBAN' } });
    const sepa = CENTRAL_DOCUMENT_CATALOG.find((entry) => entry.key === 'csdc_vollmachten_015')!;
    expect(createCentralSnapshot(sepa, data, 'Anna', 'doc-A').values.f1_kontoinhaber_in_und_iban).toBe('');
  });
  it('requires a letter recipient choice and preserves its source on refresh', () => {
    const letter = CENTRAL_DOCUMENT_CATALOG.find((entry) => entry.layout === 'letter')!;
    const data = context(); const snapshot = createCentralSnapshot(letter, data, 'Anna', 'doc-A');
    expect(snapshot.values.subjectName).toBe(''); expect(snapshot.values.subjectAddress).toBe('');
    snapshot.recipientSource = 'company'; snapshot.values.subjectName = data.company.name; snapshot.values.subjectAddress = data.company.address; snapshot.fieldOrigins.subjectName = 'stored'; snapshot.fieldOrigins.subjectAddress = 'stored';
    const updated = context(); updated.company.name = 'Neue Unternehmensbezeichnung';
    const refreshed = refreshCentralSnapshot(snapshot, updated, 'Anna');
    expect(refreshed.values.subjectName).toBe('Neue Unternehmensbezeichnung'); expect(refreshed.context.entityId).toBe('client-A');
  });
});
