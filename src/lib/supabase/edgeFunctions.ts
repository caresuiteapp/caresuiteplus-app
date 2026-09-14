import { getSupabaseClient } from './client';
import { getSupabaseConfig, isSupabaseConfigured } from './config';

export type EdgeFunctionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type EdgeFunctionErrorBody = {
  ok?: boolean;
  error?: string;
  message?: string;
  code?: string;
};

type FunctionInvokeError = Error & {
  context?: Response;
};

const EDGE_FUNCTION_REQUEST_TIMEOUT_MS = 15_000;

async function withEdgeFunctionTimeout<T>(
  request: PromiseLike<T>,
  functionName: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      request,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Edge Function ${functionName} hat zu lange gedauert.`));
        }, EDGE_FUNCTION_REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function extractEdgeFunctionError(error: unknown): Promise<string> {
  if (error && typeof error === 'object' && 'name' in error) {
    const namedError = error as FunctionInvokeError;

    if (namedError.name === 'FunctionsHttpError' && namedError.context) {
      try {
        const payload = (await namedError.context.json()) as EdgeFunctionErrorBody;
        if (typeof payload.error === 'string' && payload.error.trim()) {
          return normalizeEdgeErrorMessage(payload.error);
        }
        if (typeof payload.message === 'string' && payload.message.trim()) {
          return normalizeEdgeErrorMessage(payload.message);
        }
      } catch {
        try {
          const text = await namedError.context.text();
          if (text.trim()) {
            return normalizeEdgeErrorMessage(text);
          }
        } catch {
          // ignore secondary parse failures
        }
      }
    }

    if (namedError.name === 'FunctionsRelayError') {
      return 'Edge-Function-Relay-Fehler. Bitte später erneut versuchen.';
    }

    if (namedError.name === 'FunctionsFetchError') {
      return 'Netzwerkfehler beim Aufruf der Edge Function.';
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Edge Function fehlgeschlagen.';
}

function normalizeEdgeErrorMessage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      error?: { message?: string };
      message?: string;
    };
    const nested = parsed.error?.message ?? parsed.message;
    if (typeof nested === 'string' && nested.trim()) {
      return nested.trim();
    }
  } catch {
    // keep raw string
  }

  return trimmed;
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

  let result: Awaited<ReturnType<typeof client.functions.invoke>>;
  try {
    result = await withEdgeFunctionTimeout(
      client.functions.invoke(functionName, { body }),
      functionName,
    );
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.message.includes('hat zu lange gedauert');
    return {
      ok: false,
      error: timedOut
        ? 'Die Anfrage antwortet nicht. Bitte Verbindung prüfen und erneut versuchen.'
        : await extractEdgeFunctionError(cause),
    };
  }

  const { data, error } = result;

  if (error) {
    return { ok: false, error: await extractEdgeFunctionError(error) };
  }

  const payload = data as { ok?: boolean; error?: string } & TResponse;
  if (payload && payload.ok === false) {
    return {
      ok: false,
      error: payload.error ? normalizeEdgeErrorMessage(payload.error) : 'Anfrage fehlgeschlagen.',
    };
  }

  return { ok: true, data: payload as TResponse };
}

export function getSupabaseFunctionsBaseUrl(): string | null {
  const { url } = getSupabaseConfig();
  if (!url) return null;
  return `${url.replace(/\/$/, '')}/functions/v1`;
}
