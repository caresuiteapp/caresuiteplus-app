import { createClient, type Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase/client';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { platformFetch } from '@/lib/platform/platformFetch';
import { withServiceQueryTimeout } from '@/lib/services/queryTimeout';
import { recordLoginAuditEvent } from './loginAuditService';
import type { ServiceResult } from '@/types';

export type PreparedBusinessLogin = {
  session: Session;
  tenantId: string | null;
  commit: () => Promise<Session>;
  cancel: () => Promise<void>;
};

/** Device confirmation must finish before the shared SDK publishes SIGNED_IN. */
export async function prepareBusinessLogin(email: string, password: string): Promise<ServiceResult<PreparedBusinessLogin>> {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) return { ok: false, error: 'Die sichere Anmeldung ist derzeit nicht verfügbar.' };
  const isolated = createClient(config.url, config.anonKey, {
    global: { fetch: platformFetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
      storageKey: 'caresuite-business-login-preflight' },
  });
  let committed = false;
  let cancelled = false;
  const cancel = async () => {
    if (cancelled) return;
    cancelled = true;
    await isolated.auth.stopAutoRefresh().catch(() => {});
    if (!committed) await withServiceQueryTimeout(isolated.auth.signOut({ scope: 'local' }), 'Anmeldung beenden', 3_000).catch(() => {});
  };
  try {
    const signed = await withServiceQueryTimeout(isolated.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: password.trim() }), 'Anmeldung', 10_000);
    if (signed.error || !signed.data.session) {
      await cancel();
      return { ok: false, error: 'E-Mail oder Passwort konnten nicht bestätigt werden. Bitte prüfen Sie Ihre Eingaben.' };
    }
    const session = signed.data.session;
    const [access, bootstrap] = await withServiceQueryTimeout(Promise.all([
      isolated.rpc('platform_business_access_state'),
      isolated.rpc('account_security_bootstrap', { p_expected_user_id: session.user.id }),
    ]), 'Unternehmenszugang prüfen', 12_000);
    if (access.error || access.data?.allowed !== true) {
      await cancel();
      return { ok: false, error: access.error ? 'Der Unternehmenszugang konnte nicht geprüft werden. Bitte erneut anmelden.'
        : 'Der Unternehmenszugang ist deaktiviert. Bitte wenden Sie sich an die Verwaltung.' };
    }
    let tenant = !bootstrap.error && bootstrap.data?.profile?.tenantId;
    if (typeof tenant !== 'string' || !tenant) {
      // Legacy own profiles can use id=auth.uid() without auth_user_id.
      const legacy = await withServiceQueryTimeout(Promise.resolve(isolated.rpc('current_tenant_id')), 'Kontozuordnung prüfen', 10_000);
      tenant = legacy.error ? null : legacy.data;
    }
    const tenantId = typeof tenant === 'string' && tenant ? tenant : null;
    let publishing: Promise<Session> | null = null;
    const commit = (): Promise<Session> => {
      if (cancelled) return Promise.reject(new Error('Diese Anmeldung wurde abgebrochen.'));
      if (publishing) return publishing;
      publishing = (async () => {
        const client = getSupabaseClient();
        if (!client) throw new Error('Die sichere Anmeldung ist derzeit nicht verfügbar.');
        const result = await withServiceQueryTimeout(client.auth.setSession({ access_token: session.access_token,
          refresh_token: session.refresh_token }), 'Anmeldung übernehmen', 12_000);
        if (result.error || result.data.session?.user.id !== session.user.id) throw new Error('Die sichere Sitzung konnte nicht übernommen werden. Bitte erneut anmelden.');
        committed = true;
        void recordLoginAuditEvent({ tenantId, loginType: 'business', accountId: session.user.id,
          usernameOrCodeHint: email.trim().toLowerCase(), success: true, failureReason: null });
        return result.data.session;
      })();
      return publishing;
    };
    return { ok: true, data: { session, tenantId, commit, cancel } };
  } catch {
    await cancel();
    return { ok: false, error: 'Die Anmeldung konnte nicht rechtzeitig bestätigt werden. Bitte erneut versuchen.' };
  }
}
