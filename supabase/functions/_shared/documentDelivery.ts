import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { tryInsert } from './http.ts';

export type DocumentDeliveryEnvConfig = {
  resendApiKey: string | null;
  sendgridApiKey: string | null;
  emailFrom: string | null;
  genericEmailApiUrl: string | null;
  genericFaxApiUrl: string | null;
  genericFaxApiKey: string | null;
};

export type DocumentDeliveryPayload = {
  tenantId: string;
  clientId: string;
  documentId: string;
  documentTitle: string;
  pdfBase64: string;
  pdfFileName: string;
  actorName?: string | null;
};

export function resolveDocumentDeliveryEnvConfig(
  env: Record<string, string | undefined>,
): DocumentDeliveryEnvConfig {
  return {
    resendApiKey: env.RESEND_API_KEY?.trim() || null,
    sendgridApiKey: env.SENDGRID_API_KEY?.trim() || null,
    emailFrom: env.DOCUMENT_EMAIL_FROM?.trim() || env.DSGVO_NOTIFY_FROM_EMAIL?.trim() || null,
    genericEmailApiUrl: env.DOCUMENT_EMAIL_API_URL?.trim() || null,
    genericFaxApiUrl: env.DOCUMENT_FAX_API_URL?.trim() || null,
    genericFaxApiKey: env.DOCUMENT_FAX_API_KEY?.trim() || null,
  };
}

export function isDocumentEmailConfigured(config: DocumentDeliveryEnvConfig): boolean {
  if (config.genericEmailApiUrl) return true;
  if (config.resendApiKey && config.emailFrom) return true;
  if (config.sendgridApiKey && config.emailFrom) return true;
  return false;
}

export function isDocumentFaxConfigured(config: DocumentDeliveryEnvConfig): boolean {
  return Boolean(config.genericFaxApiUrl);
}

export async function verifyCallerTenant(req: Request, tenantId: string): Promise<boolean> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return false;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!supabaseUrl || !anonKey) return false;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return false;

  const service = createClient(
    supabaseUrl,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: profile } = await service
    .from('profiles')
    .select('tenant_id')
    .eq('id', authData.user.id)
    .maybeSingle();

  return profile?.tenant_id === tenantId;
}

export async function logDocumentDeliveryTimeline(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    clientId: string;
    channel: 'email' | 'fax';
    documentTitle: string;
    recipient: string;
    actorName?: string | null;
  },
): Promise<void> {
  const channelLabel = input.channel === 'email' ? 'E-Mail' : 'Fax';
  await tryInsert(supabase, 'client_timeline_events', {
    tenant_id: input.tenantId,
    client_id: input.clientId,
    event_type: 'sonstige',
    icon: input.channel === 'email' ? '📧' : '📠',
    title: `Dokument per ${channelLabel} versendet`,
    subtitle: `${input.documentTitle} → ${input.recipient}`,
    status: 'abgeschlossen',
    actor_name: input.actorName ?? null,
    is_internal: false,
    metadata: {
      channel: input.channel,
      documentTitle: input.documentTitle,
      recipient: input.recipient,
    },
  });
}

export async function sendDocumentEmailViaResend(input: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  pdfBase64: string;
  pdfFileName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: [
        {
          filename: input.pdfFileName,
          content: input.pdfBase64,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return { ok: false, error: body || `Resend HTTP ${response.status}` };
  }

  return { ok: true };
}

export async function sendDocumentEmailViaSendGrid(input: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  pdfBase64: string;
  pdfFileName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }] }],
      from: { email: input.from },
      subject: input.subject,
      content: [
        { type: 'text/plain', value: input.text },
        { type: 'text/html', value: input.html },
      ],
      attachments: [
        {
          content: input.pdfBase64,
          filename: input.pdfFileName,
          type: 'application/pdf',
          disposition: 'attachment',
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return { ok: false, error: body || `SendGrid HTTP ${response.status}` };
  }

  return { ok: true };
}

export async function sendDocumentEmailViaGenericApi(input: {
  apiUrl: string;
  to: string;
  subject: string;
  message: string;
  pdfBase64: string;
  pdfFileName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const response = await fetch(input.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: input.to,
      subject: input.subject,
      message: input.message,
      pdfBase64: input.pdfBase64,
      pdfFileName: input.pdfFileName,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return { ok: false, error: body || `E-Mail-API HTTP ${response.status}` };
  }

  return { ok: true };
}

export async function sendDocumentFaxViaGenericApi(input: {
  apiUrl: string;
  apiKey?: string | null;
  faxNumber: string;
  pdfBase64: string;
  pdfFileName: string;
  documentTitle: string;
}): Promise<{ ok: boolean; error?: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (input.apiKey) {
    headers.Authorization = `Bearer ${input.apiKey}`;
  }

  const response = await fetch(input.apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      faxNumber: input.faxNumber,
      pdfBase64: input.pdfBase64,
      pdfFileName: input.pdfFileName,
      documentTitle: input.documentTitle,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return { ok: false, error: body || `Fax-API HTTP ${response.status}` };
  }

  return { ok: true };
}

export function buildDocumentEmailContent(input: {
  documentTitle: string;
  message?: string | null;
}): { subject: string; text: string; html: string } {
  const subject = input.documentTitle.trim() || 'CareSuite+ Dokument';
  const intro = input.message?.trim()
    || `Anbei finden Sie das Dokument „${input.documentTitle}“ als PDF.`;
  const text = `${intro}\n\n— CareSuite+`;
  const html = `<p>${escapeHtml(intro)}</p><p>— CareSuite+</p>`;
  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
