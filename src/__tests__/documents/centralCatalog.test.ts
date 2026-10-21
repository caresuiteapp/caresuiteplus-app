import { describe, it, expect } from 'vitest';
import { CENTRAL_DOCUMENT_CATALOG, filterCentralDocuments, centralDocumentCatalogHref } from '@/data/seeds/documentCatalog/centralCatalog';
import { CENTRAL_CATALOG_GROUPS } from '@/data/seeds/documentCatalog/centralCatalogTitles';
import { createCentralSnapshot, centralMissingFields } from '@/lib/documents/centralCatalogModel';
import { mapCentralContext } from '@/lib/documents/centralCatalogService';
import { sha256FileHex } from '@/lib/crypto/sha256Hex';
import { createHash } from 'node:crypto';
import { canonicalJson, validateCentralPayload, decodePdf } from '../../../supabase/functions/central-document-record/payload';

const tenantId = '11111111-1111-4111-8111-111111111111';
const personId = '22222222-2222-4222-8222-222222222222';
export const context = mapCentralContext({ tenantId, target: 'client', entityId: personId,
  company: { name: 'Pflege am Park GmbH', street: 'Parkstraße', house_number: '12', postal_code: '10115', city: 'Berlin', phone: '030 555 123', email: 'kontakt@example.test', website: 'www.example.test' },
  subject: { first_name: 'Mara', last_name: 'Muster', street: 'Blumenstraße 8', postal_code: '10117', city: 'Berlin', date_of_birth: '1948-03-19' },
});

describe('new central document catalogue', () => {
  it('preserves all 430 existing entries and adds 20 software documents with unique IDs', () => {
    expect(CENTRAL_DOCUMENT_CATALOG).toHaveLength(450);
    expect(CENTRAL_CATALOG_GROUPS).toHaveLength(25);
    expect(CENTRAL_DOCUMENT_CATALOG.filter((d)=>d.categoryKey!=='software')).toHaveLength(430);
    expect(new Set(CENTRAL_DOCUMENT_CATALOG.map((d) => d.key)).size).toBe(450);
    expect(new Set(CENTRAL_DOCUMENT_CATALOG.map((d) => d.categoryKey)).size).toBe(25);
    for (const d of CENTRAL_DOCUMENT_CATALOG) {
      expect(d.fields.every((f) => f.label && f.key)).toBe(true);
      expect(new Set(d.fields.map((f) => f.key)).size).toBe(d.fields.length);
      expect(d.reviewStatus).toBe('draft');
      expect(d.orientation).toBe(d.layout === 'table' ? 'landscape' : 'portrait');
      expect(d.modules.length).toBeGreaterThan(0);
    }
  });
  it('uses known software defaults without replacing the tenant or missing approvals', () => {
    const definition = CENTRAL_DOCUMENT_CATALOG.find((d)=>d.key==='csdc_software_001')!;
    const tenantContext={...context,target:'company' as const,entityId:tenantId,subject:{name:context.company.name,address:context.company.address}};
    const snapshot=createCentralSnapshot(definition,tenantContext,'Anna Fachkraft');
    expect(snapshot.values.companyName).toBe('Pflege am Park GmbH');
    expect(snapshot.values.cs_provider).toContain('Kevin Reinhardt');
    expect(snapshot.fieldOrigins.cs_provider).toBe('default');
    expect(centralMissingFields(snapshot)).toContain('Nutzungsbeginn und einbezogene Anlagen');
    expect(snapshot.definition.reviewStatus).toBe('draft');
    const employeePrivacy=CENTRAL_DOCUMENT_CATALOG.find((d)=>d.key==='csdc_datenschutz_005')!;
    expect(employeePrivacy.target).toBe('employee');
    expect(employeePrivacy.version).toBe(2);
    expect(CENTRAL_DOCUMENT_CATALOG.find((d)=>d.key==='csdc_software_005')!.fields.some(f=>f.key==='insuranceNumber')).toBe(false);
    const careContract=CENTRAL_DOCUMENT_CATALOG.find((d)=>d.key==='csdc_vertraege_001')!;
    expect(careContract.version).toBe(3);
    expect(careContract.edition).toBe('2027');
    expect(careContract.sections.find(s=>s.key==='cs_contract')!.text).toContain('Leistungen der im Dokument bezeichneten Organisation');
  });
  it('filters multiple search words, category and actual module context', () => {
    expect(filterCentralDocuments({ query: 'Leistungs nachweis' }).length).toBeGreaterThan(3);
    expect(filterCentralDocuments({ category: 'wunden' })).toHaveLength(16);
    expect(filterCentralDocuments({ category: 'wunden', module: 'pflege' })).toHaveLength(16);
    expect(filterCentralDocuments({ query: 'does-not-exist' })).toHaveLength(0);
    const url = centralDocumentCatalogHref({ module: 'pflege', clientId: 'A B&?C', templateKey: 'csdc_wunden_001' });
    expect(new URL(url, 'https://caresuite.example').searchParams.get('clientId')).toBe('A B&?C');
  });
  it('does not fabricate authoritative originals or mark drafts certified', () => {
    for (const name of ['Verordnung häuslicher Krankenpflege', 'Vorsorgevollmacht', 'Patientenverfügung']) {
      const d = CENTRAL_DOCUMENT_CATALOG.find((r) => r.title === name);
      expect(d?.sourceMode).toBe('original'); expect(d?.layout).toBe('form');
    }
    const contract = CENTRAL_DOCUMENT_CATALOG.find((r) => r.title === 'Ambulanter Pflegevertrag');
    expect(contract?.layout).toBe('contract'); expect(contract?.sections.length).toBeGreaterThan(6);
  });
  it('freezes autofill without mutating stored data and keeps manual additions separate', () => {
    const c = JSON.parse(JSON.stringify(context));
    const d = CENTRAL_DOCUMENT_CATALOG[0];
    const snapshot = createCentralSnapshot(d, c, 'Anna Fachkraft', '33333333-3333-4333-8333-333333333333');
    c.company.name = 'Changed after creation';
    expect(snapshot.values.companyName).toBe('Pflege am Park GmbH');
    expect(snapshot.values.subjectName).toBe('Mara Muster');
    expect(snapshot.fieldOrigins.subjectName).toBe('stored');
    expect(snapshot.additionalText).toBe('');
    expect(centralMissingFields(snapshot)).toContain(d.fields.find((f) => f.key.startsWith('f0_'))!.label);
  });
  it('only maps allowed source fields, not login codes or salary', () => {
    const c = mapCentralContext({ tenantId, target: 'employee', entityId: personId,
      company: { name: 'Firma', notes: 'secret', payment_token: 'secret' },
      subject: { first_name: 'Anna', last_name: 'Muster', portal_code: 'secret', hourly_wage: 44, bank_iban: 'secret', date_of_birth: null },
    });
    expect(JSON.stringify(c)).not.toContain('secret'); expect(c.subject.birthDate).toBe('');
  });
  it('hashes real binary bytes, including non-UTF-8, with standard SHA-256', () => {
    const bytes = new Uint8Array([0, 255, 128, 32, 10, 83, 254]);
    expect(sha256FileHex(bytes)).toBe(createHash('sha256').update(bytes).digest('hex'));
  });
});

describe('server payload boundary', () => {
  const complete = () => {
    const s = createCentralSnapshot(CENTRAL_DOCUMENT_CATALOG[0], context, 'Anna Fachkraft', '33333333-3333-4333-8333-333333333333');
    s.definition.fields.forEach((f) => { if (!s.values[f.key]) s.values[f.key] = 'Prüfangabe'; }); return s;
  };
  it('rejects missing values, mismatched target, forged corporate entity and malformed JSON', () => {
    expect(validateCentralPayload(null as never).ok).toBe(false);
    expect(validateCentralPayload({ snapshot: { documentId: 'invalid' } }).ok).toBe(false);
    const s = complete(); s.context.target = 'employee';
    expect(validateCentralPayload({ snapshot: s, pdfBase64: 'PDF' }).ok).toBe(false);
    s.context.target = 'company'; s.definition.target = 'company';
    expect(validateCentralPayload({ snapshot: s, pdfBase64: 'PDF' }).ok).toBe(false);
    const malformed = complete(); (malformed.definition.fields as unknown[]) = [null];
    expect(validateCentralPayload({ snapshot: malformed, pdfBase64: 'PDF' }).ok).toBe(false);
  });
  it('requires authoritative originals and real PDF file markers', () => {
    const s = complete(); s.definition.sourceMode = 'original';
    expect(validateCentralPayload({ snapshot: s, pdfBase64: 'PDF' }).ok).toBe(false);
    expect(() => decodePdf(btoa('<html>not a PDF</html>'))).toThrow();
    expect(() => decodePdf(btoa('%PDF-1.7\nmissing trailer'))).toThrow();
    expect(decodePdf(btoa('%PDF-1.7\n1 0 obj<<>>endobj\n%%EOF')).length).toBeGreaterThan(10);
  });
  it('canonical hashes are independent of object key ordering', () => {
    expect(canonicalJson({ b: 2, a: { d: 4, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 4 }, b: 2 }));
    expect(validateCentralPayload({ snapshot: complete(), pdfBase64: 'PDF' }).ok).toBe(true);
  });
  it('rejects stored snapshots that cannot be edited or rendered safely',()=>{
    const table=complete(); (table.tableRows as unknown[])=[null];
    expect(validateCentralPayload({snapshot:table,pdfBase64:'PDF'}).ok).toBe(false);
    const sections=complete(); (sections.sectionTexts as unknown)=[];
    expect(validateCentralPayload({snapshot:sections,pdfBase64:'PDF'}).ok).toBe(false);
    const source=complete(); source.context.sourceFetchedAt='not-a-date';
    expect(validateCentralPayload({snapshot:source,pdfBase64:'PDF'}).ok).toBe(false);
  });
});
