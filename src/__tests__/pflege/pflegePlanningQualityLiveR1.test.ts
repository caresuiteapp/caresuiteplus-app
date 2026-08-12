import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8').replace(/\r\n/g, '\n');

describe('PFLEGE TEIL 3 · PLANUNG & QUALITÄT LIVE R1', () => {
  const migration = source('supabase/migrations/20260812170000_pfleger_planning_quality_live_r1.sql');
  const service = source('src/lib/pflege/careQualityLiveService.ts');

  it('persists append-only evaluations and quality visits', () => {
    expect(migration).toContain('public.care_plan_evaluations');
    expect(migration).toContain('public.care_quality_visits');
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON public.care_plan_evaluations');
    expect(migration).toContain('REVOKE INSERT, UPDATE, DELETE ON public.care_quality_visits');
  });

  it('enforces active Pflege cases, tenant boundaries and atomic RPC writes', () => {
    expect(migration).toContain('public.is_active_pfleger_client(v_client)');
    expect(migration).toContain('public.is_active_pfleger_client(p_client_id)');
    expect(migration).toContain('tenant_id = public.current_tenant_id()');
    expect(migration).toContain('create_care_plan_evaluation');
    expect(migration).toContain('create_care_quality_visit');
  });

  it('updates plan review deadlines and writes audit evidence', () => {
    expect(migration).toContain('SET review_due_at = v_result.next_evaluation_at');
    expect(migration).toContain("'care_plan_evaluation'");
    expect(migration).toContain("'care_quality_visit'");
    expect(migration).toContain('to_jsonb(v_result)');
  });

  it('uses only the productive database path', () => {
    expect(service).toContain("getServiceMode() !== 'supabase'");
    expect(service).not.toContain('getDemo');
    expect(service).not.toContain('demoDelay');
    expect(source('src/screens/pflege/PflegeReportsScreen.tsx')).not.toContain('Demo-Daten');
  });

  it('exposes dedicated live create routes', () => {
    expect(source('app/pflege/evaluation/new.tsx')).toContain('CarePlanEvaluationCreateScreen');
    expect(source('app/pflege/visiten/new.tsx')).toContain('CareQualityVisitCreateScreen');
    const lists = source('src/screens/pflege/PflegeDedicatedScreens.tsx');
    expect(lists).toContain('createRoute="/pflege/evaluation/new"');
    expect(lists).toContain('createRoute="/pflege/visiten/new"');
  });

  it('calculates quality KPIs from live clinical evidence', () => {
    expect(migration).toContain('get_pfleger_quality_stats');
    expect(migration).toContain('public.vital_sign_measurements');
    expect(migration).toContain('public.clinical_wound_cases');
    expect(migration).toContain('EXISTS (SELECT 1 FROM public.care_plan_evaluations');
    expect(migration).toContain('EXISTS (SELECT 1 FROM public.care_quality_visits');
  });
});
