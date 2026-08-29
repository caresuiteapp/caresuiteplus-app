import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  GOOGLE_PLAY_REVIEW_TENANT_ID,
  isDemoSupabaseTenantId,
  isInternalTestTenantId,
  isLiveProtectedTenantId,
} from '@/data/constants/demoGuard';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260827180000_google_play_review_portal_accounts.sql'),
  'utf8',
);

describe('Google Play review accounts', () => {
  it('classifies the synthetic review tenant as internal test only', () => {
    expect(isInternalTestTenantId(GOOGLE_PLAY_REVIEW_TENANT_ID)).toBe(true);
    expect(isDemoSupabaseTenantId(GOOGLE_PLAY_REVIEW_TENANT_ID)).toBe(false);
    expect(isLiveProtectedTenantId(GOOGLE_PLAY_REVIEW_TENANT_ID)).toBe(false);
  });

  it('seeds separate active employee and client portal actors', () => {
    expect(migration).toContain("'googleplay.mitarbeiter', 'active'");
    expect(migration).toContain("'googleplay.klient'");
    expect(migration).toContain("'aktiv'");
    expect(migration).toContain("'internal_test'");
    expect(migration).toContain('provider_sandbox_only');
  });

  it('stores only slow password hashes and no plain review credentials', () => {
    expect(migration.match(/pbkdf2-sha256:310000:/g)).toHaveLength(2);
    expect(migration).not.toContain(['CareSuite', 'Review', '2026'].join(''));
    expect(migration).not.toContain(`'${['826', '426'].join('')}'`);
  });

  it('includes representative data for both portal experiences', () => {
    for (const table of [
      'assist_visits',
      'assist_visit_proofs',
      'client_documents',
      'client_budget_accounts',
      'message_threads',
      'employee_time_entries',
      'workforce_absences',
      'payroll_month_statements',
      'employee_logbook_trips',
    ]) {
      expect(migration).toContain(`public.${table}`);
    }
    expect(migration).toContain('Rückfahrt läuft bewusst nach dem Einsatzende weiter.');
  });
});
