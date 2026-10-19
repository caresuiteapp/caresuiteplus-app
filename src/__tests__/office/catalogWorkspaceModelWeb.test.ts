import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import {
  buildCatalogWorkspace, catalogBusinessDate, formatCatalogDate, formatWorkspaceCatalogPrice,
  isCatalogDate, resolveCatalogPrice, type CatalogWorkspacePrice, type CatalogWorkspaceRow,
} from '@/lib/catalog/catalogWorkspaceModel.web';

const position = (patch: Partial<CatalogWorkspaceRow> = {}): CatalogWorkspaceRow => ({
  id: 'item-1', module_key: 'assist', service_key: 'assist.alltag', name: 'Alltagsbegleitung',
  description: 'Begleitung im Alltag', unit: 'hour', category: 'service', is_active: true, sort_order: 10,
  created_at: '2026-01-02T10:00:00Z', updated_at: '2026-10-18T10:00:00Z', ...patch,
});
const price = (patch: Partial<CatalogWorkspacePrice> = {}): CatalogWorkspacePrice => ({
  id: 'price-1', catalog_id: 'item-1', price_net: 38, tax_mode: 'exempt_4_16', valid_from: '2026-01-01', valid_to: null, ...patch,
});
const today = '2026-10-19';

describe('Office-Kataloge: Preise und Übersicht', () => {
  it('zeigt einen zukünftigen Preis getrennt vom heute gültigen Tarif', () => {
    const snapshot = buildCatalogWorkspace([position()], [price(), price({ id: 'future', price_net: 45, valid_from: '2027-01-01' })], ['assist'], true, today);
    const item = snapshot.catalogs[0].items[0];
    assert.equal(item.priceNet, 38);
    assert.equal(item.priceCents, 3800);
    assert.equal(item.nextPriceNet, 45);
    assert.equal(item.nextValidFrom, '2027-01-01');
    assert.equal(item.priceState, 'current');
  });

  it('meldet ausschließlich zukünftige Preise als derzeit fehlend', () => {
    const snapshot = buildCatalogWorkspace([position()], [price({ valid_from: '2026-11-01' })], ['assist'], true, today);
    const item = snapshot.catalogs[0].items[0];
    assert.equal(item.priceNet, null);
    assert.equal(item.priceState, 'future');
    assert.equal(item.nextPriceNet, 38);
    assert.equal(snapshot.catalogs[0].missingPriceCount, 1);
  });

  it('verwendet abgelaufene Tarife nicht für den aktuellen Preis', () => {
    const result = buildCatalogWorkspace([position()], [price({ valid_to: '2026-10-18' })], ['assist'], false, today);
    assert.equal(result.catalogs[0].items[0].priceNet, null);
    assert.equal(result.catalogs[0].items[0].priceState, 'expired');
    assert.equal(result.catalogs[0].items[0].validUntil, '2026-10-18');
  });

  it('behandelt Gültigkeitsbeginn und -ende einschließlich des jeweiligen Tags', () => {
    assert.equal(resolveCatalogPrice([price({ valid_from: today, valid_to: today })], today).state, 'current');
  });

  it('wählt den jüngsten wirksamen Tarif unabhängig von der Serverreihenfolge', () => {
    const old = price({ id: 'old' }), current = price({ id: 'current', price_net: 42, valid_from: today });
    assert.equal(resolveCatalogPrice([old, current], today).current?.price_net, 42);
    assert.equal(resolveCatalogPrice([current, old], today).current?.price_net, 42);
  });

  it('zählt einen ausdrücklich kostenlosen Tarif als vollständig gepflegt', () => {
    const result = buildCatalogWorkspace([position()], [price({ price_net: 0 })], ['assist'], true, today);
    assert.equal(result.catalogs[0].missingPriceCount, 0);
    assert.equal(formatWorkspaceCatalogPrice(result.catalogs[0].items[0]), '0,00 €');
  });

  it('formatiert Prozentzuschläge niemals als Euro oder Centbetrag', () => {
    const result = buildCatalogWorkspace([position({ unit: 'percent', category: 'surcharge' })], [price({ price_net: 25, tax_mode: 'none' })], ['assist'], true, today);
    const item = result.catalogs[0].items[0];
    assert.equal(formatWorkspaceCatalogPrice(item), '25,00 %');
    assert.equal(item.priceCents, null);
    assert.equal(item.unit, 'Prozent');
  });

  it('zählt deaktivierte Positionen getrennt, ohne sie als offene Preise auszugeben', () => {
    const result = buildCatalogWorkspace([position(), position({ id: 'inactive', is_active: false })], [price()], ['assist'], true, today);
    const catalog = result.catalogs[0];
    assert.deepEqual([catalog.itemCount, catalog.activeCount, catalog.inactiveCount, catalog.missingPriceCount], [2, 1, 1, 0]);
    assert.equal(catalog.status, 'aktiv');
  });

  it('bezeichnet einen vollständig deaktivierten Katalog nicht als Entwurf', () => {
    const result = buildCatalogWorkspace([position({ is_active: false })], [], ['assist'], false, today);
    assert.equal(result.catalogs[0].status, 'inaktiv');
    assert.equal(result.catalogs[0].items[0].status, 'inaktiv');
  });

  it('bietet leere freigegebene Kataloge an, ohne Positionen oder Nutzungszahlen zu erfinden', () => {
    const result = buildCatalogWorkspace([], [], ['assist'], true, today);
    assert.equal(result.catalogs[0].id, 'tenant-service:assist');
    assert.equal(result.catalogs[0].itemCount, 0);
    assert.equal(result.catalogs[0].updatedAt, null);
    assert.equal('usageCount' in result.catalogs[0], false);
    assert.deepEqual(result.catalogs[0].items, []);
  });

  it('schließt gesperrte und nicht aktivierte Fachmodule aus', () => {
    const all = [position(), position({ id: 'pflege', module_key: 'pflege' })];
    assert.deepEqual(buildCatalogWorkspace(all, [], ['assist', 'pflege', 'stationaer', 'beratung'], true, today).catalogs.map(catalog => catalog.moduleKey), ['assist']);
    assert.deepEqual(buildCatalogWorkspace(all, [], [], true, today).catalogs, []);
  });

  it('berechnet das Datum in Deutschland auch nach UTC-Tageswechsel und Zeitumstellung', () => {
    assert.equal(catalogBusinessDate(new Date('2026-10-18T22:30:00Z')), '2026-10-19');
    assert.equal(catalogBusinessDate(new Date('2026-12-31T23:30:00Z')), '2027-01-01');
    assert.equal(catalogBusinessDate(new Date('2026-03-29T00:30:00Z')), '2026-03-29');
  });

  it('prüft echte Kalenderdaten und formatiert ungültige Werte sicher', () => {
    assert.equal(isCatalogDate('2026-02-30'), false);
    assert.equal(isCatalogDate('2028-02-29'), true);
    assert.equal(formatCatalogDate('2026-10-19'), '19.10.2026');
    assert.equal(formatCatalogDate('2026-02-30'), '—');
    assert.equal(formatCatalogDate('not-a-date'), '—');
    assert.equal(formatWorkspaceCatalogPrice({ priceNet: NaN, unitKey: 'hour' }), 'Kein gültiger Preis');
  });
});
