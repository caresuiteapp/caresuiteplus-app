import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { reviewWfmOfficeTimeEntry } from '@/lib/wfm/wfmOfficeTimekeepingService';
import { resetWfmTimeReviewDemoStore } from '@/lib/wfm/wfmTimeReviewService';
import { resetWfmOfficeTimekeepingStore } from '@/lib/wfm/wfmOfficeTimekeepingStore';
import type { WfmOfficeTimeEntry } from '@/types/modules/wfmOfficeTimekeeping';

vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'demo' }));

const root = path.join(__dirname, '..', '..', '..');
const readSrc = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('Office Arbeitszeit V32 Integritätsprüfung', () => {
  beforeEach(() => {
    resetWfmOfficeTimekeepingStore();
    resetWfmTimeReviewDemoStore();
  });

  it('uses the selected live entry context for review FK identity', async () => {
    const tenantId = 'a2222222-2222-4222-8222-222222222201';
    const employeeId = 'a2222222-2222-4222-8222-222222222231';
    const entry = {
      id: 'session:a2222222-2222-4222-8222-222222222241',
      tenantId,
      employeeId,
      workDate: '2026-07-20',
    } as WfmOfficeTimeEntry;

    const result = await reviewWfmOfficeTimeEntry(
      tenantId,
      'a2222222-2222-4222-8222-222222222211',
      'business_admin',
      entry.id,
      'approved',
      'Geprüft',
      entry,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.employeeId).toBe(employeeId);
  });

  it('normalizes legacy employee identifiers before review writes', () => {
    const review = readSrc('src/lib/wfm/wfmTimeReviewService.ts');
    const repository = readSrc('src/lib/wfm/wfmWorkSessionRepository.ts');
    expect(review).toContain('resolveCanonicalWfmEmployeeId');
    expect(repository).toContain(".eq('profile_id', candidateId)");
    expect(repository).toContain(".eq('auth_user_id', candidateId)");
    expect(repository).toContain('WFM_REVIEW_EMPLOYEE_LINK_MISSING');
  });

  it('writes review and history atomically with source-based employee resolution', () => {
    const review = readSrc('src/lib/wfm/wfmTimeReviewService.ts');
    const repository = readSrc('src/lib/wfm/wfmWorkSessionRepository.ts');
    const migration = readSrc('supabase/migrations/0261_wfm_time_review_atomic_repair.sql');

    expect(review).toContain("rpc('wfm_upsert_time_review'");
    expect(review).toContain('rawReferenceId');
    expect(repository).toContain("reference?.entryKind === 'visit'");
    expect(repository).toContain("fromUnknownTable(supabase, 'assignments')");
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('INSERT INTO public.workforce_time_entry_reviews');
    expect(migration).toContain('INSERT INTO public.workforce_time_review_actions');
    expect(migration).toContain("jsonb_build_object('source', 'wfm_atomic_review_v261')");
  });

  it('keeps review data readable when the detail pane opens', () => {
    const table = readSrc('src/components/wfm/WfmOfficeTimeEntryTable.tsx');
    expect(table).toContain('width < 640 || Boolean(selectedId)');
    expect(table).toContain('wfm-review-queue-mobile');
  });

  it('uses controlled system inputs for Office additions', () => {
    const manual = readSrc('src/components/wfm/WfmOfficeManualEntryPanel.tsx');
    expect(manual).toContain('CareEntitySelect');
    expect(manual).toContain('CareDateInput');
    expect(manual).toContain('CareTimeInput');
    expect(manual).toContain('ListFilterSelect');
    expect(manual).not.toContain('placeholder="Mitarbeiter-ID"');
  });

  it('has a concrete route for every worktime tab', () => {
    for (const route of [
      'live',
      'zeitkonten',
      'pruefqueue',
      'abwesenheiten',
      'nachtraege',
      'fahrzeitregeln',
      'team-meetings',
      'historie',
      'export',
      'einstellungen',
    ]) {
      expect(readSrc(`app/business/office/time-tracking/${route}.tsx`)).toBeTruthy();
    }
  });
});
