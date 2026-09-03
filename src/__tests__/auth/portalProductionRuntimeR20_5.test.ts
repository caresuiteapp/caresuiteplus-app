import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('portal production runtime R20.5', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('never enables demo repositories in the Google-Play portal edition', async () => {
    vi.stubEnv('EXPO_PUBLIC_APP_EDITION', 'portal-only');
    vi.stubEnv('EXPO_PUBLIC_DEMO_MODE', 'true');

    const { isDemoMode } = await import('@/lib/supabase/config');
    const { getServiceMode } = await import('@/lib/services/mode');

    expect(isDemoMode()).toBe(false);
    expect(getServiceMode()).toBe('supabase');
  });

  it('pins every production portal build to live mode', () => {
    const eas = JSON.parse(read('eas.json'));
    for (const profile of [
      'production',
      'production-aab',
      'healthos-core-apk',
      'healthos-core-aab',
      'portal-only-apk',
      'portal-only-aab',
    ]) {
      expect(eas.build[profile].env.EXPO_PUBLIC_DEMO_MODE).toBe('false');
    }
  });

  it('uses a rollback-only live database probe before messages and workflow writes', () => {
    const migration = read(
      'supabase/migrations/20260903090000_portal_runtime_write_probe_r20_5.sql',
    );
    const chat = read('src/components/portal/PortalNewChatModal.tsx');
    const reply = read('src/hooks/useportalofficethreaddetail.ts');
    const workflow = read('src/hooks/useEmployeePortalVisitExecution.ts');

    expect(migration).toContain('portal_runtime_write_probe');
    expect(migration.match(/__CARESUITE_ROLLBACK_PROBE__/g)).toHaveLength(4);
    expect(migration).toContain('GRANT EXECUTE');
    expect(chat).toContain("ensurePortalWriteSession(portalSession, 'messages')");
    expect(reply).toContain("ensurePortalWriteSession(portalSession, 'messages')");
    expect(workflow.match(/ensurePortalWriteSession\(portalSession, 'workflow'\)/g)).toHaveLength(2);
  });

  it('shows loading and catches failures during the session probe', () => {
    const chat = read('src/components/portal/PortalNewChatModal.tsx');
    const reply = read('src/hooks/useportalofficethreaddetail.ts');
    const workflow = read('src/hooks/useEmployeePortalVisitExecution.ts');
    const auth = read('src/lib/auth/portalSupabaseAuth.ts');

    expect(chat.indexOf('setSubmitting(true)')).toBeLessThan(
      chat.indexOf("ensurePortalWriteSession(portalSession, 'messages')"),
    );
    expect(reply.indexOf('setSending(true)')).toBeLessThan(
      reply.indexOf("ensurePortalWriteSession(portalSession, 'messages')"),
    );
    expect(workflow.indexOf("loadingMode === 'start_service'")).toBeLessThan(
      workflow.indexOf("ensurePortalWriteSession(portalSession, 'workflow')"),
    );
    expect(auth).toContain('PORTAL_SESSION_CHECK_TIMEOUT_MS');
    expect(auth).toContain('Produktionsprüfung fehlgeschlagen');
  });
});
