import type { ServiceResult } from '@/types';
import type { ClientFullDetail } from '@/types/modules/client';
import type { ClientCareContext } from './clientIntakeFieldRules';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { mapClientFullDetail } from '@/lib/supabase/mappers';
import {
  CLIENT_RECORD_NATIVE_POOLS, assertClientNativeScope, captureClientNativeRoot, captureClientNativePage,
  captureClientNativeContexts, cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal,
  type ClientNativeOriginals, type ClientNativeParts, type ClientNativePoolKey, type ClientNativeRow,
} from './clientRecordNativeOriginal.web.ts';

// Existing safe projection, byte-for-byte with the native repository. No access-code/hash/token values.
const CLIENT_PORTAL_ACCESS_SAFE_SELECT = `
  id, tenant_id, client_id, contact_id, email, portal_username, portal_enabled,
  status, last_login_at, invited_at, code_created_at, code_rotated_at,
  modules_enabled, two_factor_enabled, created_at, updated_at, auth_user_id
` as const;
// Verified 0003/0010/0039/0043/0072 and master-data migrations. No '*' fallback or known sensitive-core columns.
const CLIENT_CORE_SAFE_SELECT = [
  'id', 'tenant_id', 'first_name', 'last_name', 'date_of_birth', 'care_level', 'status', 'street', 'city',
  'zip', 'phone', 'email', 'notes', 'primary_contact_phone', 'sensitivity', 'visibility', 'owned_by_profile_id',
  'shared_with_profile_ids', 'created_at', 'updated_at', 'lifecycle_status', 'salutation', 'gender',
  'archived_at', 'cost_bearer', 'insurance_name', 'postal_code', 'internal_notes', 'created_by', 'updated_by',
  'client_number', 'admission_date', 'service_start', 'birth_place', 'nationality', 'language', 'marital_status',
  'housing_form', 'special_notes', 'apartment_number', 'preferred_contact', 'visible_notes_for_employee',
  'emergency_notes', 'allergies', 'mobility_notes', 'pets', 'key_management_notes',
].join(',');
const safeCoreFields = new Set(CLIENT_CORE_SAFE_SELECT.split(','));
const safePortalFields = new Set(CLIENT_PORTAL_ACCESS_SAFE_SELECT.split(',').map(value => value.trim()));
export type ClientOriginalReadOptions = {
  canViewSensitive: boolean;
  /** Caller binds exact current Authowner/Read+Sensitive scope, request ticket, generation and lifetime; throw if stale. */
  assertCurrentRead: () => void;
  includeCareContexts?: boolean;
};
export type ClientOriginalReadReceipt = {
  detail: ClientFullDetail;
  /** Private receipt only. Do not attach to the display DTO or pass the raw pool to children/AI. */
  originals: ClientNativeOriginals;
  careContexts?: ClientCareContext[];
};

/** SELECT-only native Web read. No Shared repository/service delegation, sync, promotion, audit, write or RPC. */
export async function fetchClientOriginalReadWeb(
  tenantId: string, clientId: string, options: ClientOriginalReadOptions,
): Promise<ServiceResult<ClientOriginalReadReceipt>> {
  let flightClosed = false;
  try {
    // Capture option descriptors once; later mutation or accessors cannot change the in-flight rights/selector/callback.
    if (!options || Object.getPrototypeOf(options) !== Object.prototype) throw Error('Die aktuellen nativen Akten-Lesegates fehlen.');
    const read = Object.getOwnPropertyDescriptor(options, 'assertCurrentRead');
    const sensitive = Object.getOwnPropertyDescriptor(options, 'canViewSensitive');
    const context = Object.getOwnPropertyDescriptor(options, 'includeCareContexts');
    if (!read || !('value' in read) || typeof read.value !== 'function' || !sensitive || !('value' in sensitive)
      || typeof sensitive.value !== 'boolean' || context && (!('value' in context) || typeof context.value !== 'boolean')) {
      throw Error('Der eigene aktuelle Aktenabruf und seine Leserechte sind nicht eindeutig bestätigt.');
    }
    const canSensitive: boolean = sensitive.value, includeContexts = context?.value === true;
    const scope = Object.freeze({ tenantId, clientId });
    assertClientNativeScope(scope);
    const current = () => {
      if (flightClosed) throw Error('Dieser native Aktenabruf ist bereits beendet.');
      const result = read.value();
      if (result !== undefined) {
        // This private contract is a synchronous assertion, never an un-awaited Promise-based permission decision.
        if (result instanceof Promise) void result.catch(() => {});
        throw Error('Der ursprüngliche eigene Akten-Lesekontext ist nicht synchron bestätigt.');
      }
    };
    current();
    const sdk = getSupabaseClient();
    if (!sdk) throw Error('Die native Klientenakte ist nicht verbunden.');
    const rootSelect = canSensitive ? '*' : CLIENT_CORE_SAFE_SELECT;
    const select = async (query: PromiseLike<unknown>, label: string): Promise<unknown> => {
      current();
      const raw = await withServiceQueryTimeout(new Promise<unknown>((resolve, reject) => {
        // Native then-entry is the dispatch boundary; Promise.resolve(query) defers it to another microtask.
        current(); query.then(resolve, reject);
      }), label);
      current();
      const result = cloneClientNativeOriginal(raw);
      if (!result || typeof result !== 'object' || Array.isArray(result) || !Object.hasOwn(result, 'error')) throw Error('Der native Abfragestatus konnte nicht bestätigt werden.');
      const response = result as Record<string, unknown>;
      if (response.error !== null) {
        if (!response.error || typeof response.error !== 'object' || Array.isArray(response.error)) throw Error('Der native Abfragestatus konnte nicht bestätigt werden.');
        throw Error(toGermanSupabaseError(response.error));
      }
      if (!Object.hasOwn(response, 'data')) throw Error('Der native Abfragebestand fehlt.');
      return response.data;
    };
    const rootRead = async () => {
      current();
      const data = await select(fromUnknownTable(sdk, 'clients')
        .select(rootSelect).eq('tenant_id', tenantId).eq('id', clientId).single(), 'Klienten-Stammdaten');
      current();
      const root = captureClientNativeRoot(data, scope);
      if (!canSensitive && Object.keys(root).some(key => !safeCoreFields.has(key))) throw Error('Nicht angeforderte native Stammdaten wurden geliefert.');
      return root;
    };
    const root = await rootRead();
    current();
    const poolRead = async (table: string, selector = '*') => {
      const rows: ClientNativeRow[] = [];
      let cursor: string | null = null;
      try {
        for (;;) {
          current();
          let query = fromUnknownTable(sdk, table).select(selector).eq('tenant_id', tenantId).eq('client_id', clientId)
            .order('id', { ascending: true }).limit(250);
          if (cursor !== null) query = query.gt('id', cursor);
          const data = await select(query, 'Klienten-Aktenbestand');
          current();
          const page = captureClientNativePage(data, scope, cursor);
          if (table === 'client_portal_access' && page.some(row => Object.keys(row).some(key => !safePortalFields.has(key)))) throw Error('Nicht angeforderte Portalzugangsfelder wurden geliefert.');
          if (!page.length) return rows;
          rows.push(...page);
          cursor = (page[page.length - 1].id as string).toLowerCase();
          // A server cap can produce short pages; only a genuinely empty page ends this delivered read.
        }
      } catch (error) {
        // Stop new pages in all sibling reads immediately. Already issued SDK requests are not claimed cancelled.
        flightClosed = true;
        throw error;
      }
    };
    const keys = Object.keys(CLIENT_RECORD_NATIVE_POOLS) as ClientNativePoolKey[];
    const pages = await Promise.all(keys.map(key => poolRead(CLIENT_RECORD_NATIVE_POOLS[key], key === 'portalAccess' ? CLIENT_PORTAL_ACCESS_SAFE_SELECT : '*')));
    current();
    const parts = { client: root, ...Object.fromEntries(keys.map((key, index) => [key, pages[index]])) } as ClientNativeParts;
    const contextRows = includeContexts ? await poolRead('client_care_contexts') : null;
    current();
    const careContexts = contextRows === null ? undefined : captureClientNativeContexts(contextRows) as ClientCareContext[];
    const rootAfter = await rootRead();
    current();
    if (!sameClientNativeOriginal(root, rootAfter)) throw Error('Die nativen Stammdaten haben sich während des Aktenabrufs geändert. Bitte erneut laden.');
    const originals = freezeClientNativeOriginal(cloneClientNativeOriginal({
      parts, careContexts: contextRows, coreSensitiveFields: canSensitive ? 'requested' : 'not_requested',
      selectors: { clients: rootSelect, ...Object.fromEntries(keys.map(key => [CLIENT_RECORD_NATIVE_POOLS[key], key === 'portalAccess' ? CLIENT_PORTAL_ACCESS_SAFE_SELECT : '*'])), ...(includeContexts ? { client_care_contexts: '*' } : {}) },
      queriedPools: ['clients', ...keys.map(key => CLIENT_RECORD_NATIVE_POOLS[key]), ...(includeContexts ? ['client_care_contexts'] : [])],
    })) as ClientNativeOriginals;
    current();
    // The unchanged mapper receives a separate mutable clone. Its display fallbacks/filtering never alter originals.
    const mapped = mapClientFullDetail(cloneClientNativeOriginal(parts) as unknown as Parameters<typeof mapClientFullDetail>[0]);
    const detail = canSensitive ? mapped : {
      ...mapped, insuranceNumber: '•••••••••',
      core: { ...mapped.core, insuranceNumber: '•••••••••', keySafeCode: '••••', diagnoses: ['Geschützt'] },
    };
    current();
    flightClosed = true;
    return { ok: true, data: { detail, originals, ...(careContexts === undefined ? {} : { careContexts }) } };
  } catch (error) {
    flightClosed = true;
    return { ok: false, error: error instanceof Error ? error.message : 'Der native Aktenbestand konnte nicht bestätigt werden.' };
  }
}
