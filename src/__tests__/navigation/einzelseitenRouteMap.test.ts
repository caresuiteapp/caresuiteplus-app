import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EINZELSEITEN_ROUTE_MAP,
  getEinzelseitenEntry,
  resolveEinzelseitenRoute,
} from '@/lib/navigation/einzelseitenRouteMap';

describe('einzelseitenRouteMap', () => {
  it('enthält alle 174 Einzelseiten-Prompts', () => {
    expect(EINZELSEITEN_ROUTE_MAP).toHaveLength(174);
  });

  it('mappt German Assist slugs auf canonical routes', () => {
    expect(resolveEinzelseitenRoute('/assist/einsaetze').target).toBe('/assist/assignments');
    expect(resolveEinzelseitenRoute('/assist/kalender').target).toBe('/assist/calendar');
    expect(resolveEinzelseitenRoute('/assist/durchfuehrung/[id]').target).toBe(
      '/assist/assignments/[id]/execute',
    );
  });

  it('mappt Klient:innen-Subtabs auf ClientRecord tab param', () => {
    const docs = resolveEinzelseitenRoute('/business/office/clients/[id]/documents');
    expect(docs.target).toBe('/business/office/clients/[id]');
    expect(docs.tab).toBe('dokumente');
  });

  it('mappt Business-Insight auf InsightCenter', () => {
    expect(resolveEinzelseitenRoute('/business/insight').target).toBe('/insight');
  });

  it('JSON-Map ist mit Prompt-Dateien synchron (174 Einträge)', () => {
    const raw = JSON.parse(
      readFileSync(
        join(process.cwd(), 'src/lib/navigation/einzelseiten-route-map.json'),
        'utf8',
      ),
    );
    expect(raw).toHaveLength(174);
    expect(getEinzelseitenEntry('0169')?.prompt).toBe('/business/insight');
  });
});
