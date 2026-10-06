import { describe, expect, it, vi } from 'vitest';
const smtp = vi.hoisted(() => vi.fn());
vi.mock('../../../supabase/functions/_shared/gmailSmtp', () => ({ CARESUITE_GMAIL_SENDER: 'caresuiteapp@gmail.com', sendGmailSystemEmail: smtp }));
import { deliverBusinessRecovery, type BusinessRecoveryAdmin } from '../../../supabase/functions/business-password-recovery/core';
import { resolveRegistrationWelcomeConfig } from '../../../supabase/functions/_shared/registrationWelcomeEmail';

describe('Gmail recovery with corrected account identity', () => {
  it('binds the reset link to the current account/address before using the existing Gmail transport', async () => {
    smtp.mockReset().mockResolvedValue({ ok: true, providerMessageId: 'smtp-accepted' });
    const email = 'corrected@example.test';
    const identity = { id: 'selected-by-server', email };
    const rpc = vi.fn(async (name: string) => ({ data: name === 'business_register_recovery_delivery' ? true : { authUserId: identity.id, email, recipientName: 'Verwaltung' }, error: null }));
    const client = { rpc, auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: identity }, error: null }), generateLink: vi.fn().mockResolvedValue({ data: { user: identity, properties: { hashed_token: 'a'.repeat(64), verification_type: 'recovery' } }, error: null }) } } } as unknown as BusinessRecoveryAdmin;
    const config = resolveRegistrationWelcomeConfig({ GMAIL_SMTP_APP_PASSWORD: 'testpassword1234' });
    const oldTransport = vi.fn();
    expect(await deliverBusinessRecovery(client, config, email, oldTransport)).toEqual({ accepted: true });
    expect(rpc).toHaveBeenCalledWith('business_register_recovery_delivery', { p_token_digest: expect.stringMatching(/^[a-f0-9]{64}$/), p_auth_user_id: identity.id, p_email: email });
    expect(smtp).toHaveBeenCalledWith(config.smtp, email, expect.objectContaining({ html: expect.stringContaining('/auth/reset-password#token_hash=') }), expect.stringContaining('business-password-recovery-v1/'));
    expect(rpc.mock.invocationCallOrder.at(-1)).toBeLessThan(smtp.mock.invocationCallOrder[0]);
    expect(oldTransport).not.toHaveBeenCalled();
  });
});
