import type { LoginAuditEvent } from './auth.types';
import { appendLoginAuditEvent, getLoginAuditEvents } from './demoAccessStore';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from '@/lib/supabase/client';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function recordLoginAuditEvent(input: {
  tenantId: string | null;
  loginType: LoginAuditEvent['loginType'];
  accountId: string | null;
  usernameOrCodeHint: string;
  success: boolean;
  failureReason: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  if (getServiceMode() === 'supabase') {
    const client = getSupabaseClient();
    if (client) {
      await client.from('login_audit_events').insert({
        tenant_id: input.tenantId,
        login_type: input.loginType,
        account_id: input.accountId,
        username_or_code_hint: input.usernameOrCodeHint,
        success: input.success,
        failure_reason: input.failureReason,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
      });
      return;
    }
  }

  appendLoginAuditEvent({
    id: createId('lae'),
    tenantId: input.tenantId,
    loginType: input.loginType,
    accountId: input.accountId,
    usernameOrCodeHint: input.usernameOrCodeHint,
    success: input.success,
    failureReason: input.failureReason,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    createdAt: nowIso(),
  });
}

export function listLoginAuditEvents(tenantId?: string): LoginAuditEvent[] {
  return getLoginAuditEvents(tenantId);
}
