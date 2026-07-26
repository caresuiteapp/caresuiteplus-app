import type { ServiceResult } from '@/types';
import type {
  CareAssessment,
  CareAssessmentListItem,
  CareAssessmentStatus,
  CareAssessmentSubjectType,
} from '@/types/modules/careAssessment';
import { getSupabaseClient } from '@/lib/supabase/client';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { SERVICE_ERRORS } from '@/lib/services/errors';
import { calculateCareAssessmentCompleteness, createEmptyTopics } from './catalog';

type Row = Record<string, unknown>;
const unavailable = <T>(): ServiceResult<T> => ({ ok: false, error: SERVICE_ERRORS.supabaseUnavailable });
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

function topic(row: Row): CareAssessment['topics'][number] {
  return {
    id: String(row.id ?? ''),
    topicKey: String(row.topic_key) as CareAssessment['topics'][number]['topicKey'],
    personPerspective: String(row.person_perspective ?? ''),
    resources: String(row.resources ?? ''),
    impairments: String(row.impairments ?? ''),
    wishes: String(row.wishes ?? ''),
    habitsBiography: String(row.habits_biography ?? ''),
    professionalAssessment: String(row.professional_assessment ?? ''),
    actionNeeded: String(row.action_needed ?? ''),
    informationSources: strings(row.information_sources),
  };
}

function risk(row: Row): CareAssessment['risks'][number] {
  return {
    id: String(row.id ?? ''),
    riskKey: String(row.risk_key ?? ''),
    state: String(row.risk_state ?? 'unclear') as CareAssessment['risks'][number]['state'],
    urgency: String(row.urgency ?? 'routine') as CareAssessment['risks'][number]['urgency'],
    evidence: String(row.evidence ?? ''),
    protectiveFactors: String(row.protective_factors ?? ''),
    professionalRationale: String(row.professional_rationale ?? ''),
    counselingProvided: String(row.counseling_provided ?? ''),
    personDecision: String(row.person_decision ?? ''),
    refusalDocumented: Boolean(row.refusal_documented),
    focusedAssessmentKey: row.focused_assessment_key ? String(row.focused_assessment_key) : null,
    focusedAssessmentResult: (row.focused_assessment_result as Record<string, unknown>) ?? {},
    linkedBodyMapMarkerIds: strings(row.linked_bodymap_marker_ids),
    nextReviewAt: row.next_review_at ? String(row.next_review_at) : null,
  };
}

function measure(row: Row): CareAssessment['measures'][number] {
  return {
    id: String(row.id ?? ''),
    title: String(row.title ?? ''),
    relatedTopicKey: row.related_topic_key
      ? (String(row.related_topic_key) as CareAssessment['measures'][number]['relatedTopicKey'])
      : null,
    relatedRiskKey: row.related_risk_key ? String(row.related_risk_key) : null,
    personalGoal: String(row.personal_goal ?? ''),
    intervention: String(row.intervention ?? ''),
    timing: String(row.timing ?? ''),
    frequency: String(row.frequency ?? ''),
    responsibleRole: String(row.responsible_role ?? ''),
    personContribution: String(row.person_contribution ?? ''),
    relativesContribution: String(row.relatives_contribution ?? ''),
    warningSigns: String(row.warning_signs ?? ''),
    escalationPath: String(row.escalation_path ?? ''),
    evaluationCriteria: String(row.evaluation_criteria ?? ''),
    nextEvaluationAt: row.next_evaluation_at ? String(row.next_evaluation_at) : null,
    status: String(row.status ?? 'planned') as CareAssessment['measures'][number]['status'],
  };
}

function assessment(row: Row, children: Row[][]): CareAssessment {
  const [topicRows, riskRows, measureRows, evaluations, events, links] = children;
  const mappedTopics = topicRows.map(topic);
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    subjectType: String(row.subject_type) as CareAssessmentSubjectType,
    subjectId: String(row.subject_id),
    subjectName: String(row.subject_name_snapshot ?? '—'),
    variant: String(row.variant) as CareAssessment['variant'],
    reason: String(row.reason) as CareAssessment['reason'],
    reasonDetail: String(row.reason_detail ?? ''),
    status: String(row.status) as CareAssessmentStatus,
    version: Number(row.version ?? 1),
    schemaVersion: String(row.schema_version ?? 'caresuite-2026.1'),
    startedAt: String(row.started_at ?? ''),
    effectiveAt: row.effective_at ? String(row.effective_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    approvedAt: row.approved_at ? String(row.approved_at) : null,
    nextReviewAt: row.next_review_at ? String(row.next_review_at) : null,
    personStatement: String(row.person_statement ?? ''),
    statementSource: String(row.statement_source ?? 'person') as CareAssessment['statementSource'],
    statementSourceName: String(row.statement_source_name ?? ''),
    conversationParticipants: strings(row.conversation_participants),
    communicationSupport: String(row.communication_support ?? ''),
    informationSourceSummary: String(row.information_source_summary ?? ''),
    professionalSummary: String(row.professional_summary ?? ''),
    changeSummary: String(row.change_summary ?? ''),
    destabilizationSummary: String(row.destabilization_summary ?? ''),
    reassessmentRequired: Boolean(row.reassessment_required),
    qprRating: String(row.qpr_rating ?? 'not_assessed') as CareAssessment['qprRating'],
    qprRationale: String(row.qpr_rationale ?? ''),
    assessorName: String(row.assessor_name_snapshot ?? '—'),
    approverName: String(row.approver_name_snapshot ?? ''),
    topics: createEmptyTopics().map((empty) => mappedTopics.find((item) => item.topicKey === empty.topicKey) ?? empty),
    risks: riskRows.map(risk),
    measures: measureRows.map(measure),
    evaluations,
    events,
    links,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export const careAssessmentRepository = {
  async list(tenantId: string, subjectType: CareAssessmentSubjectType): Promise<ServiceResult<CareAssessmentListItem[]>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'care_assessments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('subject_type', subjectType)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false });
    if (error) return { ok: false, error: toGermanSupabaseError(error) };
    return {
      ok: true,
      data: ((data ?? []) as Row[]).map((row) => ({
        id: String(row.id),
        tenantId: String(row.tenant_id),
        subjectType: String(row.subject_type) as CareAssessmentSubjectType,
        subjectId: String(row.subject_id),
        subjectName: String(row.subject_name_snapshot ?? '—'),
        variant: String(row.variant) as CareAssessmentListItem['variant'],
        reason: String(row.reason) as CareAssessmentListItem['reason'],
        status: String(row.status) as CareAssessmentStatus,
        version: Number(row.version ?? 1),
        nextReviewAt: row.next_review_at ? String(row.next_review_at) : null,
        assessorName: String(row.assessor_name_snapshot ?? '—'),
        updatedAt: String(row.updated_at ?? ''),
        reassessmentRequired: Boolean(row.reassessment_required),
        activeRiskCount: Number(row.active_risk_count ?? 0),
        urgentRiskCount: Number(row.urgent_risk_count ?? 0),
        openMeasureCount: Number(row.open_measure_count ?? 0),
        completenessPercent: Number(row.completeness_percent ?? 0),
      })),
    };
  },

  async get(tenantId: string, id: string): Promise<ServiceResult<CareAssessment>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const parent = await fromUnknownTable(supabase, 'care_assessments')
      .select('*').eq('tenant_id', tenantId).eq('id', id).maybeSingle();
    if (parent.error) return { ok: false, error: toGermanSupabaseError(parent.error) };
    if (!parent.data) return { ok: false, error: 'SIS / Assessment wurde nicht gefunden.' };
    const tables = [
      'care_assessment_topics',
      'care_assessment_risks',
      'care_assessment_measures',
      'care_assessment_evaluations',
      'care_assessment_events',
      'care_assessment_links',
    ];
    const results = await Promise.all(tables.map((table) =>
      fromUnknownTable(supabase, table).select('*').eq('tenant_id', tenantId).eq('assessment_id', id),
    ));
    const failure = results.find((result) => result.error);
    if (failure?.error) return { ok: false, error: toGermanSupabaseError(failure.error) };
    return { ok: true, data: assessment(parent.data as Row, results.map((result) => (result.data ?? []) as Row[])) };
  },

  async create(
    tenantId: string,
    input: Pick<CareAssessment, 'subjectType' | 'subjectId' | 'subjectName' | 'variant' | 'reason' | 'assessorName'>,
  ): Promise<ServiceResult<CareAssessment>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const { data, error } = await fromUnknownTable(supabase, 'care_assessments').insert({
      tenant_id: tenantId,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      subject_name_snapshot: input.subjectName,
      variant: input.variant,
      reason: input.reason,
      assessor_name_snapshot: input.assessorName,
    }).select('id').single();
    if (error || !data) return { ok: false, error: toGermanSupabaseError(error) };
    const id = String((data as Row).id);
    const inserted = await fromUnknownTable(supabase, 'care_assessment_topics').insert(
      createEmptyTopics().map((item) => ({ tenant_id: tenantId, assessment_id: id, topic_key: item.topicKey })),
    );
    if (inserted.error) return { ok: false, error: toGermanSupabaseError(inserted.error) };
    return this.get(tenantId, id);
  },

  async save(tenantId: string, value: CareAssessment): Promise<ServiceResult<CareAssessment>> {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable();
    const completeness = calculateCareAssessmentCompleteness(value);
    const rpc = (supabase as unknown as {
      rpc: (name: string, payload: Record<string, unknown>) => Promise<{ error: unknown }>;
    });
    const { error } = await rpc.rpc('save_care_assessment', {
      p_assessment_id: value.id,
      p_payload: {
        assessment: {
          reason: value.reason,
          reason_detail: value.reasonDetail,
          next_review_at: value.nextReviewAt,
          person_statement: value.personStatement,
          statement_source: value.statementSource,
          statement_source_name: value.statementSourceName,
          conversation_participants: value.conversationParticipants,
          communication_support: value.communicationSupport,
          information_source_summary: value.informationSourceSummary,
          professional_summary: value.professionalSummary,
          change_summary: value.changeSummary,
          destabilization_summary: value.destabilizationSummary,
          assessor_name_snapshot: value.assessorName,
          completeness_percent: completeness.percent,
          active_risk_count: value.risks.filter((item) => item.state === 'present').length,
          urgent_risk_count: value.risks.filter((item) => ['urgent', 'immediate'].includes(item.urgency)).length,
          open_measure_count: value.measures.filter((item) => ['planned', 'active'].includes(item.status)).length,
        },
        topics: value.topics,
        risks: value.risks,
        measures: value.measures,
      },
    });
    if (error) return { ok: false, error: toGermanSupabaseError(error as Parameters<typeof toGermanSupabaseError>[0]) };
    return this.get(tenantId, value.id);
  },

  async transition(tenantId: string, id: string, status: CareAssessmentStatus, actorName: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return unavailable<CareAssessment>();
    const rpc = (supabase as unknown as {
      rpc: (name: string, payload: Record<string, unknown>) => Promise<{ error: unknown }>;
    });
    const { error } = await rpc.rpc('transition_care_assessment', {
      p_assessment_id: id,
      p_new_status: status,
      p_actor_name: actorName,
    });
    if (error) return { ok: false as const, error: toGermanSupabaseError(error as Parameters<typeof toGermanSupabaseError>[0]) };
    return this.get(tenantId, id);
  },
};
