import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_IP_FAILURES = 10;
const MAX_ACCOUNT_FAILURES = 5;

async function countFailures(
  supabase: SupabaseClient,
  loginType: string,
  field: 'ip_address' | 'username_or_code_hint',
  value: string,
): Promise<number | null> {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from('login_audit_events')
    .select('*', { count: 'exact', head: true })
    .eq('login_type', loginType)
    .eq('success', false)
    .eq(field, value)
    .gte('created_at', since);

  if (error) {
    console.warn(`[loginSecurity] rate-limit lookup failed: ${error.message}`);
    return null;
  }
  return count ?? 0;
}

export async function isLoginRateLimited(
  supabase: SupabaseClient,
  input: {
    loginType: string;
    ipAddress: string | null;
    accountHint: string;
  },
): Promise<boolean> {
  const checks: Promise<number | null>[] = [
    countFailures(
      supabase,
      input.loginType,
      'username_or_code_hint',
      input.accountHint,
    ),
  ];
  if (input.ipAddress) {
    checks.push(countFailures(supabase, input.loginType, 'ip_address', input.ipAddress));
  }

  const [accountFailures, ipFailures] = await Promise.all(checks);
  return (
    (accountFailures ?? 0) >= MAX_ACCOUNT_FAILURES ||
    (ipFailures ?? 0) >= MAX_IP_FAILURES
  );
}

export const RATE_LIMIT_MESSAGE =
  'Zu viele Anmeldeversuche. Bitte warten Sie 15 Minuten und versuchen Sie es erneut.';

export const INVALID_PORTAL_CREDENTIALS_MESSAGE =
  'Benutzername oder Zugangsdaten sind falsch oder der Zugang ist nicht aktiv.';
