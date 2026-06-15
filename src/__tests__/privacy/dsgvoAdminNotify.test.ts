import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  buildAdminNotifyEmailContent,
  collectAdminRecipientEmails,
  isAdminNotifySendConfigured,
  resolveAdminNotifyEnvConfig,
  resolveAdminNotifyResult,
} from '@/lib/privacy/dataSubjectRequestAdminNotifyHandler';

describe('DSGVO admin notify handler (Sprint 71)', () => {
  it('resolveAdminNotifyEnvConfig liest Resend-Env ohne Secrets zu loggen', () => {
    const config = resolveAdminNotifyEnvConfig({
      RESEND_API_KEY: ' re_123 ',
      DSGVO_NOTIFY_FROM_EMAIL: ' dsgvo@example.com ',
      DSGVO_ADMIN_NOTIFY_EMAIL: ' admin@tenant.de ',
    });
    expect(config.resendApiKey).toBe('re_123');
    expect(config.fromEmail).toBe('dsgvo@example.com');
    expect(config.adminOverrideEmail).toBe('admin@tenant.de');
  });

  it('isAdminNotifySendConfigured ist false ohne vollständige Resend-Konfiguration', () => {
    expect(
      isAdminNotifySendConfigured({
        resendApiKey: 're_123',
        fromEmail: null,
        adminOverrideEmail: null,
      }),
    ).toBe(false);
    expect(
      isAdminNotifySendConfigured({
        resendApiKey: null,
        fromEmail: 'dsgvo@example.com',
        adminOverrideEmail: null,
      }),
    ).toBe(false);
    expect(
      isAdminNotifySendConfigured({
        resendApiKey: 're_123',
        fromEmail: 'dsgvo@example.com',
        adminOverrideEmail: null,
      }),
    ).toBe(true);
  });

  it('collectAdminRecipientEmails dedupliziert Mandanten- und Admin-Mails', () => {
    const emails = collectAdminRecipientEmails({
      profileEmails: ['Admin@Tenant.de', 'owner@tenant.de', null],
      tenantEmail: 'admin@tenant.de',
    });
    expect(emails).toEqual(['admin@tenant.de', 'owner@tenant.de']);
  });

  it('collectAdminRecipientEmails nutzt Override für Tests', () => {
    const emails = collectAdminRecipientEmails({
      profileEmails: ['ignored@example.com'],
      tenantEmail: 'tenant@example.com',
      overrideEmail: 'override@example.com',
    });
    expect(emails).toEqual(['override@example.com']);
  });

  it('buildAdminNotifyEmailContent enthält Anfrage-Metadaten', () => {
    const email = buildAdminNotifyEmailContent({
      tenantId: 'tenant-1',
      requestId: 'req-1',
      requestType: 'access',
      requesterName: 'Max Mustermann',
      requesterEmail: 'max@example.com',
      receivedAt: '2026-06-14T10:00:00.000Z',
    });
    expect(email.subject).toContain('Datenauskunft');
    expect(email.text).toContain('req-1');
    expect(email.text).toContain('max@example.com');
    expect(email.html).toContain('Max Mustermann');
  });

  it('resolveAdminNotifyResult meldet prepared_only ohne Resend-Konfiguration', () => {
    const result = resolveAdminNotifyResult({
      config: {
        resendApiKey: null,
        fromEmail: null,
        adminOverrideEmail: null,
      },
      recipientEmails: ['admin@tenant.de'],
      sendAttempted: false,
      sendSucceeded: false,
    });
    expect(result.status).toBe('prepared_only');
    expect(result.message).toContain('RESEND_API_KEY');
  });

  it('resolveAdminNotifyResult meldet no_recipients ehrlich', () => {
    const result = resolveAdminNotifyResult({
      config: {
        resendApiKey: 're_123',
        fromEmail: 'dsgvo@example.com',
        adminOverrideEmail: null,
      },
      recipientEmails: [],
      sendAttempted: false,
      sendSucceeded: false,
    });
    expect(result.status).toBe('no_recipients');
    expect(result.recipientCount).toBe(0);
  });

  it('resolveAdminNotifyResult meldet sent nur bei erfolgreichem Versand', () => {
    const result = resolveAdminNotifyResult({
      config: {
        resendApiKey: 're_123',
        fromEmail: 'dsgvo@example.com',
        adminOverrideEmail: null,
      },
      recipientEmails: ['admin@tenant.de'],
      sendAttempted: true,
      sendSucceeded: true,
    });
    expect(result.status).toBe('sent');
    expect(result.recipientCount).toBe(1);
  });

  it('resolveAdminNotifyResult meldet send_failed ehrlich bei Resend-Fehler', () => {
    const result = resolveAdminNotifyResult({
      config: {
        resendApiKey: 're_123',
        fromEmail: 'dsgvo@example.com',
        adminOverrideEmail: null,
      },
      recipientEmails: ['admin@tenant.de'],
      sendAttempted: true,
      sendSucceeded: false,
    });
    expect(result.status).toBe('send_failed');
    expect(result.message).toContain('fehlgeschlagen');
  });

  it('Edge Function meldet send_failed mit ok:false statt Fake-prepared_only', () => {
    const edge = readSrc('supabase/functions/notify-data-subject-request-admin/index.ts');
    expect(edge).toContain('resolveAdminNotifyResult');
    expect(edge).toContain("result.status === 'send_failed'");
    expect(edge).toContain('ok: false');
    expect(edge).not.toContain("status: 'prepared_only',\n        recipientCount: recipientEmails.length,\n        message: 'E-Mail-Versand fehlgeschlagen");
  });
});

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}
