export type AdminNotifyEnvConfig = {
  resendApiKey: string | null;
  fromEmail: string | null;
  adminOverrideEmail: string | null;
};

export type AdminNotifyRequestPayload = {
  tenantId: string;
  requestId: string;
  requestType: string;
  requesterName: string;
  requesterEmail: string;
  receivedAt?: string | null;
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  access: 'Datenauskunft',
  export: 'Datenexport',
  correction: 'Berichtigung',
  deletion: 'Löschung',
  restriction: 'Einschränkung',
  objection: 'Widerspruch',
  portability: 'Datenübertragbarkeit',
  consent_withdrawal: 'Einwilligungswiderruf',
  other: 'Sonstiges',
};

export function resolveAdminNotifyEnvConfig(
  env: Record<string, string | undefined>,
): AdminNotifyEnvConfig {
  return {
    resendApiKey: env.RESEND_API_KEY?.trim() || null,
    fromEmail: env.DSGVO_NOTIFY_FROM_EMAIL?.trim() || null,
    adminOverrideEmail: env.DSGVO_ADMIN_NOTIFY_EMAIL?.trim() || null,
  };
}

export function isAdminNotifySendConfigured(config: AdminNotifyEnvConfig): boolean {
  return Boolean(config.resendApiKey && config.fromEmail);
}

export function collectAdminRecipientEmails(input: {
  profileEmails: Array<string | null | undefined>;
  tenantEmail?: string | null;
  overrideEmail?: string | null;
}): string[] {
  if (input.overrideEmail?.trim()) {
    return [input.overrideEmail.trim().toLowerCase()];
  }

  const emails = new Set<string>();
  for (const email of input.profileEmails) {
    const normalized = email?.trim().toLowerCase();
    if (normalized && normalized.includes('@')) {
      emails.add(normalized);
    }
  }

  const tenant = input.tenantEmail?.trim().toLowerCase();
  if (tenant && tenant.includes('@')) {
    emails.add(tenant);
  }

  return [...emails].sort();
}

export function buildAdminNotifyEmailContent(request: AdminNotifyRequestPayload): {
  subject: string;
  text: string;
  html: string;
} {
  const typeLabel = REQUEST_TYPE_LABELS[request.requestType] ?? request.requestType;
  const received = request.receivedAt?.trim() || '—';
  const subject = `[CareSuite+] Neue DSGVO-Anfrage: ${typeLabel}`;

  const text = [
    'Neue Betroffenenanfrage in CareSuite+',
    '',
    `Anfrage-ID: ${request.requestId}`,
    `Art: ${typeLabel}`,
    `Antragsteller: ${request.requesterName}`,
    `E-Mail: ${request.requesterEmail}`,
    `Eingegangen: ${received}`,
    '',
    'Bitte im Admin-Bereich unter Sicherheit → Betroffenenanfragen bearbeiten.',
  ].join('\n');

  const html = [
    '<p>Neue Betroffenenanfrage in CareSuite+</p>',
    '<ul>',
    `<li><strong>Anfrage-ID:</strong> ${escapeHtml(request.requestId)}</li>`,
    `<li><strong>Art:</strong> ${escapeHtml(typeLabel)}</li>`,
    `<li><strong>Antragsteller:</strong> ${escapeHtml(request.requesterName)}</li>`,
    `<li><strong>E-Mail:</strong> ${escapeHtml(request.requesterEmail)}</li>`,
    `<li><strong>Eingegangen:</strong> ${escapeHtml(received)}</li>`,
    '</ul>',
    '<p>Bitte im Admin-Bereich unter Sicherheit → Betroffenenanfragen bearbeiten.</p>',
  ].join('');

  return { subject, text, html };
}

export async function sendViaResend(input: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return { ok: false, error: body || `Resend HTTP ${response.status}` };
  }

  return { ok: true };
}

export type AdminNotifyDeliveryStatus = 'sent' | 'prepared_only' | 'no_recipients' | 'send_failed';

export type AdminNotifyResult = {
  status: AdminNotifyDeliveryStatus;
  recipientCount: number;
  message: string;
};

export function resolveAdminNotifyResult(input: {
  config: AdminNotifyEnvConfig;
  recipientEmails: string[];
  sendAttempted: boolean;
  sendSucceeded: boolean;
}): AdminNotifyResult {
  const recipientCount = input.recipientEmails.length;

  if (!isAdminNotifySendConfigured(input.config)) {
    return {
      status: 'prepared_only',
      recipientCount,
      message:
        'Admin-E-Mail-Vorbereitung abgeschlossen. Versand erfordert RESEND_API_KEY und DSGVO_NOTIFY_FROM_EMAIL auf der Edge Function.',
    };
  }

  if (recipientCount === 0) {
    return {
      status: 'no_recipients',
      recipientCount: 0,
      message:
        'Keine Admin-E-Mail-Adressen für diesen Mandanten gefunden. Bitte Mandanten-Kontakt oder business_admin-Profile pflegen.',
    };
  }

  if (input.sendAttempted && input.sendSucceeded) {
    return {
      status: 'sent',
      recipientCount,
      message: `Admin-Benachrichtigung an ${recipientCount} Empfänger gesendet.`,
    };
  }

  if (input.sendAttempted && !input.sendSucceeded) {
    return {
      status: 'send_failed',
      recipientCount,
      message:
        'E-Mail-Versand fehlgeschlagen — Anfrage wurde gespeichert, aber keine Admin-Benachrichtigung versendet.',
    };
  }

  return {
    status: 'prepared_only',
    recipientCount,
    message: 'E-Mail-Versand nicht versucht — Resend-Konfiguration prüfen.',
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
