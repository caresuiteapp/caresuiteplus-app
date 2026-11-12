import { describe, expect, it } from 'vitest';
import { medicationPlanOriginalFields, medicationPlanPositionTitle, parseMedicationPlanPages, sameMedicationPlanDraft } from '@/lib/pflege/medicationPlanImportDomain';

const id = 'A123456789ABCDEFA123456789ABCDEF';
const header = '<P g="Testperson" f="Muster" b="19800316"/><A n="Testpraxis" t="2026-08-10T12:00:00"/>';
const standard = '<S><M p="12456" a="Testpräparat" f="Tabl" m="0" v="1/4" du="1" i="Beispielhinweis" r="Testgrund" x="Zusatz"><W w="Testwirkstoff" s="5 mg"/></M></S>';
const xml = (content = standard, version = '028', attrs = 'l="de-DE"', identity = header) =>
  `<MP U="${id}" v="${version}" ${attrs}>${identity}${content}</MP>`;

describe('Bundeseinheitlicher Medikationsplan als Prüfentwurf', () => {
  it('erhält Brüche, ausdrücklich genannte Nullen und fehlende Tageszeiten getrennt', () => {
    const draft = parseMedicationPlanPages([xml()]);
    expect(draft.patient.birthDate).toBe('1980-03-16');
    expect(draft.rows[0]).toMatchObject({ pzn: '00012456', morning: '0', noon: null, evening: '1/4', night: null,
      formCode: 'Tabl', doseText: null, unitCode: '1', instructions: 'Beispielhinweis', indication: 'Testgrund',
      source: { attributes: { p: '12456', m: '0', v: '1/4' } } });
    expect(medicationPlanOriginalFields(draft.rows[0])).toContainEqual({ label: 'Morgens', value: '0' });
    expect(medicationPlanOriginalFields(draft.rows[0]).some(field => field.label === 'Mittags')).toBe(false);
  });

  it('ordnet einen Wochentag niemals als tägliche Dosis ein und hält Notiz und Rezeptur getrennt', () => {
    const draft = parseMedicationPlanPages([xml('<S c="425"><M p="7654321" wo="2" m="1" du="1"/><R t="Testrezeptur" x="Rezepturhinweis"/><X t="Planhinweis"/></S>')]);
    expect(draft.rows[0]).toMatchObject({ weekdayCode: '2', morning: '1', section: { code: '425' } });
    expect(medicationPlanOriginalFields(draft.rows[0])).toContainEqual({ label: 'Wöchentliche Position', value: 'Dienstag (BMP-Code 2)' });
    expect(medicationPlanPositionTitle(draft.rows[0])).toBe('PZN 07654321');
    expect(draft.rows[1]).toMatchObject({ kind: 'formulation', doseText: null, additionalText: 'Testrezeptur' });
    expect(medicationPlanOriginalFields(draft.rows[1])).toContainEqual({ label: 'Rezepturzusatz', value: 'Rezepturhinweis' });
    expect(draft.rows[2]).toMatchObject({ kind: 'note', additionalText: 'Planhinweis' });
  });

  it('liest die gemeinsamen Felder älterer Versionen, bewahrt die Patchnummer und lehnt Wochentage dort ab', () => {
    for (const version of ['026', '027']) {
      expect(parseMedicationPlanPages([xml(standard, version, 'p="1"')])).toMatchObject({
        version, rows: [{ evening: '1/4', weekdayCode: null }], headers: [{ root: { p: '1' } }],
      });
      expect(() => parseMedicationPlanPages([xml('<S><M p="7654321" wo="2" m="1"/></S>', version)])).toThrow('Wochentag');
    }
    expect(() => parseMedicationPlanPages([xml(standard, '029')])).toThrow();
  });

  it('übernimmt mehrseitige Pläne erst nach eindeutiger Vollständigkeitsprüfung', () => {
    const first = xml(standard, '028', 'l="de-DE" a="1" z="2"');
    const second = xml('<S><M p="54321" t="nach schriftlicher Anweisung"/></S>', '028', 'l="de-DE" a="2" z="2"');
    expect(parseMedicationPlanPages([second, first]).rows.map(row => row.page)).toEqual([1, 2]);
    for (const invalid of [[first], [first, first], [first, second.replace('Muster', 'Andere')], [first, second.replace(id, 'B'.repeat(32))]]) {
      expect(() => parseMedicationPlanPages(invalid)).toThrow('vollständigen Plan');
    }
  });

  it('liefert kein vollständiges Datum aus Platzhaltern und akzeptiert keine widersprüchliche Dosierung', () => {
    expect(parseMedicationPlanPages([xml(standard, '028', 'l="de-DE"', header.replace('19800316', '19800000'))]).patient).toMatchObject({
      birthDate: null, rawBirthDate: '19800000',
    });
    expect(() => parseMedicationPlanPages([xml('<S><M p="1234" t="Test" m="1"/></S>')])).toThrow('widersprüchliche');
    expect(() => parseMedicationPlanPages([xml(standard, '028', 'l="de-DE"', header.replace('19800316', '19800230'))])).toThrow();
    expect(() => parseMedicationPlanPages([xml('<S><M p="1234" wo="0"/></S>')])).toThrow();
    expect(() => parseMedicationPlanPages([xml('<S><M p="1234" wo="2"/></S>')])).toThrow('Tageszeit-Dosis');
  });

  it('weist fremde XML-Strukturen und DTDs zurück', () => {
    expect(() => parseMedicationPlanPages([`<!DOCTYPE MP [<!ENTITY a SYSTEM "file:///kein-import">]>${xml()}`])).toThrow();
    expect(() => parseMedicationPlanPages([xml('<S><Y t="Unbekannt"/></S>')])).toThrow();
    expect(() => parseMedicationPlanPages([xml(standard, '028', 'l="de-DE" xmlns="urn:fremd"')])).toThrow();
  });

  it('bestätigt den gesamten gespeicherten Plan trotz geänderter JSON-Schlüsselreihenfolge', () => {
    const draft = parseMedicationPlanPages([xml()]);
    const reordered = Object.fromEntries(Object.entries(draft).reverse()) as typeof draft;
    expect(sameMedicationPlanDraft(draft, reordered)).toBe(true);
    expect(sameMedicationPlanDraft(draft, { ...draft, rows: [{ ...draft.rows[0], evening: '1/2' }] })).toBe(false);
  });
});
