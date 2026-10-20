import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CARE_ASSESSMENT_TOPIC_KEYS } from '@/types/modules/careAssessment';
import { CARE_RISK_CATALOG, calculateCareAssessmentCompleteness, createEmptyTopics } from '@/lib/careAssessment/catalog';
const complete = () => ({
  personStatement: 'Ich möchte morgens selbstständig ins Bad gehen.',
  statementSource: 'person' as const,
  professionalSummary: 'Ressourcenorientierte Versorgung.',
  topics: createEmptyTopics().map((item) => ({
    ...item, personPerspective: 'Erfasst', resources: 'Erfasst', professionalAssessment: 'Bewertet',
  })),
  risks: [{
    riskKey: 'fall', state: 'present' as const, urgency: 'timely' as const,
    evidence: 'Transfer', protectiveFactors: 'Rollator', professionalRationale: 'Begründet',
    counselingProvided: 'Beraten', personDecision: 'Zustimmung', refusalDocumented: false,
    focusedAssessmentKey: 'fall_risk', focusedAssessmentResult: {}, linkedBodyMapMarkerIds: [],
    nextReviewAt: '2026-08-26T10:00:00.000Z',
  }],
  measures: [{
    title: 'Transfer', relatedTopicKey: 'mobility' as const, relatedRiskKey: 'fall',
    personalGoal: 'Sicher', intervention: 'Begleiten', timing: 'Morgens', frequency: 'Täglich',
    responsibleRole: 'Pflegefachperson', personContribution: 'Rollator', relativesContribution: '',
    warningSigns: 'Schwindel', escalationPath: 'Neubewertung', evaluationCriteria: 'Keine Stürze',
    nextEvaluationAt: '2026-08-26T10:00:00.000Z', status: 'active' as const,
  }],
  nextReviewAt: '2026-08-26T10:00:00.000Z',
});
describe('Care Assessment HealthOS', () => {
  it('stellt sechs Themenfelder bereit', () => {
    expect(createEmptyTopics().map((item) => item.topicKey)).toEqual([...CARE_ASSESSMENT_TOPIC_KEYS]);
  });
  it('blockiert unvollständige Freigaben', () => {
    expect(calculateCareAssessmentCompleteness({ ...complete(), topics: createEmptyTopics() }).canApprove).toBe(false);
  });
  it('akzeptiert vollständige Prozesse', () => {
    expect(calculateCareAssessmentCompleteness(complete())).toMatchObject({ percent: 100, canApprove: true });
  });
  it('enthält ein breites Risikoinventar', () => {
    expect(CARE_RISK_CATALOG.length).toBeGreaterThanOrEqual(15);
  });
  it('gewährt Admin und Pflege-Manage das notwendige Leserecht', () => {
    const migration = readFileSync(
      'supabase/migrations/20260808173000_premium_sis_permission_runtime_repair.sql',
      'utf8',
    );
    expect(migration).toContain("public.is_tenant_admin()");
    expect(migration).toContain("public.has_permission('pflege.plans.view')");
    expect(migration).toContain("public.has_permission('pflege.assessments.manage')");
    expect(migration).toContain("a.module_key = 'pflege'");
    expect(migration).toContain("c.status = 'active'::public.client_status");
  });
});
