import { describe, expect, it, vi } from 'vitest';
import { CARESUITE_GMAIL_SENDER, sendGmailSystemEmail } from '../../../supabase/functions/_shared/gmailSmtp';
import { resolveRegistrationWelcomeConfig } from '../../../supabase/functions/_shared/registrationWelcomeEmail';

const credentials = { user: CARESUITE_GMAIL_SENDER, password: 'testpassword1234' };
const content = { subject: 'Willkommen', text: 'Ihr Zugang', html: '<p>Ihr Zugang</p>' };

describe('existing Gmail system mail compatibility', () => {
  it('uses the configured Gmail account despite obsolete provider keys or sender settings', () => {
    const config = resolveRegistrationWelcomeConfig({ GMAIL_SMTP_APP_PASSWORD: credentials.password, RESEND_API_KEY: 'obsolete', REGISTRATION_EMAIL_FROM: 'no-reply@example.test' });
    expect(config).toMatchObject({ provider: 'gmail', from: 'CareSuite HealthOS System <caresuiteapp@gmail.com>', replyTo: CARESUITE_GMAIL_SENDER, apiKey: null, smtp: credentials });
    expect(resolveRegistrationWelcomeConfig({ RESEND_API_KEY: 'obsolete' }).provider).toBeNull();
    expect(() => resolveRegistrationWelcomeConfig({ GMAIL_SMTP_APP_PASSWORD: 'invalid' })).toThrow();
  });

  it('preserves sender, recipient, inline branding and a stable message reference; a deliberate resend gets a different reference', async () => {
    const sendMail = vi.fn().mockResolvedValue({ accepted: ['admin@example.test'], messageId: '<accepted@gmail.com>' });
    const close = vi.fn();
    const factory = vi.fn().mockResolvedValue({ sendMail, close });
    for (const reference of ['welcome/job', 'welcome/job', 'welcome/job/2']) {
      expect(await sendGmailSystemEmail(credentials, 'admin@example.test', content, reference, factory)).toMatchObject({ ok: true });
    }
    expect(factory.mock.calls[0][0]).toMatchObject({ host: 'smtp.gmail.com', port: 465, secure: true, tls: { rejectUnauthorized: true }, logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true });
    const first = sendMail.mock.calls[0][0];
    expect(first.from).toEqual({ name: 'CareSuite HealthOS System', address: CARESUITE_GMAIL_SENDER });
    expect(first.envelope).toEqual({ from: CARESUITE_GMAIL_SENDER, to: ['admin@example.test'] });
    expect(first.attachments.map((item: { cid: string }) => item.cid)).toEqual(['caresuite-logo', 'caresuite-neo']);
    expect(first.messageId).toBe(sendMail.mock.calls[1][0].messageId);
    expect(first.messageId).not.toBe(sendMail.mock.calls[2][0].messageId);
    expect(close).toHaveBeenCalledTimes(3);
  });

  it('preserves uncertain SMTP outcomes for review without exposing provider details or automatically retrying', async () => {
    const close = vi.fn();
    const factory = vi.fn().mockResolvedValue({ sendMail: vi.fn().mockRejectedValue({ code: 'ETIMEDOUT', command: 'DATA', message: 'private recipient and credential' }), close });
    expect(await sendGmailSystemEmail(credentials, 'admin@example.test', content, 'welcome/job', factory)).toEqual({ ok: false, retryable: false, code: 'mail_delivery_needs_review' });
    expect(close).toHaveBeenCalledTimes(1);
    const unavailable = vi.fn().mockRejectedValue({ code: 'ETLS', message: 'private certificate details' });
    expect(await sendGmailSystemEmail(credentials, 'admin@example.test', content, 'welcome/job', unavailable)).toEqual({ ok: false, retryable: true, code: 'mail_smtp_connection_failed' });
  });
});
