/**
 * LT.GMAPS.2 — Structured live-tracking errors with diagnostic logging.
 */

export type LiveTrackingErrorCode =
  | 'LIVE_ASSIGNMENT_NOT_FOUND'
  | 'LIVE_ASSIGNMENT_CONTEXT_MISMATCH'
  | 'LIVE_TENANT_MISSING'
  | 'LIVE_EMPLOYEE_MISSING'
  | 'LIVE_CLIENT_MISSING'
  | 'LIVE_CONSENT_SAVE_FAILED'
  | 'LIVE_SESSION_CREATE_FAILED'
  | 'LIVE_SESSION_UPDATE_FAILED'
  | 'LIVE_LOCATION_INSERT_FAILED'
  | 'LIVE_TIME_EVENT_INSERT_FAILED'
  | 'LIVE_RLS_DENIED'
  | 'LIVE_SCHEMA_MISMATCH'
  | 'LIVE_FOREIGN_KEY_FAILED'
  | 'LIVE_NOT_NULL_FAILED'
  | 'LIVE_DUPLICATE_SESSION'
  | 'LIVE_GPS_PERMISSION_DENIED'
  | 'LIVE_GPS_POSITION_UNAVAILABLE'
  | 'LIVE_GPS_TIMEOUT'
  | 'LIVE_UNKNOWN_DATABASE_ERROR';

export type LiveTrackingErrorContext = {
  tenantId?: string | null;
  employeeId?: string | null;
  clientId?: string | null;
  assignmentId?: string | null;
  assistVisitId?: string | null;
  routeParam?: string | null;
  portalAccountId?: string | null;
  operation?: string;
  tableOrRpc?: string;
  supabaseCode?: string | null;
  supabaseMessage?: string | null;
};

export type LiveTrackingError = {
  code: LiveTrackingErrorCode;
  userMessage: string;
  technicalMessage: string;
  context: LiveTrackingErrorContext;
};

const EMPLOYEE_MESSAGES: Record<LiveTrackingErrorCode, string> = {
  LIVE_ASSIGNMENT_NOT_FOUND: 'Einsatz nicht gefunden.',
  LIVE_ASSIGNMENT_CONTEXT_MISMATCH: 'Einsatz konnte nicht eindeutig zugeordnet werden.',
  LIVE_TENANT_MISSING: 'Mandant fehlt — bitte erneut anmelden.',
  LIVE_EMPLOYEE_MISSING: 'Mitarbeiterprofil fehlt — bitte Administrator kontaktieren.',
  LIVE_CLIENT_MISSING: 'Klient:in konnte nicht geladen werden.',
  LIVE_CONSENT_SAVE_FAILED: 'Einwilligung konnte nicht gespeichert werden.',
  LIVE_SESSION_CREATE_FAILED: 'Tracking konnte nicht gestartet werden.',
  LIVE_SESSION_UPDATE_FAILED: 'Tracking-Session konnte nicht aktualisiert werden.',
  LIVE_LOCATION_INSERT_FAILED: 'Standort konnte nicht übertragen werden.',
  LIVE_TIME_EVENT_INSERT_FAILED: 'Zeiterfassung konnte nicht gespeichert werden.',
  LIVE_RLS_DENIED: 'Kein Zugriff auf Tracking-Daten (Berechtigung).',
  LIVE_SCHEMA_MISMATCH: 'Datenbankschema passt nicht — Support informieren.',
  LIVE_FOREIGN_KEY_FAILED: 'Einsatz-Verknüpfung ungültig.',
  LIVE_NOT_NULL_FAILED: 'Pflichtdaten fehlen für Tracking.',
  LIVE_DUPLICATE_SESSION: 'Es läuft bereits eine Tracking-Session.',
  LIVE_GPS_PERMISSION_DENIED: 'Standortberechtigung nicht erteilt.',
  LIVE_GPS_POSITION_UNAVAILABLE: 'GPS-Signal nicht verfügbar.',
  LIVE_GPS_TIMEOUT: 'GPS-Zeitüberschreitung — bitte erneut versuchen.',
  LIVE_UNKNOWN_DATABASE_ERROR: 'Datenbankoperation fehlgeschlagen.',
};

function inferCodeFromSupabase(
  code?: string | null,
  message?: string | null,
): LiveTrackingErrorCode {
  const msg = message ?? '';
  if (code === '42501' || code === 'PGRST301' || msg.includes('row-level security')) {
    return 'LIVE_RLS_DENIED';
  }
  if (code === '23503' || msg.includes('foreign key')) return 'LIVE_FOREIGN_KEY_FAILED';
  if (code === '23505' || msg.includes('duplicate key')) return 'LIVE_DUPLICATE_SESSION';
  if (code === '23502' || msg.includes('null value')) return 'LIVE_NOT_NULL_FAILED';
  if (
    code === '42703' ||
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('Could not find')
  ) {
    return 'LIVE_SCHEMA_MISMATCH';
  }
  if (code === 'PGRST116' || msg.includes('nicht gefunden')) return 'LIVE_ASSIGNMENT_NOT_FOUND';
  return 'LIVE_UNKNOWN_DATABASE_ERROR';
}

export function logLiveTrackingError(error: LiveTrackingError): void {
  const payload = {
    code: error.code,
    operation: error.context.operation,
    tenantId: error.context.tenantId,
    employeeId: error.context.employeeId,
    clientId: error.context.clientId,
    assignmentId: error.context.assignmentId,
    assistVisitId: error.context.assistVisitId,
    routeParam: error.context.routeParam,
    tableOrRpc: error.context.tableOrRpc,
    supabaseCode: error.context.supabaseCode,
    supabaseMessage: error.context.supabaseMessage,
    technicalMessage: error.technicalMessage,
  };
  console.error('[liveTracking]', payload);
}

export function createLiveTrackingError(
  code: LiveTrackingErrorCode,
  context: LiveTrackingErrorContext,
  technicalDetail?: string,
): LiveTrackingError {
  const technicalMessage =
    technicalDetail ??
    [
      code,
      context.operation,
      context.tableOrRpc,
      context.supabaseCode,
      context.supabaseMessage,
    ]
      .filter(Boolean)
      .join(' · ');

  return {
    code,
    userMessage: EMPLOYEE_MESSAGES[code],
    technicalMessage,
    context,
  };
}

export function liveTrackingErrorFromSupabase(
  error: { code?: string; message?: string } | null,
  context: LiveTrackingErrorContext,
): LiveTrackingError {
  const code = inferCodeFromSupabase(error?.code, error?.message);
  const enriched: LiveTrackingErrorContext = {
    ...context,
    supabaseCode: error?.code ?? null,
    supabaseMessage: error?.message ?? null,
  };
  const result = createLiveTrackingError(code, enriched, error?.message);
  logLiveTrackingError(result);
  return result;
}

/** Employee portal message; office/admin may show technicalMessage. */
export function formatLiveTrackingErrorForUi(
  error: LiveTrackingError,
  audience: 'employee' | 'admin' = 'employee',
): string {
  if (audience === 'admin') {
    return `${error.userMessage} (${error.code}: ${error.technicalMessage})`;
  }
  return error.userMessage;
}

export function liveTrackingErrorToServiceResult(error: LiveTrackingError): {
  ok: false;
  error: string;
  errorCode: LiveTrackingErrorCode;
} {
  return {
    ok: false,
    error: error.userMessage,
    errorCode: error.code,
  };
}
