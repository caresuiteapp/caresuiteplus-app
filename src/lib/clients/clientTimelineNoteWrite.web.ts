import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { woundUuid } from '../pflege/woundCareDomain.ts';
import { cloneClientNativeOriginal, freezeClientNativeOriginal, sameClientNativeOriginal } from './clientRecordNativeOriginal.web.ts';
import { assertClientTimelineCapture, type ClientTimelineNoteAttempt, type ClientTimelineNoteResult } from './clientTimelineNoteAction.web.ts';

/** No native request UUID exists in this table contract: unknown insert outcomes cannot be safely replayed. */
export async function writeClientTimelineNoteWeb(original: ClientTimelineNoteAttempt): Promise<ClientTimelineNoteResult> {
  let insertDispatched = false;
  try {
    assertClientTimelineCapture(original.capture, true);
    const payload = cloneClientNativeOriginal(original.payload);
    const expected = { tenant_id: original.capture.tenantId, client_id: original.capture.clientId, event_type: 'notiz', icon: '📝',
      title: original.draft.trim(), subtitle: 'Manuelle Notiz', status: 'aktiv', actor_name: original.capture.actorName, is_internal: false, metadata: null };
    if (!expected.title || !sameClientNativeOriginal(payload, expected)) throw Error('Die vollständige eigene Originalnotiz ist nicht bestätigt.');
    const sdk = getSupabaseClient();
    if (!sdk) throw Error('Die native Klientenakte ist nicht verbunden.');
    const select = async (query: PromiseLike<unknown>, insert: boolean): Promise<Record<string, unknown>> => {
      assertClientTimelineCapture(original.capture, true);
      const raw = await withServiceQueryTimeout(new Promise<unknown>((resolve, reject) => {
        assertClientTimelineCapture(original.capture, true);
        if (insert) insertDispatched = true;
        query.then(resolve, reject);
      }), insert ? 'Notizspeicherung' : 'Klienten-Zuordnung');
      const result = cloneClientNativeOriginal(raw);
      if (!result || typeof result !== 'object' || Array.isArray(result) || !Object.hasOwn(result, 'error') || !Object.hasOwn(result, 'data')) throw Error('Der native Abfragestatus ist nicht bestätigt.');
      return result as Record<string, unknown>;
    };
    const root = await select(fromUnknownTable(sdk, 'clients').select('id,tenant_id')
      .eq('tenant_id', payload.tenant_id).eq('id', payload.client_id).single(), false);
    assertClientTimelineCapture(original.capture, true);
    if (root.error !== null) {
      if (!root.error || typeof root.error !== 'object' || Array.isArray(root.error)) throw Error('Der native Abfragestatus ist nicht bestätigt.');
      return { ok: false, error: toGermanSupabaseError(root.error), uncertain: false };
    }
    if (!Object.hasOwn(root, 'status') || typeof root.status !== 'number' || !Number.isInteger(root.status)
      || root.status < 200 || root.status >= 300) throw Error('Der native Zuordnungs-Abrufstatus ist nicht bestätigt.');
    if (!sameClientNativeOriginal(root.data, { id: payload.client_id, tenant_id: payload.tenant_id })) throw Error('Der eigene native Klientenbezug ist nicht bestätigt.');
    assertClientTimelineCapture(original.capture, true);
    const result = await select(fromUnknownTable(sdk, 'client_timeline_events').insert(payload).select('*').single(), true);
    // Definitive SQL rejection remains rejection even if a later read or edit gate changed.
    if (result.error !== null) {
      if (!result.error || typeof result.error !== 'object' || Array.isArray(result.error)) throw Error('Der native Schreibausgang ist nicht bestätigt.');
      const error = result.error as Record<string, unknown>;
      // The SDK also returns transport/parse failures as an error object (status 0 or even 2xx).
      // Only an explicit HTTP client-error response with native SQLSTATE rejects this transaction definitively.
      const definitive = Object.hasOwn(result, 'status') && typeof result.status === 'number' && Number.isInteger(result.status)
        && result.status >= 400 && result.status < 500 && result.data === null && Object.hasOwn(error, 'code')
        && typeof error.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code)
        && Object.hasOwn(error, 'message') && typeof error.message === 'string' && !!error.message.trim();
      return { ok: false, error: toGermanSupabaseError(result.error), uncertain: !definitive };
    }
    if (!Object.hasOwn(result, 'status') || typeof result.status !== 'number' || !Number.isInteger(result.status)
      || result.status < 200 || result.status >= 300) throw Error('Der native Schreib-Bestätigungsstatus ist nicht bestätigt.');
    const row = result.data as Record<string, unknown> | null;
    if (!row || typeof row !== 'object' || Array.isArray(row) || !woundUuid(row.id)) throw Error('Die native Notizbestätigung fehlt.');
    for (const key of Object.keys(payload)) if (!Object.hasOwn(row, key) || !sameClientNativeOriginal(row[key], payload[key as keyof typeof payload])) throw Error('Die native Notizbestätigung passt nicht zum vollständigen Originalauftrag.');
    // Known acknowledgement is returned independently of follow-up rights; the controller guards local clearing/navigation.
    return { ok: true, nativeId: row.id as string, nativeOriginal: freezeClientNativeOriginal(row) };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : 'Notizspeicherung nicht bestätigt.', uncertain: insertDispatched };
  }
}
