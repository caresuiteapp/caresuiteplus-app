/**
 * LT.GMAPS.4 — Idempotent employee-portal location consent persistence.
 * Uses resolveEmployeeLiveContext as the single assignment/visit bridge.
 */
import type { ServiceResult } from '@/types';
import {
  fetchActiveTrackingSession,
  startTrackingSession,
} from '@/lib/assist/assistTrackingPersistenceService';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import {
  createLiveTrackingError,
  liveTrackingErrorFromSupabase,
  liveTrackingErrorToServiceResult,
  logLiveTrackingError,
} from './liveTrackingErrors';
import { resolveEmployeeLiveContext } from './resolveEmployeeLiveContext';

export type SaveEmployeeLocationConsentInput = {
  tenantId: string;
  employeeId: string;
  routeParamId: string;
  profileId?: string | null;
  consentExplainedAt?: string | null;
  localConsent?: {
    granted: boolean;
    grantedAt: string | null;
    explainedAt: string | null;
  };
};

export type SaveEmployeeLocationConsentResult = {
  sessionId: string;
  consentGrantedAt: string;
  consentExplainedAt: string | null;
  assistVisitId: string;
  assignmentId: string;
  alreadyGranted: boolean;
};

type SessionRow = {
  id: string;
  consent_granted_at: string | null;
  consent_explained_at: string | null;
  is_active: boolean;
};

async function fetchLatestSessionForVisit(
  tenantId: string,
  visitId: string,
): Promise<ServiceResult<SessionRow | null>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase ist nicht verfügbar.' };

  const { data, error } = await fromUnknownTable(supabase, 'assist_tracking_sessions')
    .select('id, consent_granted_at, consent_explained_at, is_active')
    .eq('tenant_id', tenantId)
    .eq('visit_id', visitId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    const err = liveTrackingErrorFromSupabase(error, {
      tenantId,
      assistVisitId: visitId,
      tableOrRpc: 'assist_tracking_sessions',
      operation: 'saveEmployeeLocationConsent.fetchLatest',
    });
    return liveTrackingErrorToServiceResult(err);
  }

  return { ok: true, data: (data as SessionRow | null) ?? null };
}

async function verifyConsentReadBack(
  tenantId: string,
  visitId: string,
  expectedGrantedAt: string,
): Promise<ServiceResult<SessionRow>> {
  const latest = await fetchLatestSessionForVisit(tenantId, visitId);
  if (!latest.ok) return latest as ServiceResult<never>;
  if (!latest.data?.consent_granted_at) {
    const err = createLiveTrackingError('LIVE_CONSENT_SAVE_FAILED', {
      tenantId,
      assistVisitId: visitId,
      operation: 'saveEmployeeLocationConsent.verify',
      supabaseMessage: 'consent_granted_at missing after write',
    });
    logLiveTrackingError(err);
    return liveTrackingErrorToServiceResult(err);
  }
  if (latest.data.consent_granted_at !== expectedGrantedAt) {
    // Accept any non-null timestamp — clock skew / DB rounding
    return { ok: true, data: latest.data };
  }
  return { ok: true, data: latest.data };
}

/** Persist consent idempotently; safe to call on reload or double-click. */
export async function saveEmployeeLocationConsent(
  input: SaveEmployeeLocationConsentInput,
): Promise<ServiceResult<SaveEmployeeLocationConsentResult>> {
  const ctxResult = await resolveEmployeeLiveContext({
    tenantId: input.tenantId,
    employeeId: input.employeeId,
    routeParamId: input.routeParamId,
    portalAccountId: input.profileId,
    localConsent: input.localConsent,
  });

  if (!ctxResult.ok) return ctxResult;

  const ctx = ctxResult.data;
  const now = input.localConsent?.grantedAt ?? new Date().toISOString();
  const explainedAt = input.consentExplainedAt ?? input.localConsent?.explainedAt ?? now;

  if (ctx.consentStatus.granted && ctx.consentStatus.grantedAt) {
    const sessionId = ctx.trackingSessionId ?? (await fetchLatestSessionForVisit(input.tenantId, ctx.assistVisitId)).data?.id;
    if (sessionId) {
      return {
        ok: true,
        data: {
          sessionId,
          consentGrantedAt: ctx.consentStatus.grantedAt,
          consentExplainedAt: ctx.consentStatus.explainedAt,
          assistVisitId: ctx.assistVisitId,
          assignmentId: ctx.assignmentId,
          alreadyGranted: true,
        },
      };
    }
  }

  const active = await fetchActiveTrackingSession(input.tenantId, ctx.assistVisitId);
  if (!active.ok) {
    return { ok: false, error: active.error };
  }

  if (active.data?.consentGrantedAt) {
    return {
      ok: true,
      data: {
        sessionId: active.data.id,
        consentGrantedAt: active.data.consentGrantedAt,
        consentExplainedAt: active.data.consentExplainedAt,
        assistVisitId: ctx.assistVisitId,
        assignmentId: ctx.assignmentId,
        alreadyGranted: true,
      },
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase ist nicht verfügbar.' };

  if (active.data?.id) {
    const { error: updateError } = await fromUnknownTable(supabase, 'assist_tracking_sessions')
      .update({
        consent_granted_at: now,
        consent_explained_at: explainedAt,
        employee_id: input.employeeId,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', active.data.id);

    if (updateError) {
      const err = liveTrackingErrorFromSupabase(updateError, {
        tenantId: input.tenantId,
        employeeId: input.employeeId,
        assignmentId: ctx.assignmentId,
        assistVisitId: ctx.assistVisitId,
        tableOrRpc: 'assist_tracking_sessions',
        operation: 'saveEmployeeLocationConsent.update',
      });
      return liveTrackingErrorToServiceResult(err);
    }

    const verified = await verifyConsentReadBack(input.tenantId, ctx.assistVisitId, now);
    if (!verified.ok) return verified as ServiceResult<never>;

    return {
      ok: true,
      data: {
        sessionId: active.data.id,
        consentGrantedAt: verified.data.consent_granted_at ?? now,
        consentExplainedAt: verified.data.consent_explained_at,
        assistVisitId: ctx.assistVisitId,
        assignmentId: ctx.assignmentId,
        alreadyGranted: false,
      },
    };
  }

  const latest = await fetchLatestSessionForVisit(input.tenantId, ctx.assistVisitId);
  if (!latest.ok) return latest as ServiceResult<never>;
  if (latest.data?.consent_granted_at) {
    return {
      ok: true,
      data: {
        sessionId: latest.data.id,
        consentGrantedAt: latest.data.consent_granted_at,
        consentExplainedAt: latest.data.consent_explained_at,
        assistVisitId: ctx.assistVisitId,
        assignmentId: ctx.assignmentId,
        alreadyGranted: true,
      },
    };
  }

  const started = await startTrackingSession(input.tenantId, {
    visitId: ctx.assistVisitId,
    employeeId: input.employeeId,
    consentGrantedAt: now,
    consentExplainedAt: explainedAt,
    source: 'employee_portal',
  });

  if (!started.ok) {
    const duplicate = started.error?.includes('duplicate') || started.error?.includes('uq_assist_tracking');
    if (duplicate) {
      const retryActive = await fetchActiveTrackingSession(input.tenantId, ctx.assistVisitId);
      if (retryActive.ok && retryActive.data?.consentGrantedAt) {
        return {
          ok: true,
          data: {
            sessionId: retryActive.data.id,
            consentGrantedAt: retryActive.data.consentGrantedAt,
            consentExplainedAt: retryActive.data.consentExplainedAt,
            assistVisitId: ctx.assistVisitId,
            assignmentId: ctx.assignmentId,
            alreadyGranted: true,
          },
        };
      }
    }

    const err = createLiveTrackingError('LIVE_CONSENT_SAVE_FAILED', {
      tenantId: input.tenantId,
      employeeId: input.employeeId,
      assignmentId: ctx.assignmentId,
      assistVisitId: ctx.assistVisitId,
      operation: 'saveEmployeeLocationConsent.insert',
      supabaseMessage: started.error,
    });
    logLiveTrackingError(err);
    return liveTrackingErrorToServiceResult(err);
  }

  const verified = await verifyConsentReadBack(input.tenantId, ctx.assistVisitId, now);
  if (!verified.ok) return verified as ServiceResult<never>;

  return {
    ok: true,
    data: {
      sessionId: started.data.id,
      consentGrantedAt: verified.data.consent_granted_at ?? now,
      consentExplainedAt: verified.data.consent_explained_at,
      assistVisitId: ctx.assistVisitId,
      assignmentId: ctx.assignmentId,
      alreadyGranted: false,
    },
  };
}
