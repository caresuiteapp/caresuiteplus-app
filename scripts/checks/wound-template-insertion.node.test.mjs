import assert from 'node:assert/strict';
import test from 'node:test';
import { appendWoundTemplates, EMPTY_WOUND_CATALOG_ITEM, mergeWoundCatalogItems } from '../../src/lib/pflege/woundRecordDomain.ts';

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
  assert.deepEqual(mergeWoundCatalogItems([custom], 'description').filter(item => item.name === custom.name), [custom]);
  assert.ok(mergeWoundCatalogItems([custom], 'treatment').some(item => item.name === 'Versorgung und Reaktion'));
});
