/**
 * LT.GMAPS.3 — Runtime diagnostics for live-tracking / employee portal DB errors.
 */
import type { PostgrestError } from '@supabase/supabase-js';
import {
  createLiveTrackingError,
  type LiveTrackingError,
  type LiveTrackingErrorCode,
  type LiveTrackingErrorContext,
  logLiveTrackingError,
} from './liveTrackingErrors';

export type NormalizedSupabaseError = {
  code: string | null;
  message: string;
  details: string | null;
  hint: string | null;
  httpStatus: number | null;
};

export type LiveTrackingErrorClassification =
  | 'rls'
  | 'schema'
  | 'not_found'
  | 'validation'
  | 'network'
  | 'unknown';

export function normalizeSupabaseError(
  error: PostgrestError | { code?: string; message?: string; details?: string; hint?: string } | null,
  httpStatus?: number | null,
): NormalizedSupabaseError {
  if (!error) {
    return { code: null, message: 'Unbekannter Fehler', details: null, hint: null, httpStatus: httpStatus ?? null };
  }
  return {
    code: error.code ?? null,
    message: error.message ?? 'Unbekannter Datenbankfehler',
    details: (error as { details?: string }).details ?? null,
    hint: (error as { hint?: string }).hint ?? null,
    httpStatus: httpStatus ?? null,
  };
}

export function classifyLiveTrackingError(
  normalized: NormalizedSupabaseError,
): LiveTrackingErrorClassification {
  const code = normalized.code ?? '';
  const msg = normalized.message.toLowerCase();

  if (code === '42501' || code === 'PGRST301' || msg.includes('row-level security')) return 'rls';
  if (
    code === '42703' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('could not find')
  ) {
    return 'schema';
  }
  if (code === 'PGRST116' || msg.includes('0 rows')) return 'not_found';
  if (code === '22P02' || msg.includes('invalid input syntax')) return 'validation';
  if (normalized.httpStatus != null && normalized.httpStatus >= 500) return 'network';
  return 'unknown';
}

export function logLiveTrackingRuntimeError(
  operation: string,
  normalized: NormalizedSupabaseError,
  context: LiveTrackingErrorContext,
  audience: 'employee' | 'admin' = 'employee',
): LiveTrackingError {
  const classification = classifyLiveTrackingError(normalized);
  const codeMap: Record<LiveTrackingErrorClassification, LiveTrackingErrorCode> = {
    rls: 'LIVE_RLS_DENIED',
    schema: 'LIVE_SCHEMA_MISMATCH',
    not_found: 'LIVE_ASSIGNMENT_NOT_FOUND',
    validation: 'LIVE_ASSIGNMENT_CONTEXT_MISMATCH',
    network: 'LIVE_UNKNOWN_DATABASE_ERROR',
    unknown: 'LIVE_UNKNOWN_DATABASE_ERROR',
  };

  const err = createLiveTrackingError(
    codeMap[classification],
    {
      ...context,
      operation,
      supabaseCode: normalized.code,
      supabaseMessage: normalized.message,
    },
    `[${classification}] ${normalized.code ?? 'no-code'}: ${normalized.message}`,
  );

  logLiveTrackingError(err);

  if (audience === 'admin' || process.env.NODE_ENV !== 'production') {
    console.error('[liveTracking:runtime]', {
      operation,
      classification,
      code: normalized.code,
      message: normalized.message,
      details: normalized.details,
      hint: normalized.hint,
      httpStatus: normalized.httpStatus,
      ...context,
    });
  }

  return err;
}

/** Employee-safe message; never exposes raw PostgREST text in production UI. */
export function liveTrackingUserMessage(error: LiveTrackingError): string {
  return error.userMessage;
}

/** Admin/debug message with Supabase code for support tickets. */
export function liveTrackingSupportDetail(error: LiveTrackingError): string {
  const code = error.context.supabaseCode ?? error.code;
  const msg = error.context.supabaseMessage ?? error.technicalMessage;
  return `${code}: ${msg}`;
}
