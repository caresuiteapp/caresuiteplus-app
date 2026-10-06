import { REGISTRATION_WELCOME_ASSETS } from './registrationWelcomeAssets.ts';
import type { WelcomeSendResult } from './registrationWelcomeEmail.ts';

export const CARESUITE_GMAIL_SENDER = 'caresuiteapp@gmail.com';
export type GmailSmtpCredentials = { user: string; password: string };
export type GmailSmtpTransport = {
  sendMail(message: Record<string, unknown>): Promise<{ accepted?: unknown[]; messageId?: string }>;
  close(): void;
};
export type GmailSmtpFactory = (options: Record<string, unknown>) => Promise<GmailSmtpTransport>;

const createGmailSmtpTransport: GmailSmtpFactory = async options => {
  // Pinned server-only dependency. Never loaded in the application/browser.
  const module = await import(/* @vite-ignore */ 'npm:nodemailer@10.0.15');
  return module.default.createTransport(options) as GmailSmtpTransport;
};

export async function sendGmailSystemEmail(
  credentials: GmailSmtpCredentials,
  recipientEmail: string,
  content: { subject: string; text: string; html: string },
  idempotencyKey: string,
  factory: GmailSmtpFactory = createGmailSmtpTransport,
): Promise<WelcomeSendResult> {
  if (credentials.user !== CARESUITE_GMAIL_SENDER || !/^[A-Za-z0-9]{16}$/.test(credentials.password)) {
    return { ok: false, retryable: true, code: 'mail_not_configured' };
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipientEmail)) {
    return { ok: false, retryable: false, code: 'mail_invalid_recipient' };
  }
  let transport: GmailSmtpTransport | undefined;
  try {
    transport = await factory({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: CARESUITE_GMAIL_SENDER, pass: credentials.password },
      tls: { minVersion: 'TLSv1.2', servername: 'smtp.gmail.com', rejectUnauthorized: true },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000, dnsTimeout: 10000,
      logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
    });
    // A stable Message-ID helps manual reconciliation; SMTP does not deduplicate it.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(idempotencyKey));
    const key = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    const result = await transport.sendMail({
      from: { name: 'CareSuite HealthOS System', address: CARESUITE_GMAIL_SENDER },
      replyTo: CARESUITE_GMAIL_SENDER, to: recipientEmail, ...content,
      envelope: { from: CARESUITE_GMAIL_SENDER, to: [recipientEmail] },
      messageId: `<caresuite-${key}@gmail.com>`,
      headers: { 'Auto-Submitted': 'auto-generated', 'X-Auto-Response-Suppress': 'All' },
      attachments: REGISTRATION_WELCOME_ASSETS.map(asset => ({
        filename: asset.filename, content: asset.content, encoding: 'base64',
        contentType: asset.type, contentDisposition: 'inline', cid: asset.contentId,
      })),
    });
    const accepted = result.accepted?.some(address => typeof address === 'string' && address.toLowerCase() === recipientEmail.toLowerCase());
    if (!accepted) return { ok: false, retryable: false, code: 'mail_smtp_recipient_rejected' };
    return { ok: true, providerMessageId: result.messageId || null };
  } catch (error) {
    // Provider messages can contain credentials, email addresses or reset links.
    // Return only a small allowlist of machine-readable failure codes.
    const failure = error as { responseCode?: number; code?: string; command?: string };
    const responseCode = failure?.responseCode;
    if (typeof responseCode === 'number' && responseCode >= 400 && responseCode < 600) {
      return { ok: false, retryable: responseCode < 500, code: `mail_smtp_${responseCode}` };
    }
    const definitelyNotSent = ['EAUTH', 'EDNS', 'ECONNECTION', 'ETLS'].includes(failure?.code || '')
      || (failure?.code === 'ETIMEDOUT' && failure?.command === 'CONN');
    return definitelyNotSent
      ? { ok: false, retryable: true, code: 'mail_smtp_connection_failed' }
      : { ok: false, retryable: false, code: 'mail_delivery_needs_review' };
  } finally {
    try { transport?.close(); } catch { /* Closing must not change confirmed acceptance. */ }
  }
}
