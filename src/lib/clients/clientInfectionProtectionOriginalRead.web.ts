import type { ServiceResult } from '@/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import {
  assertClientNativeScope,
  cloneClientNativeOriginal,
  freezeClientNativeOriginal,
  sameClientNativeOriginal,
} from './clientRecordNativeOriginal.web.ts';
import {
  captureClientInfectionProtectionEvidenceWeb,
  type ClientInfectionProtectionEvidenceWeb,
} from './clientInfectionProtectionEvidence.web.ts';

export const CLIENT_INFECTION_PROTECTION_SELECT =
  'id,tenant_id,client_id,infection_notes,hygiene_notes,created_at,updated_at' as const;

export type ClientInfectionProtectionOriginalReadOptionsWeb = Readonly<{
  canRead: true;
  canViewSensitive: true;
  assertCurrentRead: () => void;
}>;

export type ClientInfectionProtectionOriginalReadReceiptWeb = Readonly<{
  state: 'requested';
  collection: ClientInfectionProtectionEvidenceWeb;
  selector: typeof CLIENT_INFECTION_PROTECTION_SELECT;
  queriedPool: 'client_ambulatory_details';
  snapshot: 'verified_row_repeat_non_atomic';
}>;

/** Sensitive SELECT-only read. No text parsing, fallback, write, RPC or schema change. */
export async function fetchClientInfectionProtectionOriginalReadWeb(
  tenantId: string,
  clientId: string,
  options: ClientInfectionProtectionOriginalReadOptionsWeb,
): Promise<ServiceResult<ClientInfectionProtectionOriginalReadReceiptWeb>> {
  let closed = false;
  try {
    if (!options || Object.getPrototypeOf(options) !== Object.prototype) {
      throw Error('Die aktuellen Lesegates für den Infektionsschutz fehlen.');
    }
    for (const key of ['canRead', 'canViewSensitive'] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(options, key);
      if (!descriptor || !('value' in descriptor) || descriptor.value !== true) {
        throw Error('Der aktuelle eigene Zugriff auf sensible Infektionshinweise ist nicht bestätigt.');
      }
    }
    const read = Object.getOwnPropertyDescriptor(options, 'assertCurrentRead');
    if (!read || !('value' in read) || typeof read.value !== 'function') {
      throw Error('Der aktuelle eigene Infektionsschutz-Lesekontext fehlt.');
    }
    const scope = Object.freeze({ tenantId, clientId });
    assertClientNativeScope(scope);
    const current = () => {
      if (closed) throw Error('Dieser native Infektionsschutzabruf ist bereits beendet.');
      const result = read.value();
      if (result !== undefined) {
        if (result instanceof Promise) void result.catch(() => {});
        throw Error('Der eigene Infektionsschutz-Lesekontext ist nicht synchron bestätigt.');
      }
    };
    current();
    const sdk = getSupabaseClient();
    if (!sdk) throw Error('Der native Infektionsschutzbestand ist nicht verbunden.');
    const readRows = async () => {
      current();
      const query = fromUnknownTable(sdk, 'client_ambulatory_details')
        .select(CLIENT_INFECTION_PROTECTION_SELECT)
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .order('id', { ascending: true })
        .limit(2);
      const raw = await withServiceQueryTimeout(new Promise<unknown>((resolve, reject) => {
        current();
        query.then(resolve, reject);
      }), 'Native Infektionsschutzangaben');
      current();
      const result = cloneClientNativeOriginal(raw);
      if (!result || typeof result !== 'object' || Array.isArray(result) || !Object.hasOwn(result, 'error')) {
        throw Error('Der native Infektionsschutz-Abfragestatus ist ungeklärt.');
      }
      const response = result as Record<string, unknown>;
      if (response.error !== null) {
        if (!response.error || typeof response.error !== 'object' || Array.isArray(response.error)) {
          throw Error('Der native Infektionsschutz-Abfragestatus ist ungeklärt.');
        }
        throw Error(toGermanSupabaseError(response.error));
      }
      if (!Object.hasOwn(response, 'data')) throw Error('Der native Infektionsschutzbestand fehlt.');
      return captureClientInfectionProtectionEvidenceWeb(response.data, scope);
    };
    const collection = await readRows();
    current();
    const repeated = await readRows();
    current();
    if (!sameClientNativeOriginal(collection.originals, repeated.originals)) {
      throw Error('Die nativen Infektionsschutzangaben haben sich während des Abrufs geändert. Bitte erneut laden.');
    }
    const receipt = freezeClientNativeOriginal({
      state: 'requested' as const,
      collection,
      selector: CLIENT_INFECTION_PROTECTION_SELECT,
      queriedPool: 'client_ambulatory_details' as const,
      snapshot: 'verified_row_repeat_non_atomic' as const,
    });
    current();
    closed = true;
    return { ok: true, data: receipt };
  } catch (error) {
    closed = true;
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Die nativen Infektionsschutzangaben konnten nicht bestätigt werden.',
    };
  }
}
