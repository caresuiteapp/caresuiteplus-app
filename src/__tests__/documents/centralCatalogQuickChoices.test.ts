import { describe, expect, it, vi } from 'vitest';
import { CENTRAL_DOCUMENT_CATALOG } from '@/data/seeds/documentCatalog/centralCatalog';
import { applyCentralQuickChoice, centralAdditionalQuickChoices, centralFieldQuickChoices, centralSectionQuickChoices, centralTableQuickChoices } from '@/lib/documents/centralCatalogQuickChoices';
import { createCentralSnapshot } from '@/lib/documents/centralCatalogModel';
import type { CentralDocumentContext } from '@/types/documents/centralCatalog';

const now = new Date('2026-10-14T12:00:00Z');
const context = (target: CentralDocumentContext['target']): CentralDocumentContext => ({
  tenantId: 'tenant-a', target, entityId: 'entity-a',
  company: { name: 'Unternehmen A', address: 'Parkstraße 1\n10115 Berlin', representativeName: 'Vertretung A' },
  subject: { name: 'Person A', address: 'Musterstraße 2\n10117 Berlin', birthDate: '1950-01-02', careLevel: '3', insuranceNumber: 'ECHTE-NUMMER', personnelNumber: 'PERSONAL-A', jobTitle: 'Pflegefachkraft', serviceStart: '2026-08-01' },
  representative: { name: 'Vertretung B', address: 'Beispielstraße 3\n10117 Berlin' }, payor: { name: 'Kostenträger A' },
  employee: { name: 'Fachkraft A', qualification: 'Gespeicherte Qualifikation' }, procedure: { period: '01.10.2026 – 31.10.2026' }, sourceFetchedAt: now.toISOString(),
});
const snapshot = (key: string) => createCentralSnapshot(CENTRAL_DOCUMENT_CATALOG.find((definition) => definition.key === key)!, context('client'), 'Verantwortung A', 'document-a');

describe('quick choices for every catalogue input', () => {
  it('provides choices throughout the catalogue while requiring explicit facts for the new legal edition', () => {
    let fields = 0, sections = 0, columns = 0, additional = 0;
    const missing: string[] = [];
    for (const definition of CENTRAL_DOCUMENT_CATALOG) {
      const current = createCentralSnapshot(definition, context(definition.target), 'Verantwortung A', 'document-a');
      for (const field of definition.fields) {
        fields++;
        if (definition.edition === '2027' && field.key.startsWith('legal_')) {
          // Concrete prices, named recipients and individual consent decisions
          // must not be fabricated just to offer a one-click default.
          expect(field.required).toBe(true); expect(field.defaultValue).toBeUndefined();
          expect(current.values[field.key]).toBe('');
        } else if (!centralFieldQuickChoices(current, field, 'Verantwortung A', now).some((item) => item.value && !item.unavailable)) missing.push(`${definition.key}:field:${field.label}`);
      }
      for (const section of definition.sections) { sections++; if (!centralSectionQuickChoices(current, section).some((item) => item.value && !item.unavailable)) missing.push(`${definition.key}:section:${section.heading}`); }
      for (const column of definition.columns) { columns++; if (!centralTableQuickChoices(current, column, 0, 'Verantwortung A', now).some((item) => item.value && !item.unavailable)) missing.push(`${definition.key}:column:${column}`); }
      additional++; if (!centralAdditionalQuickChoices(current).some((item) => item.value && !item.unavailable)) missing.push(`${definition.key}:additional`);
    }
    expect(missing).toEqual([]);
    expect(CENTRAL_DOCUMENT_CATALOG).toHaveLength(450);
    expect({ fields, sections, columns, additional }).toEqual({ fields: 5946, sections: 611, columns: 763, additional: 450 });
  });

  it('offers admission resources and contract terms appropriate to the pictured fields', () => {
    const admission = snapshot('csdc_aufnahme_002');
    const resources = admission.definition.fields.find((field) => field.label === 'Unterstützungsbedarf und vorhandene Ressourcen')!;
    expect(centralFieldQuickChoices(admission, resources, 'A', now).map((item) => item.label)).toContain('Hauswirtschaft');
    const contract = CENTRAL_DOCUMENT_CATALOG.find((definition) => definition.fields.some((field) => field.label === 'Vergütung, Eigenanteile und Abrechnungsverfahren'))!;
    const current = createCentralSnapshot(contract, context(contract.target), 'A', 'document-a');
    const costs = contract.fields.find((field) => field.label === 'Vergütung, Eigenanteile und Abrechnungsverfahren')!;
    expect(centralFieldQuickChoices(current, costs, 'A', now).map((item) => item.value).join(' ')).toContain('vereinbarten Leistungsverzeichnis');
    expect(centralFieldQuickChoices(current, costs, 'A', now).map((item) => item.value).join(' ')).not.toMatch(/32,75|48 Stunden|14 Tage/);
  });

  it('combines selected blocks without losing manual text or inserting duplicates', () => {
    const current = snapshot('csdc_aufnahme_002');
    const field = current.definition.fields.find((item) => item.label === 'Unterstützungsbedarf und vorhandene Ressourcen')!;
    const [first, second] = centralFieldQuickChoices(current, field, 'A', now);
    const combined = applyCentralQuickChoice(applyCentralQuickChoice('Eigene genaue Beobachtung.', first), second);
    expect(combined).toBe(`Eigene genaue Beobachtung.\n\n${first.value}\n\n${second.value}`);
    expect(applyCentralQuickChoice(combined, first)).toBe(combined);
    expect(applyCentralQuickChoice(combined, second, false)).toBe(second.value);
  });

  it('uses only the assigned record for identifying data and leaves missing facts unavailable', () => {
    const current = snapshot('csdc_aufnahme_002');
    current.context.subject.insuranceNumber = '';
    const field = current.definition.fields.find((item) => item.key === 'insuranceNumber')!;
    const choices = centralFieldQuickChoices(current, field, 'A', now);
    expect(choices.every((item) => item.unavailable && !item.value)).toBe(true);
    expect(applyCentralQuickChoice('Manuell eingegebene Nummer', choices[0])).toBe('Manuell eingegebene Nummer');
    current.context.subject.insuranceNumber = 'AKTE-A-NUMMER';
    expect(centralFieldQuickChoices(current, field, 'A', now).map((item) => item.value)).toEqual(['AKTE-A-NUMMER']);
  });

  it('keeps employment, software and consent sections separate from service contracts', () => {
    const employment = CENTRAL_DOCUMENT_CATALOG.find((item) => /Arbeitsvertrag/.test(item.title))!;
    const current = createCentralSnapshot(employment, context('employee'), 'A', 'document-a');
    const section = employment.sections.find((item) => /Vergütung/.test(item.heading))!;
    expect(centralSectionQuickChoices(current, section).map((item) => item.value).join(' ')).not.toContain('Kostenträger');
    const software = snapshot('csdc_software_001');
    const costSection = software.definition.sections.find((item) => /Kostenloser/.test(item.heading))!;
    expect(centralSectionQuickChoices(software, costSection).map((item) => item.value).join(' ')).toContain('keine automatische Zahlungspflicht');
    const consentDefinition = CENTRAL_DOCUMENT_CATALOG.find((item) => item.sections.some((section) => section.key === 'withdrawal'))!;
    const consent = createCentralSnapshot(consentDefinition, context(consentDefinition.target), 'A', 'document-a');
    const withdrawal = consentDefinition.sections.find((item) => item.key === 'withdrawal')!;
    expect(centralSectionQuickChoices(consent, withdrawal).map((item) => item.value).join(' ')).not.toContain('Absagefristen');
  });

  it('keeps measured quantities while selecting units and does not generate clinical values', () => {
    const definition = CENTRAL_DOCUMENT_CATALOG.find((item) => item.columns.includes('Dosis / Einheit'))!;
    const current = createCentralSnapshot(definition, context(definition.target), 'A', 'document-a');
    const choices = centralTableQuickChoices(current, 'Dosis / Einheit', 0, 'A', now).filter((item) => !item.unavailable);
    const milligrams = choices.find((item) => item.value === 'mg')!;
    expect(applyCentralQuickChoice('2,5 ml', milligrams)).toBe('2,5 mg');
    expect(applyCentralQuickChoice('', milligrams)).toBe('mg');
    expect(applyCentralQuickChoice('2 – manuelle Besonderheit', milligrams)).toBe('2 – manuelle Besonderheit\nmg');
    expect(choices.every((item) => !/\d/.test(item.value))).toBe(true);
  });

  it('offers dates in Berlin time without proposing a fictional birth date', () => {
    const current = snapshot('csdc_aufnahme_002');
    const date = current.definition.fields.find((item) => item.key === 'date')!;
    const birthDate = current.definition.fields.find((item) => item.key === 'birthDate')!;
    expect(centralFieldQuickChoices(current, date, 'A', new Date('2026-10-14T22:30:00Z'))[0].value).toBe('2026-10-15');
    expect(centralFieldQuickChoices(current, birthDate, 'A', now).map((item) => item.value)).toEqual(['1950-01-02']);
  });

  it('resolves today again when an editor stays open across midnight', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-14T20:00:00Z'));
      const current = snapshot('csdc_aufnahme_002');
      const date = current.definition.fields.find((item) => item.key === 'date')!;
      const today = centralFieldQuickChoices(current, date, 'A').find((item) => item.label === 'Heute')!;
      expect(today.value).toBe('2026-10-14');
      vi.setSystemTime(new Date('2026-10-14T22:30:00Z'));
      expect(today.resolveValue!()).toBe('2026-10-15');
    } finally { vi.useRealTimers(); }
  });

  it('does not restore a different original row after manual table changes', () => {
    const current = snapshot('csdc_aufnahme_002');
    current.context.sourceRows = [['Datum A', 'Gegenstand A'], ['Datum B', 'Gegenstand B']];
    current.tableRows = [['Datum B', 'Gegenstand B']]; current.tableOrigin = 'manual';
    const stored = centralTableQuickChoices(current, 'Gegenstand / Maßnahme', 0, 'A', now).find((item) => item.key === 'stored-cell')!;
    expect(stored.unavailable).toBeTruthy(); expect(stored.value).toBe('');
  });
});
