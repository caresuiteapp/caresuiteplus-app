import { describe, expect, it, vi } from 'vitest';
import { sendGmailSystemEmail } from '../../../supabase/functions/_shared/gmailSmtp';
import { resolveRegistrationWelcomeConfig } from '../../../supabase/functions/_shared/registrationWelcomeEmail';
import { dispatchRegistrationWelcomeEmails } from '../../../supabase/functions/registration-welcome-dispatch/worker';

const credentials = { user: 'caresuiteapp@gmail.com', password: 'abcdefghijklmnop' };
const recipient = 'owner@example.test';
const content = { subject: 'Ihr Zugang', text: 'Sicherer Link', html: '<p>Sicherer Link</p>' };

function transport(result: unknown = { accepted: [recipient], messageId: 'smtp-accepted' }) {
  const sendMail = vi.fn().mockResolvedValue(result);
  const close = vi.fn();
  const factory = vi.fn().mockResolvedValue({ sendMail, close });
  return { sendMail, close, factory };
}

describe('Gmail system mail delivery', () => {
  it('authenticates the selected account over verified TLS and keeps both formats and CID artwork', async () => {
    const smtp = transport();
    expect(await sendGmailSystemEmail(credentials, recipient, content, 'job-one', smtp.factory)).toEqual({ ok: true, providerMessageId: 'smtp-accepted' });
    expect(smtp.factory).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: credentials.user, pass: credentials.password },
      tls: expect.objectContaining({ rejectUnauthorized: true }), logger: false, debug: false,
    }));
    const message = smtp.sendMail.mock.calls[0][0];
    expect(message).toMatchObject({ ...content, from: { name: 'CareSuite HealthOS System', address: credentials.user }, envelope: { from: credentials.user, to: [recipient] } });
    expect(message.attachments.map((asset: { cid: string }) => asset.cid)).toEqual(['caresuite-logo', 'caresuite-neo']);
    expect(message.headers['Auto-Submitted']).toBe('auto-generated');
    expect(smtp.close).toHaveBeenCalledOnce();
  });
  it('keeps a stable, non-personal Message-ID for reconciliation across attempts', async () => {
    const smtp = transport();
    await sendGmailSystemEmail(credentials, recipient, content, 'job-one', smtp.factory);
    await sendGmailSystemEmail(credentials, recipient, content, 'job-one', smtp.factory);
    const id = smtp.sendMail.mock.calls[0][0].messageId;
    expect(id).toMatch(/^<caresuite-[a-f0-9]{64}@gmail.com>$/);
    expect(smtp.sendMail.mock.calls[1][0].messageId).toBe(id);
    expect(id).not.toContain(recipient);
  });
  it('does not send, claim queue entries or consume attempts without the Gmail app password', async () => {
    const rpc = vi.fn();
    expect(await dispatchRegistrationWelcomeEmails({ rpc } as never, { RESEND_API_KEY: 'unrelated' })).toMatchObject({ configured: false });
    expect(rpc).not.toHaveBeenCalled();
    const smtp = transport();
    expect(await sendGmailSystemEmail({ ...credentials, password: '' }, recipient, content, 'job', smtp.factory)).toMatchObject({ ok: false, code: 'mail_not_configured' });
    expect(smtp.factory).not.toHaveBeenCalled();
    expect(resolveRegistrationWelcomeConfig({}).from).toBe('CareSuite HealthOS System <caresuiteapp@gmail.com>');
  });
  it('rejects an unrelated sender or an injected recipient before connecting', async () => {
    const smtp = transport();
    await sendGmailSystemEmail({ ...credentials, user: 'other@gmail.com' }, recipient, content, 'job', smtp.factory);
    await sendGmailSystemEmail(credentials, recipient + '\r\nBcc: outsider@example.test', content, 'job', smtp.factory);
    expect(smtp.factory).not.toHaveBeenCalled();
  });
  it('requires explicit provider acceptance of the one intended recipient', async () => {
    const smtp = transport({ accepted: [], messageId: 'not-accepted' });
    expect(await sendGmailSystemEmail(credentials, recipient, content, 'job', smtp.factory)).toEqual({ ok: false, retryable: false, code: 'mail_smtp_recipient_rejected' });
  });
  it('retries explicit temporary rejections but pauses ambiguous post-DATA failures', async () => {
    for (const [error, expected] of [
      [{ responseCode: 421 }, { retryable: true, code: 'mail_smtp_421' }],
      [{ responseCode: 550 }, { retryable: false, code: 'mail_smtp_550' }],
      [{ code: 'EAUTH' }, { retryable: true, code: 'mail_smtp_connection_failed' }],
      [{ code: 'ETIMEDOUT', command: 'CONN' }, { retryable: true, code: 'mail_smtp_connection_failed' }],
      [{ code: 'ETIMEDOUT', command: 'DATA' }, { retryable: false, code: 'mail_delivery_needs_review' }],
      [{ code: 'ESOCKET', command: 'DATA' }, { retryable: false, code: 'mail_delivery_needs_review' }],
    ] as const) {
      const smtp = transport();
      smtp.sendMail.mockRejectedValue({ ...error, message: credentials.password + ' ' + recipient });
      const result = await sendGmailSystemEmail(credentials, recipient, content, 'job', smtp.factory);
      expect(result).toEqual({ ok: false, ...expected });
      expect(JSON.stringify(result)).not.toContain(credentials.password);
      expect(JSON.stringify(result)).not.toContain(recipient);
      expect(smtp.close).toHaveBeenCalledOnce();
    }
  });
  it('does not turn confirmed acceptance into a retry if closing the connection fails', async () => {
    const smtp = transport();
    smtp.close.mockImplementation(() => { throw new Error('already closed'); });
    expect(await sendGmailSystemEmail(credentials, recipient, content, 'job', smtp.factory)).toMatchObject({ ok: true });
  });
});
