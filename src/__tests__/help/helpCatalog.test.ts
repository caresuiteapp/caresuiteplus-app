import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { HELP_ARTICLES, HELP_CATEGORIES, HELP_JOURNEYS } from '@/features/help/helpCatalog';
import { normalizeHelpText, searchHelpArticles } from '@/features/help/helpSearch';
import { contextualHelpArticle, helpHref } from '@/features/help/helpNavigation';
import { platformRuntimeBlock, PLATFORM_RUNTIME_RELEASE } from '@/lib/platformConsole/platformRuntimePolicy';
import webRoutes from '@/lib/navigation/webRoutePatterns.json';

describe('help article references and destinations', () => {
  it('keeps every published article complete, uniquely addressable and linked to actual app routes', () => {
    const ids = new Set(HELP_ARTICLES.map(article => article.id));
    expect(ids.size).toBe(HELP_ARTICLES.length);
    for (const article of HELP_ARTICLES) {
      expect(HELP_CATEGORIES.some(category => category.id === article.category), article.id).toBe(true);
      expect(article.steps.length, article.id).toBeGreaterThanOrEqual(4);
      expect(article.example.text.length, article.id).toBeGreaterThan(40);
      expect(article.checks.length, article.id).toBeGreaterThan(0);
      if (article.route) expect(webRoutes, `${article.id}: ${article.route}`).toContain(article.route);
      for (const related of article.related) expect(ids.has(related), `${article.id}: ${related}`).toBe(true);
      for (const source of article.sources) expect(existsSync(resolve(source)), `${article.id}: ${source}`).toBe(true);
    }
    for (const journey of HELP_JOURNEYS) for (const article of journey.articles) expect(ids.has(article)).toBe(true);
    for (const category of HELP_CATEGORIES) expect(HELP_ARTICLES.some(article => article.category === category.id)).toBe(true);
  });
});
describe('help search', () => {
  it('ranks a real task above incidental mentions and supports German transliteration', () => {
    expect(searchHelpArticles({ q: 'Logo hochladen' })[0]?.id).toBe('dokument-logo');
    expect(normalizeHelpText('Verfügbarkeit ÄÖÜ ß')).toBe(normalizeHelpText('Verfuegbarkeit AeOeUe ss'));
    expect(searchHelpArticles({ q: 'Verfuegbarkeiten' }).some(article => article.id === 'kalender-verfuegbarkeit')).toBe(true);
    expect(searchHelpArticles({ q: 'signatur' }).some(article => article.id === 'unterschrift-vor-ort')).toBe(true);
  });
  it('searches detailed instructions and combines all filters', () => {
    expect(searchHelpArticles({ q: '24:00', category: 'planung' }).map(article => article.id)).toContain('kalender-import');
    const employee = searchHelpArticles({ audience: 'mitarbeitende', category: 'einsatz' });
    expect(employee.length).toBeGreaterThan(0);
    expect(employee.every(article => article.audiences.includes('mitarbeitende') && article.category === 'einsatz')).toBe(true);
    expect(searchHelpArticles({ q: 'nichtexistierendeswort' })).toEqual([]);
    expect(searchHelpArticles({ q: '   ' })).toHaveLength(HELP_ARTICLES.length);
  });
});
describe('contextual help', () => {
  it('keeps the read-only manual available during maintenance without opening any business page', () => {
    const snapshot = { status: 'ready' as const, checkedAt: null, settings: { release: PLATFORM_RUNTIME_RELEASE, maintenanceMode: true, registrationEnabled: false, notice: '' } };
    expect(platformRuntimeBlock('/hilfe?artikel=zugang-wiederherstellen', snapshot)).toBeNull();
    expect(platformRuntimeBlock('/business/office/clients', snapshot)).toBe('maintenance');
    expect(platformRuntimeBlock('/hilfe/unknown', snapshot)).toBe('maintenance');
  });
  it('passes only the matched topic and never an actual record or query', () => {
    expect(helpHref('/business/office/clients/secret-id?name=private')).toBe('/hilfe?artikel=klienten-akte');
    expect(helpHref('/business/templates/ci-layout')).toBe('/hilfe?artikel=dokument-logo');
    expect(helpHref('/')).toBe('/hilfe');
    expect(helpHref('/hilfe?artikel=foo')).toBe('/hilfe');
    expect(contextualHelpArticle('/assist/kalender')).toBe('kalender-verfuegbarkeit');
  });
});
