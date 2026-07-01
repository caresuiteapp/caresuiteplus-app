import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..', '..', '..');

function readSrc(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Client portal messages + visits production repair', () => {
  const migration = readFileSync(
    path.join(root, 'supabase/migrations/0219_client_portal_messages_visits_rls_repair.sql'),
    'utf8',
  );

  it('migration repairs client portal RLS helpers and policies', () => {
    expect(migration).toContain('is_client_portal_rls_context');
    expect(migration).toContain('portal_account_id');
    expect(migration).toContain('assist_visits_portal_client_select');
    expect(migration).toContain('message_threads_portal_client_update');
    expect(migration).toContain('client_portal_access_portal_self_select');
    expect(migration).toContain('portal_enabled = TRUE');
  });

  it('client visit list does not require portal_release_enabled', () => {
    const repo = readSrc('src/lib/assist/repositories/visitRepository.supabase.ts');
    expect(repo).not.toMatch(/portalAudience === 'client'[\s\S]*portal_release_enabled/);
    expect(repo).toContain('portal_release_enabled gates live-tracking/detail only');
  });

  it('appointment service merges calendar and live assist visits for clients', () => {
    const service = readSrc('src/lib/portal/appointmentService.ts');
    expect(service).toContain('fetchLivePortalAppointmentsForClient');
    expect(service).toContain('getPortalCalendarEvents');
    expect(service).toContain('byId.set');
  });

  it('portal client link resolves via access account and auth user fallback', () => {
    const link = readSrc('src/lib/portal/resolvePortalClientLink.ts');
    expect(link).toContain('fetchPortalClientIdForAuthUser');
    expect(link).toContain('fetchPortalClientIdByAccessAccount');

    const actor = readSrc('src/hooks/usePortalActor.ts');
    expect(actor).toContain('fetchPortalClientIdForAuthUser');
  });
});
