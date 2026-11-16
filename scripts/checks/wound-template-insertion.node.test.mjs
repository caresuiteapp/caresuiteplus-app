import assert from 'node:assert/strict';
import test from 'node:test';
import { appendWoundTemplates, EMPTY_WOUND_CATALOG_ITEM, mergeWoundCatalogItems } from '../../src/lib/pflege/woundRecordDomain.ts';
import { DEFAULT_WOUND_SNIPPETS, WOUND_TEMPLATE_FIELDS, readWoundTemplateCode, woundTemplateCode, woundTemplateMatches } from '../../src/lib/pflege/woundTemplates.ts';
import { initialWoundTab, woundCaseRoute } from '../../src/components/pflege/wounds/woundAreas.ts';
import { bodyMapMessage, readBodyMark } from '../../src/components/clinicalMedia/WoundBodyMapFrame.types.ts';

test('Mehrere Textbausteine bleiben in Auswahlreihenfolge und erhalten den vorhandenen Text', () => {
  const original = 'Vorhandener Freitext.\nEigene zweite Zeile.';
  assert.equal(appendWoundTemplates(original, ['  Zweite Auswahl  ', 'Erste Auswahl', ' \n '], true),
    original + '\n\nZweite Auswahl\n\nErste Auswahl');
  assert.equal(appendWoundTemplates(original, [], true), original);
  assert.equal(appendWoundTemplates('Vorhanden', ['Text\nmit Umbruch', 'Nächster Text'], false),
    'Vorhanden · Text mit Umbruch · Nächster Text');
});

test('Eigene Vorlage ersetzt dieselbe Standardvorlage innerhalb ihrer Kategorie', () => {
  const custom = { ...EMPTY_WOUND_CATALOG_ITEM, id: 'own', name: 'Wundbett und Wundrand', kind: 'description',
    text: 'Eigene Fassung.', updated_at: '2026-11-15T12:00:00Z' };
  const matches = mergeWoundCatalogItems([custom], 'description').filter(item => item.name === custom.name);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].id, custom.id);
  assert.equal(matches[0].text, custom.text);
  assert.equal(readWoundTemplateCode(matches[0].code).field, 'description');
  assert.ok(mergeWoundCatalogItems([custom], 'treatment').some(item => item.name === 'Versorgung und Reaktion'));
});

test('Ein umbenannter Baustein ersetzt den Standard und behält seine ausgewählte Feldzuordnung', () => {
  const standard = DEFAULT_WOUND_SNIPPETS.find(item => item.id === 'exudate-serous');
  const custom = { ...EMPTY_WOUND_CATALOG_ITEM, id: 'own', kind: standard.kind, name: 'Eigene Kurzfassung',
    text: 'Klares Sekret sichtbar.', code: woundTemplateCode('description', standard.id), updated_at: '2026-11-16T12:00:00Z' };
  const merged = mergeWoundCatalogItems([custom], 'description');
  assert.ok(!merged.some(item => item.id === standard.id));
  assert.deepEqual(merged.find(item => item.id === custom.id), custom);
  assert.equal(readWoundTemplateCode(merged[0].code).field, 'description');
});

test('Alle Vorlagenfelder bieten Alternativen und eindeutige Katalogkennzeichen', () => {
  assert.equal(new Set(DEFAULT_WOUND_SNIPPETS.map(item => item.id)).size, DEFAULT_WOUND_SNIPPETS.length);
  assert.ok(Object.values(WOUND_TEMPLATE_FIELDS).every(field => field.snippets.length >= 4));
  assert.ok(DEFAULT_WOUND_SNIPPETS.every(item => woundTemplateCode(item.field, item.id).length <= 80));
  assert.equal(woundTemplateMatches(['Fußbefund', 'Druckabdruck sichtbar'], 'druckabdruck fuss'), true);
  assert.equal(woundTemplateMatches(['Fußbefund', 'Druckabdruck sichtbar'], 'druckabdruck exsudat'), false);
});

test('Wundfotos lassen sich als Bereich öffnen, unbekannte Bereiche landen im Verlauf', () => {
  const route = woundCaseRoute('wund-id', 'measurement');
  assert.equal(initialWoundTab(new URL(route, 'https://example.invalid').searchParams.get('bereich')), 'measurement');
  assert.equal(initialWoundTab(['measurement', 'export']), 'overview');
});

test('Die 3D-Vollbildnachricht akzeptiert eine gültige Figur und weist fremde Ansichten ab', () => {
  const view = { figure: 'adult-woman', region: 'foot', side: 'left', cameraView: 'front', detailAngle: 1 };
  assert.deepEqual(bodyMapMessage({ type: 'caresuite-body-expand', open: true, view }), { type: 'expand', open: true, view });
  assert.equal(bodyMapMessage({ type: 'caresuite-body-expand', open: true, view: { ...view, cameraView: 'foreign' } }), null);
});

test('Eine erweiterte Markierung behält ihre bisherige Grundkategorie beim Speichern', () => {
  const mark = { name: 'Unterarm', kind: 'Hautbefund', finding: 'Hämatom', text: '',
    figure: 'adult-woman', focusRegion: 'arm', side: 'left', point: [0, 0, 1], target: [0, 0, 1],
    yaw: 0, pitch: 0, height: .5 };
  assert.equal(readBodyMark(mark)?.kind, 'Hautbefund');
  assert.equal(readBodyMark(mark)?.finding, 'Hämatom');
  assert.equal(readBodyMark({ ...mark, finding: 'unbekannt' })?.finding, undefined);
});
