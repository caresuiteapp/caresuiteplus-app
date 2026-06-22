import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  matchesSearchQuery,
  normalizeSearchQuery,
  searchMatchScore,
  sortBySearchRelevance,
} from '@/lib/search/tenantSearchMatch';
import {
  buildTenantSearchHistoryStorageKey,
  parseSearchHistoryPayload,
  pushSearchHistoryEntry,
  TENANT_SEARCH_HISTORY_MAX_ENTRIES,
} from '@/lib/search/tenantSearchHistory';
import { supportsNativeSearchHistoryLongPress } from '@/lib/search/platformSearchHistoryTrigger';
import { resolveTenantSearchHref } from '@/lib/search/tenantSearchRoutes';
import { resolveActiveTenantSearchModules, searchTenant } from '@/lib/search/tenantSearchService';
import * as clientListService from '@/lib/office/clientListService';
import {
  activatePurchasedModule,
  initializeModuleAccessStore,
  resetModuleAccessStore,
} from '@/lib/modules/moduleAccessService';
import {
  resetTenantModuleSettingsCache,
  setTenantModuleSettingsCache,
} from '@/lib/tenant/tenantModuleSettingsCache';
import { syncModuleAccessFromTenantSettings } from '@/lib/tenant/syncTenantModuleAccess';
import { DEFAULT_TENANT_MODULES } from '@/types/tenant/tenantCenter';
import { DEMO_TENANT_ID } from '@/data/constants/testTenant';

function seedSearchTestTenant(
  modules = DEFAULT_TENANT_MODULES,
) {
  resetModuleAccessStore();
  resetTenantModuleSettingsCache();
  initializeModuleAccessStore(DEMO_TENANT_ID);
  activatePurchasedModule(DEMO_TENANT_ID, 'office');
  activatePurchasedModule(DEMO_TENANT_ID, 'assist');
  activatePurchasedModule(DEMO_TENANT_ID, 'pflege');
  setTenantModuleSettingsCache(DEMO_TENANT_ID, modules);
  syncModuleAccessFromTenantSettings(DEMO_TENANT_ID, modules);
}

describe('tenantSearchMatch', () => {
  it('normalisiert und matcht Felder case-insensitive', () => {
    expect(normalizeSearchQuery('  Müller  ')).toBe('müller');
    expect(matchesSearchQuery('müller', 'Anna Müller', 'Berlin')).toBe(true);
    expect(matchesSearchQuery('xyz', 'Anna Müller')).toBe(false);
  });

  it('sortiert nach Relevanz (Prefix vor Contains)', () => {
    const items = [{ name: 'Beta Team' }, { name: 'Alpha Müller' }, { name: 'Müller GmbH' }];
    const sorted = sortBySearchRelevance('müller', items, (item) => [item.name]);
    expect(sorted[0]?.name).toBe('Müller GmbH');
  });

  it('vergibt höhere Scores für Prefix-Treffer', () => {
    expect(searchMatchScore('ann', 'Anna')).toBeGreaterThan(searchMatchScore('ann', 'Susanne'));
  });
});

describe('tenantSearchHistory', () => {
  it('baut mandantenspezifische Storage-Keys', () => {
    expect(buildTenantSearchHistoryStorageKey('tenant-a')).toBe(
      'caresuite:tenant-search-history:tenant-a',
    );
  });

  it('dedupliziert und begrenzt Einträge (neueste zuerst)', () => {
    const initial = [
      { query: 'Alt', searchedAt: '2026-06-01T08:00:00.000Z' },
      { query: 'Neu', searchedAt: '2026-06-02T08:00:00.000Z' },
    ];
    const next = pushSearchHistoryEntry(initial, 'Alt');
    expect(next[0]?.query).toBe('Alt');
    expect(next[1]?.query).toBe('Neu');
    expect(next).toHaveLength(2);
  });

  it('parst ungültige Payloads defensiv', () => {
    expect(parseSearchHistoryPayload(null)).toEqual([]);
    expect(parseSearchHistoryPayload('not-json')).toEqual([]);
    expect(parseSearchHistoryPayload(JSON.stringify([{ query: 'A', searchedAt: 'x' }]))).toEqual([
      { query: 'A', searchedAt: 'x' },
    ]);
  });

  it('respektiert MAX_ENTRIES in pushSearchHistoryEntry aus match (alias check)', () => {
    const many = Array.from({ length: TENANT_SEARCH_HISTORY_MAX_ENTRIES + 5 }, (_, index) => ({
      query: `q-${index}`,
      searchedAt: new Date().toISOString(),
    }));
    const next = pushSearchHistoryEntry(many, 'fresh');
    expect(next).toHaveLength(TENANT_SEARCH_HISTORY_MAX_ENTRIES);
    expect(next[0]?.query).toBe('fresh');
  });
});

describe('platformSearchHistoryTrigger', () => {
  it('aktiviert Long-Press nur auf iOS und Android', () => {
    expect(supportsNativeSearchHistoryLongPress('ios')).toBe(true);
    expect(supportsNativeSearchHistoryLongPress('android')).toBe(true);
    expect(supportsNativeSearchHistoryLongPress('web')).toBe(false);
    expect(supportsNativeSearchHistoryLongPress('windows')).toBe(false);
  });
});

describe('tenantSearchRoutes', () => {
  it('löst Kern-Entitätsrouten auf', () => {
    expect(resolveTenantSearchHref('client', 'c-1')).toBe('/business/office/clients/c-1');
    expect(resolveTenantSearchHref('assignment', 'a-1')).toBe('/assist/assignments/a-1');
    expect(resolveTenantSearchHref('communication', 't-1')).toBe('/business/messages/t-1');
  });
});

describe('tenantSearchService', () => {
  beforeEach(() => {
    vi.stubGlobal('__DEV__', false);
    seedSearchTestTenant();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetModuleAccessStore();
    resetTenantModuleSettingsCache();
  });

  it('lehnt leere Query ab', async () => {
    const result = await searchTenant(DEMO_TENANT_ID, '   ', {
      tenantId: DEMO_TENANT_ID,
      roleKey: 'business_admin',
      tenantModules: DEFAULT_TENANT_MODULES,
      actorRoleKey: 'business_admin',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Suchbegriff');
  });

  it('findet Klient:innen aus Office-Modul', async () => {
    vi.spyOn(clientListService, 'fetchClientList').mockResolvedValue({
      ok: true,
      data: [
        {
          id: 'client-002',
          tenantId: DEMO_TENANT_ID,
          firstName: 'Werner',
          lastName: 'Müller',
          status: 'aktiv',
          careLevel: 'PG 3',
          city: 'Berlin',
          zip: '10437',
          sensitivity: 'health',
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    const result = await searchTenant(DEMO_TENANT_ID, 'Müller', {
      tenantId: DEMO_TENANT_ID,
      roleKey: 'business_admin',
      tenantModules: DEFAULT_TENANT_MODULES,
      actorRoleKey: 'business_admin',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.results.some((item) => item.kind === 'client' && item.title.includes('Müller'))).toBe(
        true,
      );
    }
  });

  it('filtert Module nach Mandanten-Toggles', () => {
    seedSearchTestTenant({
      assistEnabled: false,
      pflegeEnabled: false,
      stationaerEnabled: false,
      beratungEnabled: false,
    });
    const active = resolveActiveTenantSearchModules({
      tenantId: DEMO_TENANT_ID,
      roleKey: 'business_admin',
      tenantModules: {
        assistEnabled: false,
        pflegeEnabled: false,
        stationaerEnabled: false,
        beratungEnabled: false,
      },
    });
    expect(active.includes('assist')).toBe(false);
    expect(active.includes('office')).toBe(false);
  });
});
