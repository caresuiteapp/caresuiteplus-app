import { describe, expect, it } from 'vitest';
import { CENTRAL_DOCUMENT_CATALOG } from '@/data/seeds/documentCatalog/centralCatalog';
import { CENTRAL_CATALOG_INDEX } from '@/data/seeds/documentCatalog/centralCatalogIndex';
import { DOCUMENT_RECOMMENDATION_RULES, documentCatalogRoute, documentRecordScope, documentWorkflowForArea, getDocumentRecommendations } from '@/lib/documents/documentRecommendations';

describe('workflow document suggestions and record routing', () => {
  it('uses the same 450 definitions and never suggests a nonexistent document', () => {
    expect(CENTRAL_CATALOG_INDEX.map((entry) => entry.key)).toEqual(CENTRAL_DOCUMENT_CATALOG.map((entry) => entry.key));
    for (const rules of Object.values(DOCUMENT_RECOMMENDATION_RULES)) for (const [key] of rules) expect(CENTRAL_CATALOG_INDEX.some((entry) => entry.key === key)).toBe(true);
  });
  it('keeps the actual client, employee and completed visit when opening a service proof', () => {
    const result = getDocumentRecommendations({ module: 'assist', workflow: 'service_proof', clientId: 'client-A', employeeId: 'employee-B', assignmentId: 'visit-C' });
    const query = new URL(result[0].href, 'https://example.test').searchParams;
    expect(query.get('templateKey')).toBe('csdc_einsatz_006');
    expect(query.get('clientId')).toBe('client-A'); expect(query.get('assignmentId')).toBe('visit-C');
    expect(documentRecordScope({ clientId: 'client-A', employeeId: 'employee-B' })).toEqual({ target: 'client', entityId: 'client-A' });
  });
  it('filters portal suggestions by the person type and does not invent a client', () => {
    const result = getDocumentRecommendations({ workflow: 'portal_access', employeeId: 'employee-A' });
    expect(result.some((entry) => entry.key === 'csdc_software_004')).toBe(true);
    expect(result.every((entry) => entry.target !== 'client')).toBe(true);
    expect(documentRecordScope({})).toBeUndefined();
    expect(documentCatalogRoute({ workflow: 'client_intake' })).not.toContain('clientId');
  });
  it('offers the resident contract in Stationär and the employee return checklist at exit', () => {
    expect(getDocumentRecommendations({ module: 'stationaer', workflow: 'client_contracts' })[0].key).toBe('csdc_vertraege_005');
    expect(getDocumentRecommendations({ workflow: 'employee_exit', employeeId: 'employee-A' }).map((entry) => entry.key)).toEqual(['csdc_personal_022']);
  });
  it('chooses contracts by setting and keeps residential documents out of ambulatory suggestions', () => {
    expect(getDocumentRecommendations({ module: 'ambulant', workflow: 'client_contracts' }).map((entry) => entry.key))
      .toEqual(['csdc_vertraege_001', 'csdc_vollmachten_002', 'csdc_vertraege_016']);
    expect(getDocumentRecommendations({ module: 'alltagsbegleitung', workflow: 'client_contracts' })[0].key).toBe('csdc_vertraege_003');
    for (const module of ['office', 'pflege', 'assist', undefined]) {
      expect(getDocumentRecommendations({ module, workflow: 'client_contracts' }, 4).some((entry) => entry.key === 'csdc_vertraege_005')).toBe(false);
      expect(getDocumentRecommendations({ module, workflow: 'handover' }).some((entry) => entry.key === 'csdc_teilstationaer_007')).toBe(false);
      expect(getDocumentRecommendations({ module, workflow: 'equipment' }).some((entry) => entry.key === 'csdc_stationaer_004')).toBe(false);
    }
    expect(getDocumentRecommendations({ module: 'stationaer', workflow: 'handover' }).some((entry) => entry.key === 'csdc_teilstationaer_007')).toBe(true);
    expect(getDocumentRecommendations({ module: 'stationaer', workflow: 'equipment' }).some((entry) => entry.key === 'csdc_stationaer_004')).toBe(true);
  });
  it('links assessments, care plans and vital measurements to their own catalog templates', () => {
    const module = 'pflege';
    const clientId = 'client-A';
    for (const [area, key] of [['sis', 'csdc_pflegeplanung_001'], ['measures', 'csdc_pflegeplanung_007'], ['vitals', 'csdc_behandlungspflege_008'], ['vitalwerte', 'csdc_behandlungspflege_008']]) {
      const workflow = documentWorkflowForArea(module, area);
      const suggestion = getDocumentRecommendations({ module, workflow, clientId })[0];
      const query = new URL(suggestion.href, 'https://example.test').searchParams;
      expect(suggestion.key).toBe(key);
      expect(query.get('clientId')).toBe(clientId);
      expect(query.get('workflow')).toBe(workflow);
    }
  });
  it('puts only permitted identifiers in URLs and validates period and template', () => {
    const href = documentCatalogRoute({ module: 'ambulant', clientId: 'Mara Muster & Diagnose', templateKey: 'unknown', invoiceId: 'invoice-A', period: '2026-13', tab: 'records' });
    expect(href).toContain('module=pflege'); expect(href).toContain('invoiceId=invoice-A');
    expect(href).toContain('tab=records'); expect(href).not.toMatch(/Mara|Diagnose|templateKey|period=/);
    const databaseTemplateHref = documentCatalogRoute({ module: 'neues-modul', templateKey: 'csdc_pruefung_001' });
    expect(databaseTemplateHref).toContain('module=neues-modul');
    expect(databaseTemplateHref).toContain('templateKey=csdc_pruefung_001');
  });
  it('recognizes distinct workflows and bounds the suggestion count', () => {
    expect(documentWorkflowForArea('office', 'hr', 'offboarding')).toBe('employee_exit');
    expect(documentWorkflowForArea('assist', 'visit_complete')).toBe('service_proof');
    expect(documentWorkflowForArea('pflege', 'wounds')).toBe('wound');
    expect(getDocumentRecommendations({ workflow: 'client_contracts' }, 100)).toHaveLength(4);
  });
});
