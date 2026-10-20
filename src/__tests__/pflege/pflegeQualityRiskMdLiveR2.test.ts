import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8').replace(/\r\n/g, '\n');

describe('PFLEGE TEIL 3 · QUALITÄT, RISIKO & MD LIVE R2', () => {
  const migration = source('supabase/migrations/20260812181500_pfleger_quality_risk_md_live_r2.sql');
  const service = source('src/lib/pflege/careQualityR2LiveService.ts');

  it('implements the full quality loop with append-only evidence', () => {
    expect(migration).toContain('public.care_plan_measure_reviews');
    expect(migration).toContain('public.care_quality_deviations');
    expect(migration).toContain("status IN('identified','assessed','in_progress','effectiveness_check','closed','cancelled')");
    expect(migration).toContain('effectiveness_result');
    expect(migration).toContain('REVOKE INSERT,UPDATE,DELETE');
  });

  it('uses granular high-risk permissions and active-case boundaries', () => {
    for (const key of ['pflege.risks.manage', 'pflege.measures.review', 'pflege.deviations.manage', 'pflege.md.readiness']) {
      expect(migration).toContain(key);
    }
    expect(migration.match(/public\.is_active_pfleger_client/g)?.length).toBeGreaterThanOrEqual(4);
    expect(migration).toContain('tenant_id=public.current_tenant_id()');
  });

  it('reviews risks and measures atomically with audit events', () => {
    expect(migration).toContain('review_care_risk');
    expect(migration).toContain('review_care_plan_measure');
    expect(migration).toContain("'care_plan_measure_review'");
    expect(migration).toContain("'care_risk'");
    expect(migration).toContain('Pflegemaßnahme fortgeschrieben.');
    expect(migration).toContain('SELECT i.care_plan_id,p.client_id INTO care_plan_id,client_id');
    expect(migration).not.toContain('INTO item_row,client_id');
  });

  it('calculates MD readiness from seven live evidence checks', () => {
    expect(migration).toContain('get_pfleger_md_readiness');
    for (const marker of ['approvedSis', 'activeMeasures', 'risksCurrent', 'recentEvaluation', 'recentVisit', 'signedDocumentation', 'deviationsClear']) {
      expect(migration).toContain(marker);
    }
    expect(migration).toContain('keine automatische Bestätigung einer bestandenen MD-Prüfung');
  });

  it('excludes demo fallbacks from all R2 services', () => {
    expect(service).toContain("getServiceMode() !== 'supabase'");
    expect(service).not.toContain('getDemo');
    expect(service).not.toContain('demoDelay');
    expect(source('app/pflege/risiken.tsx')).toContain('PflegeRisksListScreen');
  });

  it('provides productive routes for every R2 workflow', () => {
    const paths = [
      'app/pflege/risiko-review.tsx', 'app/pflege/massnahme-review.tsx',
      'app/pflege/abweichungen.tsx', 'app/pflege/abweichung-new.tsx',
      'app/pflege/abweichung-workflow.tsx', 'app/pflege/md-pruefbereitschaft.tsx',
    ];
    for (const path of paths) expect(source(path)).toContain('Screen');
    const nav = source('src/lib/navigation/moduleNav/pflegeNav.ts');
    expect(nav).toContain("href: '/pflege/abweichungen'");
    expect(nav).toContain("href: '/pflege/md-pruefbereitschaft'");
  });
});
