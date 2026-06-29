/**
 * ASSIST.WORKFLOW.1 — Structured workflow errors (liveTrackingDiagnostics pattern).
 */
import type { PostgrestError } from '@supabase/supabase-js';
import {
  classifyLiveTrackingError,
  normalizeSupabaseError,
} from '@/features/liveTracking/liveTrackingDiagnostics';

export type AssistWorkflowErrorCode =
  | 'AWF_CONTEXT_MISSING'
  | 'AWF_INVALID_TRANSITION'
  | 'AWF_DOCUMENTATION_REQUIRED'
  | 'AWF_SIGNATURE_REQUIRED'
  | 'AWF_TASKS_INCOMPLETE'
  | 'AWF_NO_SHOW_NOTE_REQUIRED'
  | 'AWF_RLS_DENIED'
  | 'AWF_SCHEMA_MISMATCH'
  | 'AWF_NOT_FOUND'
  | 'AWF_VALIDATION'
  | 'AWF_DATABASE_ERROR'
  | 'AWF_GPS_REQUIRED'
  | 'AWF_CONSENT_REQUIRED';

export type AssistWorkflowErrorContext = {
  tenantId?: string | null;
  employeeId?: string | null;
  assignmentId?: string | null;
  assistVisitId?: string | null;
  operation?: string;
  supabaseCode?: string | null;
  supabaseMessage?: string | null;
};

export type AssistWorkflowError = {
  code: AssistWorkflowErrorCode;
  userMessage: string;
  technicalMessage: string;
  context: AssistWorkflowErrorContext;
};

const USER_MESSAGES: Record<AssistWorkflowErrorCode, string> = {
  AWF_CONTEXT_MISSING: 'Einsatzdaten unvollständig.',
  AWF_INVALID_TRANSITION: 'Statuswechsel ist nicht erlaubt.',
  AWF_DOCUMENTATION_REQUIRED: 'Dokumentation ist vor Abschluss erforderlich.',
  AWF_SIGNATURE_REQUIRED: 'Klient:innen-Unterschrift fehlt.',
  AWF_TASKS_INCOMPLETE: 'Pflichtaufgaben sind noch offen.',
  AWF_NO_SHOW_NOTE_REQUIRED: 'Begründung für „Nicht angetroffen“ ist erforderlich.',
  AWF_RLS_DENIED: 'Kein Zugriff — Berechtigung prüfen.',
  AWF_SCHEMA_MISMATCH: 'Datenbankschema passt nicht — Support informieren.',
  AWF_NOT_FOUND: 'Einsatz nicht gefunden.',
  AWF_VALIDATION: 'Eingabe ungültig.',
  AWF_DATABASE_ERROR: 'Datenbankoperation fehlgeschlagen.',
  AWF_GPS_REQUIRED: 'Standortberechtigung erforderlich.',
  AWF_CONSENT_REQUIRED: 'Standort-Einwilligung erforderlich.',
};

export function createAssistWorkflowError(
  code: AssistWorkflowErrorCode,
  context: AssistWorkflowErrorContext = {},
  technicalMessage?: string,
): AssistWorkflowError {
  return {
    code,
    userMessage: USER_MESSAGES[code],
    technicalMessage: technicalMessage ?? USER_MESSAGES[code],
    context,
  };
}

export function assistWorkflowErrorFromSupabase(
  error: PostgrestError | { code?: string; message?: string } | null,
  context: AssistWorkflowErrorContext,
): AssistWorkflowError {
  const normalized = normalizeSupabaseError(error);
  const classification = classifyLiveTrackingError(normalized);
  const codeMap: Record<string, AssistWorkflowErrorCode> = {
    rls: 'AWF_RLS_DENIED',
    schema: 'AWF_SCHEMA_MISMATCH',
    not_found: 'AWF_NOT_FOUND',
    validation: 'AWF_VALIDATION',
    network: 'AWF_DATABASE_ERROR',
    unknown: 'AWF_DATABASE_ERROR',
  };
  return createAssistWorkflowError(
    codeMap[classification] ?? 'AWF_DATABASE_ERROR',
    {
      ...context,
      supabaseCode: normalized.code,
      supabaseMessage: normalized.message,
    },
    `[${classification}] ${normalized.code ?? 'no-code'}: ${normalized.message}`,
  );
}

export function logAssistWorkflowError(error: AssistWorkflowError): void {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[assistWorkflow]', {
      code: error.code,
      userMessage: error.userMessage,
      technicalMessage: error.technicalMessage,
      ...error.context,
    });
  }
}

export function assistWorkflowErrorToResult<T = void>(
  error: AssistWorkflowError,
): { ok: false; error: string; errorCode: string } {
  logAssistWorkflowError(error);
  return { ok: false, error: error.userMessage, errorCode: error.code };
}
