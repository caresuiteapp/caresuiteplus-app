import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import type { ServiceResult } from '@/types';
import { isCalendarDate } from './ambulatoryOperationsDomain';
import { readCompleteCarePlanRows } from './carePlanCompleteRead';

export type RespiratoryScope = { tenantId: string; planId: string };
export type RespiratoryAssessment = {
  id: string;
  observedOn: string;
  instrument: string;
  instrumentVersion: string;
  score: number;
  maximum: number;
  findings: string;
  createdAt: string;
};

type AssessmentDraft = Omit<RespiratoryAssessment, 'id' | 'createdAt' | 'score' | 'maximum'> & {
  score: string;
  maximum: string;
};

export function parseRespiratoryAssessment(draft: AssessmentDraft, today: string) {
  const { observedOn } = draft;
  const instrument = draft.instrument.trim(), instrumentVersion = draft.instrumentVersion.trim(), findings = draft.findings.trim();
  const scoreText = draft.score.trim(), maximumText = draft.maximum.trim();
  const number = /^\d{1,3}(?:[,.]\d{1,2})?$/;
  if (!isCalendarDate(observedOn) || observedOn > today || !instrument || !instrumentVersion || !findings ||
    !number.test(scoreText) || !number.test(maximumText)) return null;
  const score = Number(scoreText.replace(',', '.')), maximum = Number(maximumText.replace(',', '.'));
  if (maximum <= 0 || maximum > 999 || score > maximum ||
    instrument.length > 120 || instrumentVersion.length > 80 || findings.length > 4000) return null;
  return { observedOn, instrument, instrumentVersion, score, maximum, findings };
}

function fromRow(row: Record<string, unknown>): RespiratoryAssessment {
  return {
    id: String(row.id), observedOn: String(row.observed_on), instrument: String(row.instrument),
    instrumentVersion: String(row.instrument_version), score: Number(row.score), maximum: Number(row.maximum),
    findings: String(row.findings), createdAt: String(row.created_at),
  };
}

export async function fetchRespiratoryAssessments(scope: RespiratoryScope): Promise<ServiceResult<RespiratoryAssessment[]>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Die Atemdokumentation ist derzeit nicht verbunden.' };
  const data = await readCompleteCarePlanRows((start, end) => fromUnknownTable(supabase, 'care_plan_respiratory_assessments')
    .select('id,tenant_id,care_plan_id,observed_on,instrument,instrument_version,score,maximum,findings,created_at', { count: 'exact' })
    .eq('tenant_id', scope.tenantId).eq('care_plan_id', scope.planId)
    .order('id', { ascending: true }).range(start, end), row => row.tenant_id === scope.tenantId && row.care_plan_id === scope.planId);
  if (!data.ok) return data;
  return { ok: true, data: data.data.map(fromRow).sort((a, b) => b.observedOn.localeCompare(a.observedOn) || b.createdAt.localeCompare(a.createdAt)) };
}

export async function addRespiratoryAssessment(scope: RespiratoryScope, id: string, input: Omit<RespiratoryAssessment, 'id' | 'createdAt'>): Promise<ServiceResult<RespiratoryAssessment>> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Die Atemdokumentation ist derzeit nicht verbunden.' };
  const table = fromUnknownTable(supabase, 'care_plan_respiratory_assessments');
  const item = {
    id, tenant_id: scope.tenantId, care_plan_id: scope.planId, observed_on: input.observedOn,
    instrument: input.instrument, instrument_version: input.instrumentVersion, findings: input.findings,
    score: input.score, maximum: input.maximum,
  };
  const written = await table.insert(item).select('*').maybeSingle();
  const result = written.error?.code === '23505' ? await table.select('*')
    .eq('tenant_id', scope.tenantId).eq('care_plan_id', scope.planId).eq('id', id).maybeSingle() : written;
  if (result.error) return { ok: false, error: toGermanSupabaseError(result.error) };
  const row = result.data as Record<string, unknown> | null;
  if (!row || row.id !== id || row.tenant_id !== item.tenant_id || row.care_plan_id !== item.care_plan_id) {
    return { ok: false, error: 'Der Speichervorgang konnte nicht eindeutig bestätigt werden.' };
  }
  const read = fromRow(row);
  if (read.instrument !== input.instrument || read.instrumentVersion !== input.instrumentVersion || read.score !== input.score
    || read.maximum !== input.maximum || read.observedOn !== input.observedOn || read.findings !== input.findings) {
    return { ok: false, error: 'Der gespeicherte Eintrag enthält bereits andere Angaben. Bitte den Verlauf aktualisieren.' };
  }
  return { ok: true, data: read };
}
