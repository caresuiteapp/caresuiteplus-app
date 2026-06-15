import { getSupabaseClient } from './client';
import { getSupabaseConfig, isSupabaseConfigured } from './config';

export type EdgeFunctionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function invokeEdgeFunction<TResponse>(
  functionName: string,
  body: Record<string, unknown>,
): Promise<EdgeFunctionResult<TResponse>> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'Supabase ist nicht konfiguriert.' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, error: 'Supabase-Client nicht verfügbar.' };
  }

  const { data, error } = await client.functions.invoke(functionName, { body });

  if (error) {
    return { ok: false, error: error.message ?? 'Edge Function fehlgeschlagen.' };
  }

  const payload = data as { ok?: boolean; error?: string } & TResponse;
  if (payload && payload.ok === false) {
    return { ok: false, error: payload.error ?? 'Anfrage fehlgeschlagen.' };
  }

  return { ok: true, data: payload as TResponse };
}

export function getSupabaseFunctionsBaseUrl(): string | null {
  const { url } = getSupabaseConfig();
  if (!url) return null;
  return `${url.replace(/\/$/, '')}/functions/v1`;
}
