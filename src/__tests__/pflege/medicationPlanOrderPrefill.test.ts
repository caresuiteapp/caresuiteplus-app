import { describe, expect, it } from 'vitest';
import { parseMedicationPlanPages } from '@/lib/pflege/medicationPlanImportDomain';
import { prepareMedicationPlanOrderPrefill } from '@/lib/pflege/medicationPlanOrderPrefill';

function review(medication: string, section = '') {
  const plan = parseMedicationPlanPages([
    `<MP v="028" U="1234567890ABCDEF1234567890ABCDEF" l="de-DE">
      <P g="Mara" f="Beispiel" b="19600101"/>
      <A n="Beispiel-Apotheke" t="2026-11-12T11:30:00"/>
      <S ${section}>${medication}</S>
    </MP>`,
  ]);
  return prepareMedicationPlanOrderPrefill(plan.rows[0]);
}

describe('Bestätigte BMP-Positionen im Medikationsformular', () => {
  it('kopiert Identifikationsangaben und lässt Dosis, Uhrzeiten, Gabeweg und Aussteller außerhalb der beschreibbaren Felder', () => {
    const result = review('<M p="12345" a="Testpräparat" fd="Tablette" m="1" v="1" du="1" r="Testgrund"><W w="Testwirkstoff" s="5 mg"/></M>', 'c="412"');
    expect(result).toMatchObject({
      fields: { name: 'Testpräparat', activeIngredient: 'Testwirkstoff', strength: '5 mg', form: 'Tablette', indication: 'Testgrund', notes: '' },
      expectedSchedule: { morning: 1, noon: 0, evening: 1, night: 0 },
      expectedDose: '1 Stück', scheduleStatus: 'manual',
    });
    expect(result?.fields).not.toHaveProperty('dosage');
    expect(result?.fields).not.toHaveProperty('schedule');
    expect(result?.fields).not.toHaveProperty('route');
    expect(result?.fields).not.toHaveProperty('prescribedBy');
    expect(result?.fields).not.toHaveProperty('productPzn');
    expect(result?.originalFields).toContainEqual({ label: 'PZN', value: '00012345' });
  });

  it('lässt bei einer PZN ohne Handelsnamen den Produktnamen offen und behält eine reine Wirkstoffverordnung als solche', () => {
    expect(review('<M p="12345" m="2" dud="mg"/>')).toMatchObject({ fields: { name: '' }, expectedDose: '2 mg' });
    expect(review('<M m="1" du="1"><W w="Wirkstoff A" s="5 mg"/><W w="Wirkstoff B" s="1 mg"/></M>')).toMatchObject({
      fields: { name: 'Wirkstoff A + Wirkstoff B', activeIngredient: 'Wirkstoff A + Wirkstoff B', strength: '' },
      originalFields: expect.arrayContaining([{ label: 'Wirkstoff und Stärke', value: 'Wirkstoff A · 5 mg\nWirkstoff B · 1 mg' }]),
    });
  });

  it.each([
    ['Wochentag', '<M a="Test" wo="2" m="1" du="1"/>', '', { label: 'Wöchentliche Position', value: 'Dienstag (BMP-Code 2)' }],
    ['Bedarf', '<M a="Test" m="1" du="1"/>', 'c="411"', { label: 'Abschnitt (BMP-Code)', value: '411' }],
    ['Befristung', '<M a="Test" m="1" du="1"/>', 'c="424"', { label: 'Abschnitt (BMP-Code)', value: '424' }],
    ['besondere Zeiten', '<M a="Test" m="1" du="1"/>', 'c="423"', { label: 'Abschnitt (BMP-Code)', value: '423' }],
    ['freie Überschrift', '<M a="Test" m="1" du="1"/>', 't="Individuell"', { label: 'Abschnitt', value: 'Individuell' }],
    ['freie Dosierung', '<M a="Test" t="Nur sonntags" du="1"/>', '', { label: 'Dosierung im Freitext', value: 'Nur sonntags' }],
    ['Einnahmehinweis', '<M a="Test" m="1" du="1" i="Nur jeden zweiten Tag"/>', '', { label: 'Hinweise zur Einnahme', value: 'Nur jeden zweiten Tag' }],
    ['Zusatztext', '<M a="Test" m="1" du="1" x="Ende am Freitag"/>', '', { label: 'Zusatztext', value: 'Ende am Freitag' }],
    ['Bruch', '<M a="Test" m="1/2" du="1"/>', '', { label: 'Morgens', value: '1/2' }],
    ['Dezimalzahl', '<M a="Test" m="1,5" du="1"/>', '', { label: 'Morgens', value: '1,5' }],
    ['abweichende Einzelmengen', '<M a="Test" m="1" v="2" du="1"/>', '', { label: 'Abends', value: '2' }],
    ['fehlende Dosiereinheit', '<M a="Test" m="1"/>', '', { label: 'Morgens', value: '1' }],
    ['unbekannte Dosiereinheit', '<M a="Test" m="1" du="P"/>', '', { label: 'Einheit (BMP-Code)', value: 'P' }],
    ['E ist kein IE', '<M a="Test" m="1" du="9"/>', '', { label: 'Einheit (BMP-Code)', value: '9' }],
    ['keine positive Gabe', '<M a="Test" m="0" du="1"/>', '', { label: 'Morgens', value: '0' }],
  ])('lässt %s als Original stehen und bietet keine umgedeutete Dosis an', (_case, medication, section, field) => {
    const result = review(medication, section);
    expect(result?.scheduleStatus).toBe('unsupported');
    expect(result?.originalFields).toContainEqual(field);
    expect(result).not.toHaveProperty('expectedDose');
    expect(result).not.toHaveProperty('expectedSchedule');
  });

  it('bietet weder Rezepturtexte noch Planhinweise als Arzneimittel zum Anlegen an', () => {
    expect(review('<R t="Testrezeptur"/>')).toBeNull();
    expect(review('<X t="Nur ein Hinweis"/><M a="Test" m="1" du="1"/>')).toBeNull();
  });
});
