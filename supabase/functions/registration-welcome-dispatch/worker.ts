import {
  resolveRegistrationWelcomeConfig,
  sendRegistrationWelcomeEmail,
  type RegistrationWelcomeConfig,
  type RegistrationWelcomeDetails,
  type WelcomeSendResult,
} from '../_shared/registrationWelcomeEmail.ts';

export type RegistrationWelcomeItem = {
  id: string;
  tenant_id: string;
  tenant_user_id: string;
  auth_user_id: string;
  recipient_email: string;
  lease_token: string;
  delivery_revision?: number;
};
type Outcome = 'sent' | 'retry' | 'failed' | 'cancelled';
export type RegistrationWelcomeQueue = {
  claim(tenantId?: string): Promise<RegistrationWelcomeItem[]>;
  target(item: RegistrationWelcomeItem): Promise<RegistrationWelcomeDetails | null>;
  finish(item: RegistrationWelcomeItem, outcome: Outcome, messageId: string | null, errorCode: string | null): Promise<void>;
};
export type RegistrationWelcomeTransport = {
  send(details: RegistrationWelcomeDetails, deliveryId: string): Promise<WelcomeSendResult>;
};

export async function processRegistrationWelcomeQueue(
  queue: RegistrationWelcomeQueue,
  transport: RegistrationWelcomeTransport,
  tenantId?: string,
) {
  const items = await queue.claim(tenantId);
  const counts = { accepted: 0, retry: 0, failed: 0, cancelled: 0 };
  // Ten jobs maximum, two in flight: stay within the Edge Runtime wall-clock limit.
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(2, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      // DB failures are deliberately not converted into transport retries. The lease
      // expires automatically, preserving the same provider idempotency key.
      const details = await queue.target(item);
      if (!details) {
        await queue.finish(item, 'cancelled', null, 'registration_account_changed');
        counts.cancelled++;
        continue;
      }
      const deliveryId = (item.delivery_revision ?? 1) > 1 ? `${item.id}/${item.delivery_revision}` : item.id;
      const result = await transport.send(details, deliveryId);
      if (result.ok) {
        await queue.finish(item, 'sent', result.providerMessageId, null);
        counts.accepted++;
      } else {
        const outcome = result.retryable ? 'retry' : 'failed';
        await queue.finish(item, outcome, null, result.code);
        counts[outcome]++;
      }
    }
  }));
  return counts;
}

type DbResult<T> = { data: T; error: unknown };
type Lookup = {
  eq(column: string, value: string): Lookup;
  maybeSingle(): PromiseLike<DbResult<Record<string, string | null> | null>>;
};
export type RegistrationWelcomeClient = {
  rpc(name: string, args: Record<string,unknown>): PromiseLike<DbResult<unknown>>;
  from(table: string): { select(columns: string): Lookup };
  auth: { admin: { getUserById(id: string): PromiseLike<{
    data: { user: { email?: string; deleted_at?: string | null } | null };
    error: { status?: number } | null;
  }> } };
};

export function createRegistrationWelcomeQueue(client: RegistrationWelcomeClient, provider: 'resend' | 'sendgrid' = 'resend'): RegistrationWelcomeQueue {
  return {
    async claim(tenantId) {
      const { data, error } = await client.rpc('registration_welcome_claim', { p_tenant_id: tenantId ?? null, p_limit: 10, p_provider: provider });
      if (error) throw new Error('registration_welcome_claim_failed');
      return (data ?? []) as RegistrationWelcomeItem[];
    },
    async target(item) {
      const auth = await client.auth.admin.getUserById(item.auth_user_id);
      if (auth.error) {
        if (auth.error.status === 404) return null;
        throw new Error('registration_welcome_identity_lookup_failed');
      }
      if (!auth.data.user || auth.data.user.deleted_at || auth.data.user.email?.toLowerCase() !== item.recipient_email) return null;
      const owner = await client.from('tenant_users').select('username,email,display_name,status,role_key')
        .eq('id', item.tenant_user_id).eq('tenant_id', item.tenant_id).eq('auth_user_id', item.auth_user_id).maybeSingle();
      if (owner.error) throw new Error('registration_welcome_owner_lookup_failed');
      const row = owner.data;
      if (!row || row.status !== 'active' || row.role_key !== 'owner' || row.email?.toLowerCase() !== item.recipient_email || !row.username) return null;
      const tenant = await client.from('tenants').select('name,status').eq('id', item.tenant_id).maybeSingle();
      if (tenant.error) throw new Error('registration_welcome_tenant_lookup_failed');
      if (!tenant.data?.name || tenant.data.status !== 'active') return null;
      return { companyName: tenant.data.name, recipientName: row.display_name || 'und willkommen', recipientEmail: item.recipient_email, username: row.username };
    },
    async finish(item, outcome, messageId, errorCode) {
      const { data, error } = await client.rpc('registration_welcome_finish', {
        p_outbox_id: item.id, p_lease_token: item.lease_token,
        p_outcome: outcome, p_provider_message_id: messageId, p_error_code: errorCode,
      });
      if (error || data !== true) throw new Error('registration_welcome_finish_unconfirmed');
    },
  };
}

export const REGISTRATION_WELCOME_ENV_KEYS = [
  'RESEND_API_KEY', 'SENDGRID_API_KEY',
  'REGISTRATION_EMAIL_FROM', 'REGISTRATION_SUPPORT_EMAIL', 'REGISTRATION_APP_URL',
] as const;

export async function dispatchRegistrationWelcomeEmails(
  client: RegistrationWelcomeClient,
  env: Record<string,string | undefined>,
  tenantId?: string,
) {
  const config: RegistrationWelcomeConfig = resolveRegistrationWelcomeConfig(env);
  // Never consume attempts while sender credentials are missing. Durable jobs wait.
  if (!config.provider) return { configured: false, accepted: 0, retry: 0, failed: 0, cancelled: 0 };
  return { configured: true, ...await processRegistrationWelcomeQueue(
    createRegistrationWelcomeQueue(client, config.provider),
    { send: (details, id) => sendRegistrationWelcomeEmail(config, details, id) },
    tenantId,
  ) };
}

export async function authorizeRegistrationWelcomeWorker(
  client: Pick<RegistrationWelcomeClient, 'rpc'>,
  authorization: string | null,
): Promise<boolean> {
  const token = /^Bearer ([a-f0-9]{64})$/i.exec(authorization ?? '')?.[1];
  if (!token) return false;
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))))
    .map(byte => byte.toString(16).padStart(2,'0')).join('');
  const { data, error } = await client.rpc('registration_welcome_worker_authorized', { p_token_hash: hash });
  return !error && data === true;
}
