import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';
import { getSupabaseConfig, isSupabaseConfigured } from './config';

export type EdgeFunctionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function readEdgeFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = (await error.context.json()) as { error?: string; message?: string };
      if (payload?.error?.trim()) return payload.error.trim();
      if (payload?.message?.trim()) return payload.message.trim();
    } catch {
      // Response body not JSON — fall through to generic message.
    }
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim();
    if (message && message !== 'Edge Function returned a non-2xx status code') {
      return message;
    }
  }

  return 'Edge Function fehlgeschlagen.';
}

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
    return { ok: false, error: await readEdgeFunctionError(error) };
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
